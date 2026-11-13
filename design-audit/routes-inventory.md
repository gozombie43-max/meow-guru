# Meow Frontend — Routes & Layout Inventory (Phase 0 Baseline)

> Generated from static inspection of `frontend/app/` (`86` page routes, `11` layouts, `16` error/loading/not-found boundaries, `6` Next.js API routes). No UI files were modified during this audit.

---

## 1. Summary Metrics

| Category | Count | Notes |
|---|---:|---|
| Page routes (`page.tsx`) | **86** | `(app)`: 67, `(admin)`: 12, `(auth)`: 6, root/dev: 1 |
| Layouts (`layout.tsx`) | **11** | Includes 1 orphaned layout (`app/ai-test/layout.tsx`) with no `page.tsx` |
| Route boundaries (`loading`, `error`, `global-error`, `not-found`) | **16** | `loading.tsx`: 6, `error.tsx`: 8, `global-error.tsx`: 1, `not-found.tsx`: 1 |
| Next.js API routes (`route.ts`) | **6** | `/api/access-code/verify`, `/api/csp-report`, `/api/diagram`, `/api/translate`, `/api/tts`, `/api/upload-image` |
| Prototype / diagnostic routes in `app/` | **3** | `/glass-test`, `/preview-palette`, `/dev/convex-auth` |
| Legacy / alias redirect routes | **2** | `/adaptive-quiz` (redirects to `/play`), `/dashboard/overview` (renders `DashboardPage`) |

---

## 2. Layout Hierarchy & Shell Architecture

| Layout File | Scope | Responsibility & Dependencies |
|---|---|---|
| `frontend/app/layout.tsx` | `/` (all routes) | Imports `globals.css`, `light-theme.css`, `dark-theme.css`, `interface.css`, `@fontsource/noto-sans-bengali`; injects `themeBootstrapScript` (defaults to `dark` via `localStorage['ui-theme']`) & `earlySessionScript`; wraps with `SkipToContent`, `ThemeColor`, `VirtualKeyboardProvider`, `AuthProvider`, `MeowConvexProvider`, `SelectionPopover`. |
| `frontend/app/(app)/layout.tsx` | All student `(app)` routes (67 pages) | Wraps in `ApplicationProviders` (`StyledJsxRegistry`, `ExamModeProvider`, `SWRConfig`), `AppRecovery`, `PageTransitionShell`, `BottomNav`, `FeedbackToast`, `QuizExitDialog`. |
| `frontend/app/(admin)/layout.tsx` | All `(admin)` routes (12 pages) | Wraps in `ApplicationProviders` + `AdminShell` (sticky top nav with 7 tabs, `ExamModeSwitch`, auth/role guard). Does **not** include `BottomNav`, `FeedbackToast`, or `PageTransitionShell`. |
| `frontend/app/(admin)/admin/upload/layout.tsx` | `/admin/upload/*` (5 pages) | Nested inside `AdminShell`; renders a macOS-styled segmented tab window (`macos.module.css`) with emoji icons. |
| `frontend/app/(auth)/layout.tsx` | Auth routes (6 pages) | Minimal `<div id="main-content" tabIndex={-1}>{children}</div>`; **does not** wrap in `ApplicationProviders` (Wait: `login/page.tsx` uses `useAuthActions`? No, check: `AuthProvider` is in root `app/layout.tsx`, while `ExamModeProvider` & `StyledJsxRegistry` are in `(app)`/`(admin)`). |
| `frontend/app/(app)/access-code/layout.tsx` | `/access-code` | Pass-through `<>{children}</>`; comment claims it strips `BottomNav` & page transitions, though it still inherits `(app)/layout.tsx` (`BottomNav` is actually hidden via `shell-policy.ts`). |
| `frontend/app/(app)/adaptive-quiz/layout.tsx` | `/adaptive-quiz` | Pass-through `children` (page immediately `redirect('/play')`). |
| `frontend/app/(app)/ai-chat/layout.tsx` | `/ai-chat` | Imports `./ai-chat.css` and returns `children`. |
| `frontend/app/(app)/battle/layout.tsx` | `/battle/*` (6 pages) | Imports `./battle.css` and wraps in `<div className="battle-route-shell">`. |
| `frontend/app/(app)/play/layout.tsx` | `/play/*` (3 pages) | Auth guard (`useAuth`) redirecting unauthenticated users to `/login`; renders `<main className="min-h-dvh p-6">` while restoring session. |
| `frontend/app/ai-test/layout.tsx` | `/ai-test` | **Orphaned layout** — wraps `ApplicationProviders` + `#main-content`, no `page.tsx` exists under `app/ai-test/`. |

