package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	reportBucket = "financial-reports"
	pageSize     = 1000
)

type schedule struct {
	UserID string `json:"user_id"`
}

type transaction struct {
	Date      string  `json:"date"`
	Type      string  `json:"type"`
	Merchant  *string `json:"merchant"`
	Category  string  `json:"category"`
	Amount    float64 `json:"amount"`
	Note      *string `json:"note"`
	Status    string  `json:"status"`
	Source    string  `json:"source"`
	AccountID *string `json:"account_id"`
}

type account struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Currency string `json:"currency"`
}

type rateResult struct {
	Base         string   `json:"base"`
	Quote        string   `json:"quote"`
	Rate         *float64 `json:"rate"`
	ProviderDate *string  `json:"providerDate"`
	RetrievedAt  *string  `json:"retrievedAt"`
	State        string   `json:"state"`
}

type currencyGroup struct {
	Currency            string     `json:"currency"`
	Income              float64    `json:"income"`
	Expense             float64    `json:"expense"`
	Net                 float64    `json:"net"`
	ConvertedIncomeIDR  *float64   `json:"convertedIncomeIdr"`
	ConvertedExpenseIDR *float64   `json:"convertedExpenseIdr"`
	ConvertedNetIDR     *float64   `json:"convertedNetIdr"`
	Rate                rateResult `json:"rate"`
}

