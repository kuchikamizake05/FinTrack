# Auth Single-Card Design

## Context

The current authentication page presents a large editorial hero, three benefit summaries, and the login card with similar visual weight. This splits attention between marketing content and the task users came to complete: signing in or creating an account.

The selected direction is **Minimal Header**: preserve the FinTrack brand and language switcher in a quiet header, remove all marketing content, and center one authentication card in the remaining viewport.

## Goals

- Make the authentication card the immediate and unambiguous focal point.
- Reduce visual and vertical density without shrinking touch targets.
- Preserve the mint FinTrack atmosphere and the typography established on the landing page.
- Keep login, registration, password recovery, password update, and Google OAuth behavior unchanged.
- Improve the password field with an accessible show/hide control.
- Implement directly on `main`, as requested.

## Non-goals

- Redesigning the landing page or authenticated application screens.
- Changing authentication APIs, validation rules, routing, or Supabase configuration.
- Removing the language switcher or privacy reassurance.
- Forcing every authentication mode to fit without scrolling on unusually short screens.

## Layout

The page retains its existing mint dotted gradient and uses Manrope for UI copy. The display-only marketing column, including its headline, description, and benefit list, is removed.

A minimal header remains at the top:

- FinTrack brand lockup on the left.
- Compact ID/EN language switcher on the right.
- A subtle divider to preserve orientation without competing with the card.

Below the header, the main region contains a single authentication card centered horizontally and vertically. The card uses a maximum width of 400 pixels, with 16-pixel page gutters. The main region has a minimum height equal to the viewport minus the header and 12 pixels of vertical padding. When card content is taller than that space, the main region expands and the document scrolls.

The card keeps the current content order:

1. Secure-access badge, title, and short description.
2. Login/register segmented control.
3. Google OAuth action and email divider.
4. Email and password fields.
5. Primary action.
6. Privacy reassurance.

Spacing is tightened to an 8–12 pixel vertical rhythm while preserving 44-pixel minimum interactive targets. Card padding is 20 pixels from the 640-pixel breakpoint upward and 16 pixels below it.

## Password Interaction

The password field gains an icon button at its right edge that toggles between masked and visible text. Each password field owns its visibility state independently, including the confirmation field used during registration and password updates.

The control must:

- Use `type="button"` so it never submits the form.
- Expose a translated accessible label describing the next action.
- Show distinct eye and eye-off icons.
- Preserve the existing password value, validation, autocomplete value, and disabled state.

For login mode, the “Lupa kata sandi?” action moves into the password label row. It remains a button and retains the existing transition to recovery mode. Registration and password-update labels do not show this action.

## Responsive Behavior

- At desktop widths, the card is centered in the viewport area below the header.
- On phones, the card fills the available width inside 16-pixel gutters.
- On short screens, the card aligns with safe vertical padding and the page scrolls naturally.
- Registration, recovery feedback, validation errors, and password-update content must remain reachable at every tested viewport.
- No horizontal scrolling is allowed.

## Accessibility

- Existing labels and autocomplete attributes remain intact.
- Password visibility controls have accessible names and visible focus states.
- The segmented control, OAuth button, recovery action, and submit button retain their existing semantics.
- Focus order follows the visual order.
- Color contrast and minimum target sizes remain at least as strong as the current implementation.

## Error Handling and Data Flow

Authentication handlers, validation, error mapping, routing, and Supabase calls are unchanged. The new password visibility state is presentation-only and does not enter authentication data flow.

Existing alert and status regions remain inside the card. When feedback increases the card height, the document expands rather than clipping the message.

## Testing

Playwright coverage will verify:

- The page contains no marketing hero or benefit summaries.
- The auth card is the only main content region and is centered on desktop.
- The complete login card remains visible at a 1280×640 viewport.
- Registration and other taller modes remain vertically reachable.
- The password visibility button changes the input type without changing its value.
- Existing auth and typography regression tests continue to pass on desktop and mobile projects.

Static validation includes ESLint, TypeScript type checking, production build coverage through Playwright, and the existing security audit before any later commit or push workflow.

## Acceptance Criteria

- A user landing on `/login` sees a quiet header and one centered authentication card.
- The previous left-side headline, marketing copy, and benefit row are absent.
- The card is visibly more compact while all interactive targets remain usable.
- “Lupa kata sandi?” appears alongside the login password label.
- Password fields can be shown and hidden accessibly.
- Login, signup, recovery, update-password, Google OAuth, language switching, and safe redirects preserve current behavior.
- Automated layout, interaction, lint, type, and security checks pass.