---

## 3. Primary Navigation (`BottomNav`) Visibility Policy

Controlled by `frontend/lib/shell-policy.ts` (`hidesPrimaryNavigation(pathname)`):
- **Visible on**: `/`, `/mock-test` (root catalog only), `/play` (hub only), `/profile`, `/mathematics`, `/mathematics/[topic]`, `/reasoning`, `/reasoning/[topic]`, `/english`, `/english/[topic]`, `/general-awareness`, `/general-awareness/[topic]`, `/general-awareness/[topic]/[chapter]`, `/subjects/[subject]/[topic]`, `/subjects/[subject]/[topic]/[chapter]`, `/glass-test`, `/preview-palette`, `/battle/rewards` (**bug/omission**: `/battle/rewards` is NOT in `shell-policy.ts` unlike all other `/battle/*` routes).
- **Hidden on**: Any route containing `/quiz`, any `formula-notes` under the 4 subjects, `/play/session/*`, `/play/setup/*`, `/resource`, `/access-code`, `/dashboard*`, `/notifications`, `/ai-chat`, `/mock-test/*` (all nested mock-test routes), `/battle`, `/battle/profile`, `/battle/leaderboard`, `/battle/missions`, `/battle/social`, and `/english/{synonyms-antonyms,one-word-substitution,idioms-phrases}/study-mode*`.
  - **Note on study-mode omission**: `/english/homonyms-homophones/study-mode` and `/english/spelling-misspelled-words/study-mode` are NOT listed in `shell-policy.ts`, so `BottomNav` stays visible on those two while hidden on the other three study-mode roots.

---

## 4. Complete Route Inventory (86 Routes)

### A. Core App & Dashboard Routes (9 routes)

| Route | File | Mode | Nav | CSS / Style Source | Proposed Template |
|---|---|---|---|---|---|
| `/` | `app/(app)/page.tsx` | Server + `HomeClient` | Shown (mobile dock + desktop rail) | `app/(app)/page.module.css` (2,089L), `recent-quiz.module.css`, `mobile-hero-carousel.module.css`, `home-card-artwork.module.css` | **Dashboard** |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Client | Hidden | `app/(app)/dashboard/page.module.css` (60L) | **Dashboard** / **Analytics** |
| `/dashboard/overview` | `app/(app)/dashboard/overview/page.tsx` | Client (re-exports `/dashboard`) | Hidden | Same as `/dashboard` | **Dashboard** (consolidate/redirect) |
| `/profile` | `app/(app)/profile/page.tsx` | Server + `ProfileClient` | Shown | `app/(app)/profile/profile.module.css` (69L) | **Dashboard** / **Configuration** |
| `/notifications` | `app/(app)/notifications/page.tsx` | Client | Hidden | `app/(app)/notifications/notifications.css` (755L) | **Listing** |
| `/resource` | `app/(app)/resource/page.tsx` | Client | Hidden | `app/(app)/resource/Resource.module.css` (883L) | **Listing** |
| `/ai-chat` | `app/(app)/ai-chat/page.tsx` | Client | Hidden | `ai-chat.css`, `AiChat.module.css` (1,031L), `AiChat.globals.css` | **Interactive Tool (Chat)** |
| `/access-code` | `app/(app)/access-code/page.tsx` | Client | Hidden | `app/(app)/access-code/page.module.css` (358L) | **Auth / Utility** |
| `/adaptive-quiz` | `app/(app)/adaptive-quiz/page.tsx` | Server (`redirect('/play')`) | N/A | None | Legacy redirect |

