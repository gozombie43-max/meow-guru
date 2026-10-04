# Mobile dark-theme review — 3 October 2026

The existing OLED direction remains: black canvas, charcoal cards, restrained blue actions, and semantic answer/result colors. Changes are selective. Shared palette adjustments apply below 768px; route-specific rules stay with their owning stylesheets.

## Route decisions

| Routes / family | Decision |
| --- | --- |
| Home, Play hub/setup/session, adaptive-quiz redirect | Keep existing layout and cards; inherit mobile palette improvements. |
| Mathematics, Reasoning, English, General Awareness hubs, topics and chapters | Keep the established search, filters, topic hierarchy and card layouts. |
| Subject quizzes, study libraries and formula-note routes | Keep existing task-focused layouts and answer-state styling. |
| Mock-test catalogue, exam landing, instructions, attempt, result and review | Keep existing layouts and semantic states; preserve explicit light exam surfaces. |
| Notes | Redesign library with responsive search/filter controls, readable cards, direct read links, real result counts, empty states and recoverable API errors. Preserve existing API contracts. |
| Notes new/edit | Full-width stacked split panes on phones, scrolling snippet tools, accessible mode state and labels, 44px fields, safe-area header, disabled busy actions. |
| Notes view | Keep existing reading layout. |
| Notifications | Improve secondary-text contrast, reduce empty-state height and decorative borders/shadows, retain unread emphasis. |
| Resources | Add a clear grouped empty state, quieter action styling and consistent mobile card corners. |
| Videos | Group each thumbnail and its metadata into a charcoal card; simplify secondary avatar clutter on phones. |
| Dashboard | Align mobile surfaces and secondary text with shared tokens. |
| Battle and profile/leaderboard/missions/social/rewards | Refine setup cards, selected tabs, secondary text and phone input sizing; retain feature layouts and semantic states. |
| Login/register | Remove the contrasting black rectangle inside the mobile auth card; inherit quieter controls and legible secondary text. |
| Access code, authentication callback | Retain existing layouts. |
| Admin control, question bank, users, notifications, integrity and upload routes | Retain current layouts, progressive disclosure and tools; inherit shared mobile text/action tokens. |
| AI Tutor and internal AI/glass test pages | Retain existing layout. |
| Shared route loading/error recovery | Use readable dark surfaces and text instead of light skeletons and dark-on-black error text. Root error card follows the selected theme. |

## Verification

- Production build passed: 802 generated pages.
- Frontend TypeScript and ESLint passed. The added browser spec also passed the frontend ESLint configuration.
- Shared interface and UI-contract checks passed in both themes at 320, 390, 768, 1366 and 1440px, including bottom safe-area scenarios.
- Existing all-route screenshot suite: all 82 page templates passed at 390×844 in dark mode. Dynamic templates use one representative URL, rather than every generated topic URL.
- Added `e2e/mobile-dark-polish.spec.ts`: four scenarios passed (dark 320px, dark 390px, light 390px, dark 1366px). Checks cover populated Notes, search/clear, read URL, malformed-response recovery, editor mode switching, pane width, document overflow and browser exceptions.
- Visually inspected representative Home, Play, auth, admin, battle, subject, study, mock-test, Notes, notification, resource and video captures.
- Agent-browser confirmed the access-code page renders its four digit inputs and Continue control.
- `git diff --check` passed.

## Limits of this evidence

The route sweep uses the disposable browser fixture. Some endpoints are absent, so those captures show empty/recovery states; this is not live service or production verification. The focused Notes scenarios supply explicit browser-only data. Monaco editing/saving and external image uploads were not exercised end to end.

AI Tutor still emits React hydration error #418 in the route sweep; the same warning exists in the prior capture report. This pass does not claim to resolve it. The screenshot suite records browser warnings rather than failing on them; the focused Notes tests separately assert no browser exceptions.

Pre-existing screenshot scripts, package changes, README edits and ignore rules were preserved. No commit or deployment was made.
