# Mobile Dashboard First-Screen Audit

## Audit scope

- Surface: FinTrack Dashboard in mobile Safari at approximately 375 pixels wide.
- Evidence: user-provided screenshot captured on 20 July 2026.
- User goal: understand the current financial position and next useful action immediately after opening the app.

## Step 1 — Dashboard first screen

Health: needs structural improvement.

### Strengths

- Brand, profile access, selected month, and onboarding continuation are understandable.
- Contrast is generally calm and legible.
- Controls and the primary setup action appear to have comfortable touch sizes.

### UX risks

- The entire first viewport is spent on greeting, title, date, period control, and onboarding. No actual financial value appears above the fold.
- The large two-line title is visually dominant even though it does not help the user decide what to do.
- Month navigation and the separate balance-visibility button consume disproportionate horizontal and vertical space.
- The onboarding card repeats setup context and gives a secondary task more visual weight than the financial dashboard.
- The floating bottom navigation overlaps the first financial card, making the content feel cropped and the viewport feel smaller.
- The black `N` badge is the Next.js development indicator, not product UI. It will not appear in a production build, but it makes this development screenshot look less polished.

### Accessibility risks visible from the screenshot

- The very small bottom-navigation labels may be difficult to read at increased text size.
- The close action on the onboarding card is icon-only and visually faint; its accessible name cannot be confirmed from the screenshot.
- Fixed bottom navigation may obscure content during browser zoom or dynamic toolbar changes unless content padding and safe-area behavior are verified.

## Recommended direction

Use a native-banking mobile hierarchy:

1. Compact brand row.
2. One-line greeting and smaller page title.
3. Financial pulse or net cash-flow value visible immediately.
4. Compact inline month selector beside the period label.
5. Reduce onboarding to a slim continuation banner below the financial pulse.
6. Replace the floating pill with an edge-to-edge bottom tab bar that includes safe-area padding and never covers content.
7. Keep current colors, typography, and restrained premium treatment.

## Evidence limits

- This screenshot proves the visual hierarchy and overlap in one state only.
- Keyboard focus, screen-reader labels, loading behavior, dynamic Safari toolbar behavior, and zoom resilience require browser testing after a redesign is implemented.