### B. Subject Hubs, Topics, Notes & Practice Quizzes (41 routes)

| Route | File | Mode | Nav | CSS / Style Source | Proposed Template |
|---|---|---|---|---|---|
| `/mathematics` | `app/(app)/mathematics/page.tsx` | Server + `MathematicsHubClient` | Shown | `components/SubjectHub.module.css` (2,715L), `mobile-topic-card.module.css`, `MobileSearchBar.module.css` | **Listing** |
| `/mathematics/[topic]` | `app/(app)/mathematics/[topic]/page.tsx` | Server + `SubjectTopicPage` | Shown | `features/quiz/components/SubjectTopicStyles.tsx` (733L `<style>`) | **Configuration / Topic Start** |
| `/mathematics/[topic]/formula-notes` | `app/(app)/mathematics/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | `FormulaNotes.module.css` (695L), `FormulaNotes.globals.css` | **Content / Notes** |
| `/mathematics/[topic]/quiz` | `app/(app)/mathematics/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | `QuizStyles.tsx` (343L `<style>`), `mobile-quiz-view.css` (2,384L), `DesktopQuizView.css` (749L), `SeriesStartViews.module.css` (1,844L), `ResultView.module.css` (963L) | **Quiz** |
| `/mathematics/arithmetic/[topic]` | `app/(app)/mathematics/arithmetic/[topic]/page.tsx` | Server + `SubjectTopicPage` | Shown | Same as `/mathematics/[topic]` | **Configuration / Topic Start** |
| `/mathematics/arithmetic/[topic]/formula-notes` | `app/(app)/mathematics/arithmetic/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | Same as `formula-notes` | **Content / Notes** |
| `/mathematics/arithmetic/[topic]/quiz` | `app/(app)/mathematics/arithmetic/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `/mathematics/[topic]/quiz` | **Quiz** |
| `/mathematics/advance/[topic]` | `app/(app)/mathematics/advance/[topic]/page.tsx` | Server + `SubjectTopicPage` | Shown | Same as `/mathematics/[topic]` | **Configuration / Topic Start** |
| `/mathematics/advance/[topic]/formula-notes` | `app/(app)/mathematics/advance/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | Same as `formula-notes` | **Content / Notes** |
| `/mathematics/advance/[topic]/quiz` | `app/(app)/mathematics/advance/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `/mathematics/[topic]/quiz` | **Quiz** |
| `/mathematics/mensuration/formula-notes` | `app/(app)/mathematics/mensuration/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | Same as `formula-notes` | **Content / Notes** |
| `/mathematics/trigonometry/formula-notes` | `app/(app)/mathematics/trigonometry/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | Same as `formula-notes` | **Content / Notes** |
| `/reasoning` | `app/(app)/reasoning/page.tsx` | Server + `ReasoningHubClient` | Shown | `components/SubjectHub.module.css` | **Listing** |
| `/reasoning/[topic]` | `app/(app)/reasoning/[topic]/page.tsx` | Server + `SubjectTopicPage` | Shown | `SubjectTopicStyles.tsx` | **Configuration / Topic Start** |
| `/reasoning/[topic]/formula-notes` | `app/(app)/reasoning/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | `FormulaNotes.module.css` | **Content / Notes** |
| `/reasoning/[topic]/quiz` | `app/(app)/reasoning/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `QuizEngine` | **Quiz** |
| `/english` | `app/(app)/english/page.tsx` | Server + `EnglishHubClient` | Shown | `app/(app)/english/english.module.css` (1,926L — **duplicate of SubjectHub.module.css!**) | **Listing** |
| `/english/[topic]` | `app/(app)/english/[topic]/page.tsx` | Server + `SubjectTopicPage` | Shown | `SubjectTopicStyles.tsx` | **Configuration / Topic Start** |
| `/english/[topic]/formula-notes` | `app/(app)/english/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | `FormulaNotes.module.css` | **Content / Notes** |
| `/english/[topic]/quiz` | `app/(app)/english/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `QuizEngine` | **Quiz** |
| `/english/homonyms-homophones/study-mode` | `app/(app)/english/homonyms-homophones/study-mode/page.tsx` | Client (`StudyModeStart`) | **Shown** (policy omission) | Inline `<style>` in `study-mode-start.tsx` | **Configuration / Start** |
| `/english/homonyms-homophones/study-mode/quiz` | `app/(app)/english/homonyms-homophones/study-mode/quiz/page.tsx` | Server + `StudyModeComparisonQuizEngine` | Hidden | `StudyModeComparison.module.css` (1,455L) | **Quiz** |
| `/english/idioms-phrases/study-mode` | `app/(app)/english/idioms-phrases/study-mode/page.tsx` | Client | Hidden | `english/idioms-phrases/study-mode/page.module.css` (437L) | **Configuration / Start** |
| `/english/idioms-phrases/study-mode/quiz` | `app/(app)/english/idioms-phrases/study-mode/quiz/page.tsx` | Server + `StudyModeTermsQuizEngine` | Hidden | Inline `<style>` in `StudyModeTermsQuizEngine.tsx` | **Quiz** |
| `/english/one-word-substitution/study-mode` | `app/(app)/english/one-word-substitution/study-mode/page.tsx` | Client | Hidden | `StudyModeStart` inline `<style>` | **Configuration / Start** |
| `/english/one-word-substitution/study-mode/quiz` | `app/(app)/english/one-word-substitution/study-mode/quiz/page.tsx` | Server + `StudyModeTermsQuizEngine` + `WordList` | Hidden | `study-library.module.css` (172L) + inline `<style>` | **Quiz** |
| `/english/spelling-misspelled-words/study-mode` | `app/(app)/english/spelling-misspelled-words/study-mode/page.tsx` | Client | **Shown** (policy omission) | `StudyModeStart` inline `<style>` | **Configuration / Start** |
| `/english/spelling-misspelled-words/study-mode/quiz` | `app/(app)/english/spelling-misspelled-words/study-mode/quiz/page.tsx` | Server + `StudyModeTermsQuizEngine` | Hidden | Inline `<style>` | **Quiz** |
| `/english/synonyms-antonyms/study-mode` | `app/(app)/english/synonyms-antonyms/study-mode/page.tsx` | Client | Hidden | `StudyModeStart` inline `<style>` | **Configuration / Start** |
| `/english/synonyms-antonyms/study-mode/quiz` | `app/(app)/english/synonyms-antonyms/study-mode/quiz/page.tsx` | Server + `StudyModeComparisonQuizEngine` | Hidden | `StudyModeComparison.module.css` (1,455L) | **Quiz** |
| `/general-awareness` | `app/(app)/general-awareness/page.tsx` | Server + `GeneralAwarenessHubClient` | Shown | `components/SubjectHub.module.css` | **Listing** |
| `/general-awareness/[topic]` | `app/(app)/general-awareness/[topic]/page.tsx` | Server + `RankedTopicGroupPage` / `SubjectTopicPage` | Shown | `RankedTopicGroupPage.module.css` (989L) or `SubjectTopicStyles.tsx` | **Listing** / **Topic Start** |
| `/general-awareness/[topic]/formula-notes` | `app/(app)/general-awareness/[topic]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | `FormulaNotes.module.css` | **Content / Notes** |
| `/general-awareness/[topic]/quiz` | `app/(app)/general-awareness/[topic]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `QuizEngine` | **Quiz** |
| `/general-awareness/[topic]/[chapter]` | `app/(app)/general-awareness/[topic]/[chapter]/page.tsx` | Server + `SubjectTopicPage` | Shown | `SubjectTopicStyles.tsx` | **Configuration / Topic Start** |
| `/general-awareness/[topic]/[chapter]/formula-notes` | `app/(app)/general-awareness/[topic]/[chapter]/formula-notes/page.tsx` | Server + `FormulaNotesPage` | Hidden | `FormulaNotes.module.css` | **Content / Notes** |
| `/general-awareness/[topic]/[chapter]/quiz` | `app/(app)/general-awareness/[topic]/[chapter]/quiz/page.tsx` | Server + `QuizEngine` | Hidden | Same as `QuizEngine` | **Quiz** |
| `/subjects/[subject]/[topic]` | `app/(app)/subjects/[subject]/[topic]/page.tsx` | Server + `RankedTopicGroupPage` (IIT JAM) | Shown | `RankedTopicGroupPage.module.css` (989L) | **Listing** |
| `/subjects/[subject]/[topic]/quiz` | `app/(app)/subjects/[subject]/[topic]/quiz/page.tsx` | Server + `JamQuiz` | Hidden | `QuizEngine` styles | **Quiz** |
| `/subjects/[subject]/[topic]/[chapter]` | `app/(app)/subjects/[subject]/[topic]/[chapter]/page.tsx` | Server + `SubjectTopicPage` | Shown | `SubjectTopicStyles.tsx` | **Configuration / Topic Start** |
| `/subjects/[subject]/[topic]/[chapter]/quiz` | `app/(app)/subjects/[subject]/[topic]/[chapter]/quiz/page.tsx` | Server + `JamQuiz` | Hidden | `QuizEngine` styles | **Quiz** |

