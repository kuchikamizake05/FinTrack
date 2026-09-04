package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestLatestCompletedPeriodAtMonthBoundary(t *testing.T) {
	start, end := latestCompletedPeriod(time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC))
	if got, want := start.Format("2006-01-02"), "2026-08-01"; got != want {
		t.Fatalf("start = %s, want %s", got, want)
	}
	if got, want := end.Format("2006-01-02"), "2026-08-31"; got != want {
		t.Fatalf("end = %s, want %s", got, want)
	}
}

func TestBuildReportKeepsCompositeCategoriesAndMissingFX(t *testing.T) {
	accountID := "usd"
	rate := 16000.0
	report := buildReport([]transaction{
		{Date: "2026-08-01", Type: "income", Category: "Salary", Amount: 100, Status: "confirmed", AccountID: &accountID},
		{Date: "2026-08-02", Type: "expense", Category: "A", Amount: 20, Status: "confirmed", AccountID: &accountID},
		{Date: "2026-08-03", Type: "expense", Category: "AB", Amount: 10, Status: "confirmed", AccountID: &accountID},
	}, map[string]account{"usd": {ID: "usd", Name: "USD Wallet", Currency: "USD"}}, map[string]rateResult{
		"USD": {Base: "USD", Quote: "IDR", Rate: &rate, State: "fresh"},
	})

	if len(report.CurrencyGroups) != 1 || report.CurrencyGroups[0].Income != 100 || report.CurrencyGroups[0].Expense != 30 || *report.CurrencyGroups[0].ConvertedNetIDR != 1_120_000 {
		t.Fatalf("unexpected currency totals: %#v", report.CurrencyGroups)
	}
	if len(report.CategoryTotals) != 2 || report.CategoryTotals[0].Category != "A" || report.CategoryTotals[1].Category != "AB" {
		t.Fatalf("composite categories merged: %#v", report.CategoryTotals)
	}

	missingID := "missing"
	missing := buildReport([]transaction{{Date: "2026-08-04", Type: "expense", Category: "Other", Amount: 5, Status: "confirmed", AccountID: &missingID}}, nil, nil)
	group := missing.CurrencyGroups[0]
	if group.Currency != "Tidak diketahui" || group.Rate.State != "missing" || group.ConvertedNetIDR != nil {
		t.Fatalf("missing FX fallback = %#v", group)
	}
}

func TestSerializeReportCSVNeutralizesFormulasAndOmitsPrivateFields(t *testing.T) {
	merchant := "=SUM(A1:A2)"
	note := "+cmd|' /C calc'!A0"
	accountID := "secret-account-id"
	report := financialReport{Rows: []reportRow{{
		Transaction: transaction{Date: "2026-08-01", Type: "expense", Merchant: &merchant, Category: "@category", Amount: 1, Note: &note, Status: "confirmed", Source: "manual", AccountID: &accountID},
		Account:     "Wallet", Currency: "IDR",
	}}}
	contents, err := serializeReportCSV(report, time.Date(2026, 9, 1, 1, 17, 0, 0, time.UTC), time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 31, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	csv := string(contents)
	for _, value := range []string{"'=SUM(A1:A2)", "'+cmd|' /C calc'!A0", "'@category"} {
		if !strings.Contains(csv, value) {
			t.Fatalf("CSV does not neutralize %q:\n%s", value, csv)
		}
	}
	for _, private := range []string{"account_id", accountID, "receipt_url", "raw_text", "user_id"} {
		if strings.Contains(csv, private) {
			t.Fatalf("CSV exposes %q", private)
		}
	}
}

func TestFrankfurterMalformedResponseReturnsMissingRate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`[{"date":"","base":"USD","quote":"IDR","rate":0}]`))
	}))
	defer server.Close()
	baseURL, _ := url.Parse(server.URL)
	client := &frankfurterClient{baseURL: baseURL, httpClient: server.Client(), now: func() time.Time { return time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC) }}

	rate := client.Rates(context.Background(), []string{"USD"})["USD"]
	if rate.State != "missing" || rate.Rate != nil || rate.ProviderDate != nil || rate.RetrievedAt != nil {
		t.Fatalf("malformed rate = %#v", rate)
	}
}

type fakeStore struct {
	schedules        []schedule
	existing         map[string]bool
	failTransactions map[string]error
	transactionCalls []string
	uploadCalls      []string
	insertCalls      []string
}