type categoryTotal struct {
	Currency string  `json:"currency"`
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type reportRow struct {
	Transaction transaction
	Account     string
	Currency    string
}

type financialReport struct {
	CurrencyGroups []currencyGroup
	CategoryTotals []categoryTotal
	Rows           []reportRow
}

type counts struct {
	Generated int
	Skipped   int
	Failed    int
}

type reportStore interface {
	ListSchedules(context.Context, time.Time) ([]schedule, error)
	ReportExists(context.Context, string, time.Time) (bool, error)
	ListTransactions(context.Context, string, time.Time, time.Time) ([]transaction, error)
	ListAccounts(context.Context, string) ([]account, error)
	UploadCSV(context.Context, string, []byte) error
	InsertReport(context.Context, reportRecord) (bool, error)
}

type rateProvider interface {
	Rates(context.Context, []string) map[string]rateResult
}

type reportRecord struct {
	UserID         string          `json:"user_id"`
	PeriodStart    string          `json:"period_start"`
	PeriodEnd      string          `json:"period_end"`
	GeneratedAt    string          `json:"generated_at"`
	CurrencyGroups []currencyGroup `json:"currency_groups"`
	CategoryTotals []categoryTotal `json:"category_totals"`
	CSVPath        string          `json:"csv_path"`
}

type supabaseClient struct {
	baseURL    *url.URL
	serviceKey string
	httpClient *http.Client
}

type frankfurterClient struct {
	baseURL    *url.URL
	httpClient *http.Client
	now        func() time.Time
}

func main() {
	baseURL, err := validateSupabaseURL(os.Getenv("SUPABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if serviceKey == "" {
		log.Fatal("SUPABASE_SERVICE_ROLE_KEY is required")
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	store := &supabaseClient{baseURL: baseURL, serviceKey: serviceKey, httpClient: httpClient}
	fxURL, _ := url.Parse("https://api.frankfurter.dev")
	fx := &frankfurterClient{baseURL: fxURL, httpClient: httpClient, now: time.Now}
	result := run(context.Background(), store, fx, time.Now().UTC(), log.Default())
	fmt.Printf("generated=%d skipped=%d failed=%d\n", result.Generated, result.Skipped, result.Failed)
	if result.Failed > 0 {
		os.Exit(1)
	}
}

func validateSupabaseURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("SUPABASE_URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return nil, errors.New("SUPABASE_URL must be an absolute URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("SUPABASE_URL must not contain credentials, query, or fragment")
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && isLoopbackHost(parsed.Hostname())) {
		return nil, errors.New("SUPABASE_URL must use HTTPS outside loopback")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return parsed, nil
}

func isLoopbackHost(host string) bool {
	return strings.EqualFold(host, "localhost") || (net.ParseIP(host) != nil && net.ParseIP(host).IsLoopback())
}

func latestCompletedPeriod(now time.Time) (time.Time, time.Time) {
	now = now.UTC()
	currentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	start := currentMonth.AddDate(0, -1, 0)
	return start, currentMonth.AddDate(0, 0, -1)
}

func run(ctx context.Context, store reportStore, fx rateProvider, now time.Time, logger *log.Logger) counts {
	periodStart, periodEnd := latestCompletedPeriod(now)
	schedules, err := store.ListSchedules(ctx, periodStart)
	if err != nil {
		logger.Printf("list schedules: %v", err)
		return counts{Failed: 1}
	}
	result := counts{}
	for _, item := range schedules {
		status, err := processSchedule(ctx, store, fx, item, periodStart, periodEnd, now.UTC())
		if err != nil {
			result.Failed++
			logger.Printf("monthly report user %s failed: %v", item.UserID, err)
			continue
		}
		if status == "generated" {
			result.Generated++
		} else {
			result.Skipped++
		}
	}
	return result
}

func processSchedule(ctx context.Context, store reportStore, fx rateProvider, item schedule, periodStart, periodEnd, generatedAt time.Time) (string, error) {
	exists, err := store.ReportExists(ctx, item.UserID, periodStart)
	if err != nil {
		return "", fmt.Errorf("check existing report: %w", err)
	}
	if exists {
		return "skipped", nil
	}

	transactions, err := store.ListTransactions(ctx, item.UserID, periodStart, periodEnd)
	if err != nil {
		return "", fmt.Errorf("list transactions: %w", err)
	}
	accounts, err := store.ListAccounts(ctx, item.UserID)
	if err != nil {
		return "", fmt.Errorf("list accounts: %w", err)
	}
	accountByID := make(map[string]account, len(accounts))
	for _, item := range accounts {
		accountByID[item.ID] = item
	}
	currencies := distinctCurrencies(transactions, accountByID)
	rates := fx.Rates(ctx, currencies)
	report := buildReport(transactions, accountByID, rates)
	csvBytes, err := serializeReportCSV(report, generatedAt, periodStart, periodEnd)
	if err != nil {
		return "", fmt.Errorf("build CSV: %w", err)
	}
	csvPath := item.UserID + "/" + periodStart.Format("2006-01") + ".csv"
	if err := store.UploadCSV(ctx, csvPath, csvBytes); err != nil {
		return "", fmt.Errorf("upload CSV: %w", err)
	}
	created, err := store.InsertReport(ctx, reportRecord{
		UserID: item.UserID, PeriodStart: periodStart.Format("2006-01-02"), PeriodEnd: periodEnd.Format("2006-01-02"),
		GeneratedAt: generatedAt.Format(time.RFC3339Nano), CurrencyGroups: report.CurrencyGroups,
		CategoryTotals: report.CategoryTotals, CSVPath: csvPath,
	})
	if err != nil {
		return "", fmt.Errorf("insert report: %w", err)
	}
	if !created {
		return "skipped", nil
	}
	return "generated", nil
}

func distinctCurrencies(transactions []transaction, accounts map[string]account) []string {
	seen := make(map[string]struct{})
	for _, item := range transactions {
		currency := "Tidak diketahui"
		if item.AccountID != nil {
			if account, ok := accounts[*item.AccountID]; ok {
				currency = account.Currency
			}
		}
		seen[currency] = struct{}{}
	}
	result := make([]string, 0, len(seen))
	for currency := range seen {
		result = append(result, currency)
	}
	sort.Strings(result)
	return result
}

func missingRate(currency string) rateResult {
	return rateResult{Base: currency, Quote: "IDR", State: "missing"}
}

func (client *frankfurterClient) Rates(ctx context.Context, currencies []string) map[string]rateResult {
	result := make(map[string]rateResult, len(currencies))
	for _, currency := range currencies {
		if currency == "IDR" {
			rate := 1.0
			retrievedAt := client.now().UTC().Format(time.RFC3339Nano)
			result[currency] = rateResult{Base: currency, Quote: "IDR", Rate: &rate, RetrievedAt: &retrievedAt, State: "fresh"}
			continue
		}
		if len(currency) != 3 || currency != strings.ToUpper(currency) {
			result[currency] = missingRate(currency)
			continue
		}
		result[currency] = client.fetchRate(ctx, currency)
	}
	return result
}

func (client *frankfurterClient) fetchRate(parent context.Context, currency string) rateResult {
	ctx, cancel := context.WithTimeout(parent, 7*time.Second)
	defer cancel()
	endpoint := client.baseURL.ResolveReference(&url.URL{Path: "/v2/rates"})
	query := endpoint.Query()
	query.Set("base", currency)
	query.Set("quotes", "IDR")
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return missingRate(currency)
	}
	response, err := client.httpClient.Do(req)
	if err != nil {
		return missingRate(currency)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return missingRate(currency)
	}
	var payload []struct {
		Date  string  `json:"date"`
		Base  string  `json:"base"`
		Quote string  `json:"quote"`
		Rate  float64 `json:"rate"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload) != nil || len(payload) != 1 {
		return missingRate(currency)
	}
	item := payload[0]
	if item.Base != currency || item.Quote != "IDR" || item.Date == "" || item.Rate <= 0 || math.IsNaN(item.Rate) || math.IsInf(item.Rate, 0) {
		return missingRate(currency)
	}
	retrievedAt := client.now().UTC().Format(time.RFC3339Nano)
	return rateResult{Base: currency, Quote: "IDR", Rate: &item.Rate, ProviderDate: &item.Date, RetrievedAt: &retrievedAt, State: "fresh"}
}

type totals struct {
	Income  float64
	Expense float64
}

type categoryKey struct {
	Currency string
	Category string
}

func buildReport(transactions []transaction, accounts map[string]account, rates map[string]rateResult) financialReport {
	groups := make(map[string]totals)
	categories := make(map[categoryKey]float64)
	rows := make([]reportRow, 0, len(transactions))
	for _, item := range transactions {
		accountName := "Akun tidak tersedia"
		currency := "Tidak diketahui"
		if item.AccountID != nil {
			if linked, ok := accounts[*item.AccountID]; ok {
				accountName = linked.Name
				currency = linked.Currency
			}
		}
		group := groups[currency]
		if item.Type == "income" {
			group.Income += item.Amount
		} else {
			group.Expense += item.Amount
			categories[categoryKey{Currency: currency, Category: item.Category}] += item.Amount
		}
		groups[currency] = group
		rows = append(rows, reportRow{Transaction: item, Account: accountName, Currency: currency})
	}

	groupCurrencies := make([]string, 0, len(groups))
	for currency := range groups {
		groupCurrencies = append(groupCurrencies, currency)
	}
	sort.Strings(groupCurrencies)
	currencyGroups := make([]currencyGroup, 0, len(groupCurrencies))
	for _, currency := range groupCurrencies {
		item := groups[currency]
		rate, ok := rates[currency]
		if !ok {
			rate = missingRate(currency)
		}
		group := currencyGroup{Currency: currency, Income: item.Income, Expense: item.Expense, Net: item.Income - item.Expense, Rate: rate}
		if rate.Rate != nil {
			income := item.Income * *rate.Rate
			expense := item.Expense * *rate.Rate
			net := (item.Income - item.Expense) * *rate.Rate
			group.ConvertedIncomeIDR, group.ConvertedExpenseIDR, group.ConvertedNetIDR = &income, &expense, &net
		}
		currencyGroups = append(currencyGroups, group)
	}

	categoryTotals := make([]categoryTotal, 0, len(categories))
	for key, amount := range categories {
		categoryTotals = append(categoryTotals, categoryTotal{Currency: key.Currency, Category: key.Category, Amount: amount})
	}
	sort.Slice(categoryTotals, func(i, j int) bool {
		if categoryTotals[i].Currency != categoryTotals[j].Currency {
			return categoryTotals[i].Currency < categoryTotals[j].Currency
		}
		if categoryTotals[i].Amount != categoryTotals[j].Amount {
			return categoryTotals[i].Amount > categoryTotals[j].Amount
		}
		return categoryTotals[i].Category < categoryTotals[j].Category
	})
	return financialReport{CurrencyGroups: currencyGroups, CategoryTotals: categoryTotals, Rows: rows}
}

func neutralizeSpreadsheetCell(value string) string {
	if value != "" && strings.ContainsRune("=+-@", rune(value[0])) {
		return "'" + value
	}
	return value
}

func csvNumber(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func optionalNumber(value *float64) string {
	if value == nil {
		return ""
	}
	return csvNumber(*value)
}

func pointerString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func serializeReportCSV(report financialReport, generatedAt, periodStart, periodEnd time.Time) ([]byte, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	write := func(values ...string) error {
		for index := range values {
			values[index] = neutralizeSpreadsheetCell(values[index])
		}
		return writer.Write(values)
	}
	if err := write("FinTrack report"); err != nil {
		return nil, err
	}
	if err := write("generated_at", generatedAt.UTC().Format(time.RFC3339Nano)); err != nil {
		return nil, err
	}
	if err := write("filters", fmt.Sprintf("%s sampai %s; status confirmed", periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"))); err != nil {
		return nil, err
	}
	if err := write(); err != nil {
		return nil, err
	}
	if err := write("currency", "income", "expense", "net", "income_idr_latest", "expense_idr_latest", "net_idr_latest", "fx_source", "fx_date", "fx_retrieved_at", "fx_state"); err != nil {
		return nil, err
	}
	for _, group := range report.CurrencyGroups {
		source := ""
		if group.Rate.Rate != nil && group.Currency != "IDR" {
			source = "Frankfurter"
		}
		if err := write(group.Currency, csvNumber(group.Income), csvNumber(group.Expense), csvNumber(group.Net), optionalNumber(group.ConvertedIncomeIDR), optionalNumber(group.ConvertedExpenseIDR), optionalNumber(group.ConvertedNetIDR), source, pointerString(group.Rate.ProviderDate), pointerString(group.Rate.RetrievedAt), group.Rate.State); err != nil {
			return nil, err
		}
	}
	if err := write(); err != nil {
		return nil, err
	}
	if err := write("currency", "category", "confirmed_expense"); err != nil {
		return nil, err
	}
	for _, item := range report.CategoryTotals {
		if err := write(item.Currency, item.Category, csvNumber(item.Amount)); err != nil {
			return nil, err
		}
	}
	if err := write(); err != nil {
		return nil, err
	}
	if err := write("date", "type", "merchant", "category", "amount", "currency", "account", "note", "status", "source"); err != nil {
		return nil, err
	}
	for _, row := range report.Rows {
		item := row.Transaction
		if err := write(item.Date, item.Type, pointerString(item.Merchant), item.Category, csvNumber(item.Amount), row.Currency, row.Account, pointerString(item.Note), item.Status, item.Source); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func (client *supabaseClient) ListSchedules(ctx context.Context, periodStart time.Time) ([]schedule, error) {
	query := url.Values{"select": {"user_id"}, "is_active": {"eq.true"}, "enabled_from_period": {"lte." + periodStart.Format("2006-01-02")}, "order": {"user_id.asc"}}
	var result []schedule
	err := client.paginate(ctx, "/rest/v1/monthly_report_schedules", query, &result)
	return result, err
}

func (client *supabaseClient) ReportExists(ctx context.Context, userID string, periodStart time.Time) (bool, error) {
	query := url.Values{"select": {"id"}, "user_id": {"eq." + userID}, "period_start": {"eq." + periodStart.Format("2006-01-02")}, "limit": {"1"}}
	var rows []struct {
		ID string `json:"id"`
	}
	if err := client.doJSON(ctx, http.MethodGet, "/rest/v1/monthly_financial_reports", query, nil, nil, &rows); err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func (client *supabaseClient) ListTransactions(ctx context.Context, userID string, periodStart, periodEnd time.Time) ([]transaction, error) {
	query := url.Values{
		"select":  {"date,type,merchant,category,amount,note,status,source,account_id"},
		"user_id": {"eq." + userID}, "status": {"eq.confirmed"},
		"date":  {"gte." + periodStart.Format("2006-01-02"), "lte." + periodEnd.Format("2006-01-02")},
		"order": {"date.asc,id.asc"},
	}
	var result []transaction
	err := client.paginate(ctx, "/rest/v1/transactions", query, &result)
	return result, err
}

func (client *supabaseClient) ListAccounts(ctx context.Context, userID string) ([]account, error) {
	query := url.Values{"select": {"id,name,currency"}, "user_id": {"eq." + userID}, "order": {"id.asc"}}
	var result []account
	err := client.paginate(ctx, "/rest/v1/financial_accounts", query, &result)
	return result, err
}

func (client *supabaseClient) UploadCSV(ctx context.Context, objectPath string, body []byte) error {
	path := "/storage/v1/object/" + reportBucket + "/" + escapeObjectPath(objectPath)
	headers := http.Header{"Content-Type": {"text/csv; charset=utf-8"}, "x-upsert": {"false"}}
	response, err := client.do(ctx, http.MethodPost, path, nil, headers, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusConflict {
		return nil
	}
	if response.StatusCode == http.StatusBadRequest {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		if bytes.Contains(message, []byte(`"code":"KeyAlreadyExists"`)) {
			return nil
		}
		return fmt.Errorf("HTTP %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}
	return responseError(response)
}

func (client *supabaseClient) InsertReport(ctx context.Context, record reportRecord) (bool, error) {
	headers := http.Header{"Prefer": {"resolution=ignore-duplicates,return=representation"}}
	var rows []struct {
		ID string `json:"id"`
	}
	if err := client.doJSON(ctx, http.MethodPost, "/rest/v1/monthly_financial_reports", nil, headers, record, &rows); err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func escapeObjectPath(value string) string {
	parts := strings.Split(value, "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func (client *supabaseClient) paginate(ctx context.Context, path string, query url.Values, destination any) error {
	offset := 0
	all := reflectSlice(destination)
	for {
		headers := http.Header{"Range-Unit": {"items"}, "Range": {fmt.Sprintf("%d-%d", offset, offset+pageSize-1)}}
		page := all.newPage()
		if err := client.doJSON(ctx, http.MethodGet, path, query, headers, nil, page); err != nil {
			return err
		}
		length := all.appendPage(page)
		if length == 0 {
			return nil
		}
		offset += length
	}
}

// sliceAppender keeps pagination generic without exposing reflection outside this small HTTP boundary.
type sliceAppender struct {
	newPage    func() any
	appendPage func(any) int
}

func reflectSlice(destination any) sliceAppender {
	switch target := destination.(type) {
	case *[]schedule:
		return sliceAppender{func() any { return &[]schedule{} }, func(page any) int { rows := *page.(*[]schedule); *target = append(*target, rows...); return len(rows) }}
	case *[]transaction:
		return sliceAppender{func() any { return &[]transaction{} }, func(page any) int {
			rows := *page.(*[]transaction)
			*target = append(*target, rows...)
			return len(rows)
		}}
	case *[]account:
		return sliceAppender{func() any { return &[]account{} }, func(page any) int { rows := *page.(*[]account); *target = append(*target, rows...); return len(rows) }}
	default:
		panic("unsupported pagination destination")
	}
}

func (client *supabaseClient) doJSON(ctx context.Context, method, path string, query url.Values, headers http.Header, requestBody, responseBody any) error {
	var body io.Reader
	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
		if headers == nil {
			headers = make(http.Header)
		}
		headers.Set("Content-Type", "application/json")
	}
	response, err := client.do(ctx, method, path, query, headers, body)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if err := responseError(response); err != nil {
		return err
	}
	if responseBody == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(io.LimitReader(response.Body, 16<<20)).Decode(responseBody)
}

func (client *supabaseClient) do(ctx context.Context, method, path string, query url.Values, headers http.Header, body io.Reader) (*http.Response, error) {
	endpoint := client.baseURL.ResolveReference(&url.URL{Path: client.baseURL.Path + path})
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", client.serviceKey)
	req.Header.Set("Authorization", "Bearer "+client.serviceKey)
	for key, values := range headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	return client.httpClient.Do(req)
}

func responseError(response *http.Response) error {
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	if len(message) == 0 {
		return fmt.Errorf("HTTP %d", response.StatusCode)
	}
	return fmt.Errorf("HTTP %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
}