### C. Mock Tests, Training Play & Battle Routes (15 routes)

| Route | File | Mode | Nav | CSS / Style Source | Proposed Template |
|---|---|---|---|---|---|
| `/mock-test` | `app/(app)/mock-test/page.tsx` | Client | Shown | `app/(app)/mock-test/page.module.css` (1,449L) | **Listing** |
| `/mock-test/[examSlug]` | `app/(app)/mock-test/[examSlug]/(landing)/page.tsx` | Server + `ExamLandingPage` | Hidden | `ExamLandingPage.module.css` (1,084L) | **Listing** |
| `/mock-test/[examSlug]/[testId]` | `app/(app)/mock-test/[examSlug]/[testId]/page.tsx` | Server + `TestInstructions` | Hidden | `TestInstructions.module.css` (72L) + `MockTestLoading.module.css` | **Configuration** |
| `/mock-test/[examSlug]/[testId]/attempt` | `app/(app)/mock-test/[examSlug]/[testId]/attempt/page.tsx` | Server + `MockTestEngine` | Hidden | `MockTestEngine.module.css` (852L) | **Quiz** |
| `/mock-test/[examSlug]/[testId]/result/[attemptId]` | `app/(app)/mock-test/[examSlug]/[testId]/result/[attemptId]/page.tsx` | Server + `ResultReport` | Hidden | `ResultReport.module.css` (208L) | **Analytics** |
| `/mock-test/[examSlug]/[testId]/review/[attemptId]` | `app/(app)/mock-test/[examSlug]/[testId]/review/[attemptId]/page.tsx` | Server + `ReviewEngine` | Hidden | `ReviewEngine.module.css` (153L) | **Quiz / Review** |
| `/play` | `app/(app)/play/page.tsx` | Server + `PlayClient` / `PlayHub` | Shown | `play.css` (798L), `play-hub.css` (1,660L) | **Dashboard / Listing** |
| `/play/setup/[mode]` | `app/(app)/play/setup/[mode]/page.tsx` | Client | Hidden | `play/setup/[mode]/setup.css` (595L) | **Configuration** |
| `/play/session/[id]` | `app/(app)/play/session/[id]/page.tsx` | Server + `TrainingSessionView` | Hidden | `play.css`, `training-session.css` (2,852L) | **Quiz** (+ **Analytics** on finish) |
| `/battle` | `app/(app)/battle/page.tsx` | Client | Hidden | `battle.css` (512L), `mobile-quiz-view.css` (2,384L) | **Configuration** (Lobby) + **Quiz** (Arena) |
| `/battle/leaderboard` | `app/(app)/battle/leaderboard/page.tsx` | Client | Hidden | `battle.css`, `sections.css` (103L) | **Analytics / Listing** |
| `/battle/missions` | `app/(app)/battle/missions/page.tsx` | Client | Hidden | `battle.css`, `sections.css` | **Listing** |
| `/battle/profile` | `app/(app)/battle/profile/page.tsx` | Client | Hidden | `battle.css`, `sections.css` | **Analytics / Dashboard** |
| `/battle/social` | `app/(app)/battle/social/page.tsx` | Client | Hidden | `battle.css`, `sections.css` | **Listing** |
| `/battle/rewards` | `app/(app)/battle/rewards/page.tsx` | Client | **Shown** (bug — omitted from `shell-policy.ts`) | Tailwind utility classes (`bg-slate-50`, `bg-violet-700`) | **Listing** |