func (store *fakeStore) ListSchedules(context.Context, time.Time) ([]schedule, error) {
	return store.schedules, nil
}
func (store *fakeStore) ReportExists(_ context.Context, userID string, _ time.Time) (bool, error) {
	return store.existing[userID], nil
}
func (store *fakeStore) ListTransactions(_ context.Context, userID string, _, _ time.Time) ([]transaction, error) {
	store.transactionCalls = append(store.transactionCalls, userID)
	return nil, store.failTransactions[userID]
}
func (store *fakeStore) ListAccounts(context.Context, string) ([]account, error) { return nil, nil }
func (store *fakeStore) UploadCSV(_ context.Context, path string, _ []byte) error {
	store.uploadCalls = append(store.uploadCalls, path)
	return nil
}
func (store *fakeStore) InsertReport(_ context.Context, record reportRecord) (bool, error) {
	store.insertCalls = append(store.insertCalls, record.UserID)
	return true, nil
}

type fakeRates struct{}

func (fakeRates) Rates(context.Context, []string) map[string]rateResult { return nil }

func TestRunSkipsDuplicateWithoutReadingLedger(t *testing.T) {
	store := &fakeStore{schedules: []schedule{{UserID: "existing"}}, existing: map[string]bool{"existing": true}, failTransactions: map[string]error{}}
	result := run(context.Background(), store, fakeRates{}, time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC), log.New(io.Discard, "", 0))
	if result != (counts{Skipped: 1}) || len(store.transactionCalls) != 0 || len(store.uploadCalls) != 0 {
		t.Fatalf("duplicate result=%#v transactionCalls=%v uploadCalls=%v", result, store.transactionCalls, store.uploadCalls)
	}
}

func TestRunContinuesAfterFailedUser(t *testing.T) {
	store := &fakeStore{
		schedules: []schedule{{UserID: "broken"}, {UserID: "healthy"}},
		existing:  map[string]bool{}, failTransactions: map[string]error{"broken": errors.New("database unavailable")},
	}
	result := run(context.Background(), store, fakeRates{}, time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC), log.New(io.Discard, "", 0))
	if result != (counts{Generated: 1, Failed: 1}) {
		t.Fatalf("result = %#v", result)
	}
	if got := strings.Join(store.transactionCalls, ","); got != "broken,healthy" {
		t.Fatalf("processed users = %s", got)
	}
	if got := strings.Join(store.insertCalls, ","); got != "healthy" {
		t.Fatalf("inserted users = %s", got)
	}
}

func TestSupabasePaginationRequestsUntilEmpty(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests++
		if request.Header.Get("apikey") != "service-key" || request.Header.Get("Authorization") != "Bearer service-key" {
			t.Error("service role headers missing")
		}
		response.Header().Set("Content-Type", "application/json")
		if requests == 1 {
			if got, want := request.Header.Get("Range"), "0-999"; got != want {
				t.Errorf("Range = %s, want %s", got, want)
			}
			_, _ = response.Write([]byte(`[{"user_id":"user-1"}]`))
			return
		}
		if got, want := request.Header.Get("Range"), "1-1000"; got != want {
			t.Errorf("Range = %s, want %s", got, want)
		}
		_, _ = response.Write([]byte(`[]`))
	}))
	defer server.Close()
	baseURL, _ := url.Parse(server.URL)
	client := &supabaseClient{baseURL: baseURL, serviceKey: "service-key", httpClient: server.Client()}
	rows, err := client.ListSchedules(context.Background(), time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || requests != 2 {
		t.Fatalf("rows=%v requests=%d", rows, requests)
	}
}

func TestUploadCSVTreatsStorageDuplicateAsRetrySafe(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(http.StatusBadRequest)
		_, _ = response.Write([]byte(`{"statusCode":"409","code":"KeyAlreadyExists","message":"The resource already exists"}`))
	}))
	defer server.Close()
	baseURL, _ := url.Parse(server.URL)
	client := &supabaseClient{baseURL: baseURL, serviceKey: "service-key", httpClient: server.Client()}
	if err := client.UploadCSV(context.Background(), "user/2026-08.csv", []byte("report")); err != nil {
		t.Fatalf("duplicate upload returned %v", err)
	}
}
