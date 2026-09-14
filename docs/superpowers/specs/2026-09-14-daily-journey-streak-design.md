# Daily Financial Journey Streak

## Purpose

Encourage a short, intentional financial review each day without treating a login as progress. The feature extends Financial Journey and works in both Indonesian and English.

## User experience

The dashboard Journey summary shows the active streak when Journey data is available: `🔥 3 hari berturut-turut` in Indonesian and `🔥 3 days in a row` in English. It also tells the user to finish one review today to continue the streak.

The Journey page adds a compact streak card above weekly missions. It shows the current streak, the longest streak, a seven-day WIB timeline, and one daily action when today has not been checked in. The action is presented as a self-confirmation after the user has completed a review. After a successful save, it becomes a completed state for that day.

Every new string follows the existing `LanguageProvider` convention. Indonesian is the default and English uses the selected `en` language state. Dates and the daily boundary use Asia/Jakarta.

## Rules

- A daily check-in represents a completed financial review, not authentication or page visits.
- A user can create only one check-in per calendar day in WIB.
- A daily check-in awards no XP and does not alter the three weekly missions or their XP.
- The current streak is the consecutive run ending today when today is checked in; otherwise it is zero after the day has passed.
- The longest streak is the largest consecutive run ever recorded.
- A missed day ends the active run but does not remove historic check-ins or the longest-streak record.

## Data and server boundary

A new user-scoped table stores one activity date per user. Row-level access allows the owner to read only their entries; mutations are restricted to a security-definer RPC. A new completion RPC derives the current WIB date on the server, inserts idempotently, and returns the full Journey payload. `get_financial_journey` is extended with a structured streak field: current count, longest count, whether today is checked in, and seven activity dates/statuses.

The browser parses this payload with Zod before rendering. It never calculates or persists a date from the client. RPC errors keep the existing Journey error-and-retry behavior and do not optimistically show a check-in.

## Components and testing

`JourneySummary` renders the translated compact streak line. `FinancialJourney` renders the translated detail card, the daily confirmation control, loading/saved/error states, and a screen-reader label for the seven-day timeline. The shared Journey hook adds a separate daily save state to prevent duplicate submissions.

Unit tests cover payload parsing and streak labels. SQL tests cover WIB dates, idempotency, access control, current-streak reset, and longest-streak calculation. Playwright mocks and Journey tests cover desktop and mobile completion, language switching, and failure recovery.

## Scope

The work adds only the daily streak. It does not introduce notifications, login rewards, XP rewards, badges, reminders, or changes to weekly mission rules.