### D. Authentication Routes (6 routes)

| Route | File | Mode | Nav | CSS / Style Source | Proposed Template |
|---|---|---|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Client | None | `components/auth/auth.module.css` (1,037L) | **Auth / Form** |
| `/register` | `app/(auth)/register/page.tsx` | Client | None | `components/auth/auth.module.css` (1,037L) | **Auth / Form** |
| `/check-email` | `app/(auth)/check-email/page.tsx` | Client | None | `components/auth/verification.module.css` (68L) | **Auth / Status** |
| `/verify-email` | `app/(auth)/verify-email/page.tsx` | Client | None | `components/auth/verification.module.css` (68L) | **Auth / Status** |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | Client | None | `components/auth/verification.module.css` (68L) | **Auth / Form** |
| `/auth/callback` | `app/(auth)/auth/callback/page.tsx` | Client | None | Minimal inline/default | **Auth / Status** |

### E. Admin Routes (12 routes)

| Route | File | Mode | Nav | CSS / Style Source | Proposed Template |
|---|---|---|---|---|---|
| `/admincontrol` | `app/(admin)/admincontrol/page.tsx` | Client | `AdminShell` | `AdminControlPage.module.css` (32L) | **Dashboard** (Admin) |
| `/admin` | `app/(admin)/admin/page.tsx` | Client | `AdminShell` | `AdminLayout.module.css` (27L), `QuestionBank.module.css` (72L) | **Listing / CRUD** (Admin) |
| `/admin/battle-integrity` | `app/(admin)/admin/battle-integrity/page.tsx` | Client | `AdminShell` | `BattleIntegrity.module.css` (5L) | **Analytics / Table** (Admin) |
| `/admin/mock-pyq` | `app/(admin)/admin/mock-pyq/page.tsx` | Client | `AdminShell` | `papers.module.css` (59L) | **Listing / Editor** (Admin) |
| `/admin/notifications` | `app/(admin)/admin/notifications/page.tsx` | Client | `AdminShell` | `AdminNotificationsPage.module.css` (1,097L) | **Configuration / Form** (Admin) |
| `/admin/users` | `app/(admin)/admin/users/page.tsx` | Client | `AdminShell` | `AdminUsersPage.module.css` (1,064L) | **Listing / Table** (Admin) |
| `/admin/upload` | `app/(admin)/admin/upload/page.tsx` | Server | `AdminShell` + `AdminUploadLayout` | `upload.module.css` (186L), `macos.module.css` (7L) | **Dashboard** (Admin) |
| `/admin/upload/question` | `app/(admin)/admin/upload/question/page.tsx` | Server | `AdminShell` + `AdminUploadLayout` | `AdminTool.module.css` | **Configuration / Form** (Admin) |
| `/admin/upload/bulk` | `app/(admin)/admin/upload/bulk/page.tsx` | Server | `AdminShell` + `AdminUploadLayout` | `BulkTopicImportManager.module.css` (766L) | **Configuration / Form** (Admin) |
| `/admin/upload/mock-tests` | `app/(admin)/admin/upload/mock-tests/page.tsx` | Server | `AdminShell` + `AdminUploadLayout` | `AdminTool.module.css` | **Configuration / Form** (Admin) |
| `/admin/upload/assets` | `app/(admin)/admin/upload/assets/page.tsx` | Client | `AdminShell` + `AdminUploadLayout` | `AdminTool.module.css` (389L) | **Configuration / Form** (Admin) |
| `/admin/upload-image` | `app/(admin)/admin/upload-image/page.tsx` | Client | `AdminShell` | `AdminTool.module.css` (389L) | **Configuration / Form** (Admin) |

### F. Prototype / Dev Routes (3 routes)

| Route | File | Mode | Nav | CSS / Style Source | Recommendation |
|---|---|---|---|---|---|
| `/glass-test` | `app/(app)/glass-test/page.tsx` | Server | Shown | `LiquidGlassText` `<style jsx>` + `min-h-dvh` | Remove or move to dev-only |
| `/preview-palette` | `app/(app)/preview-palette/page.tsx` | Client | Shown | 100% inline `style={{...}}`, `100vh`, `alert()` | Remove or move to dev-only |
| `/dev/convex-auth` | `app/dev/convex-auth/page.tsx` | Server (`notFound()` outside dev) | None | Tailwind `min-h-screen` | Dev-only diagnostics |

---

## 5. Modal, Sheet & Overlay-Based Experiences

35 files define modal/dialog/sheet UIs; **29** wrap `@/components/ui/Dialog` (`Dialog`, `BottomSheet`, `AlertDialog`, `useNativeDialog`, `useModalSurface`) for focus/escape/back-layer handling while owning custom CSS presentation, and **6** bypass `Dialog.tsx` entirely:

- **App-global / Auth / Profile**: `QuizExitDialog`, `EditProfileModal`, `UserSettingsModal`, `UserProfileMenu` (dropdown/sheet), `ForgotPasswordModal`, `SelectionPopover`, Home mobile sidebar drawer (`HomeClient.tsx`).
- **Quiz & Study Mode**: `QuizSettingsModal`, `QuizResumeDialog`, `QuestionPalette` (desktop/mobile), `MobileQuestionNavigator`, `MobileQuizMetadata` (popover/sheet), `SolutionViews` (bottom sheet), `IosExamPicker` (sheet), `QuestionImage` (zoom lightbox), `QuizChatbot` (floating AI drawer), `StudyModeComparisonQuizEngine` (sheet), `formula-notes-page.tsx` (modal), `ranked-topic-group-page.tsx` (**custom** modal), `preview-palette/page.tsx` (**custom** bottom sheet).
- **Mock Test & Training**: `MockTestEngine` (**custom** submit/palette modals), `PaperInfoDialog`, `ReviewEngine` (filter/navigator dialogs), `TrainingSetupDialog`, `TrainingFinishDialog`, `TrainingFilterPicker` (portalled bottom sheet/dialog).
- **Battle**: `BattlePage` (exit/rematch/info dialogs).
- **Resources & AI Chat**: `ResourceUploadDialog`, `ResourcePage` (section picker sheet), `AiChatPage` (image preview dialog + mobile sidebar drawer).
- **Admin**: `AdminQuestionDialogs`, `AdminUserDeleteDialog`, `AdminUserNotificationDialog`, `AdminUserStatusDialog`, `AdminNotificationsPage` (preview dialog), `ScheduledNotificationsPanel`, `BulkTopicImportManager` (**custom** dialog).
