# Meow Frontend — Component & Shared Dependency Inventory (Phase 0 Baseline)

> Audit of `frontend/components/` (77 source files), `frontend/features/` (53 source files), and route-local `_shared/` / `components/` modules.

---

## 1. Existing Design System Primitives (Partial / Fragmented)

| Mechanism | Location | What It Owns | Gaps & Fragmentation |
|---|---|---|---|
| Control attribute contract | `app/interface.css` | `[data-ui-button="primary\|secondary\|danger\|icon\|state"]`, `[data-ui-shape="icon"]`, `[data-ui-chrome="header\|footer"]`, `[data-ui-field]`, `[role="switch"]` | Not a React component library; relies on callers remembering `data-ui-*` attributes. `12` files render `<button>` without `data-ui-button`. No `ghost`, `loading`, or `size` variants. |
| Light / Dark CSS token sheets | `app/light-theme.css`, `app/dark-theme.css`, `app/globals.css` | `--light-*`, `--dark-*`, `--oled-*`, `--ui-*`, `--color-*`, `--glass-*` | **6 competing token namespaces** (`--oled-*`, `--dark-*`, `--light-*`, `--ui-*`, `--color-*`, `--mac-*`), plus route-scoped `--tr-*`, `--quiz-*`, `--tfp-*`. |
| Unstyled Modal Primitive | `components/ui/Dialog.tsx`, `lib/modal-surface.ts` | `Dialog`, `BottomSheet`, `AlertDialog`, `useNativeDialog`, `useModalSurface` | Handles focus trap, `inert` background, Escape & browser back-layer only. **Zero visual styling** — every consumer reimplements backdrops, card surfaces, headers, close buttons, and padding. |
| CSS Module + Theme Bridge | `lib/styleClasses.ts` | `bindStyleClasses(styles)` | Preserves global class names alongside CSS module hashes. Only used by a subset of routes (`ai-chat`, `resource`). |
| Navigation & Guard Controls | `components/BackButton.tsx`, `hooks/useAppNavigation.ts`, `lib/shell-policy.ts` | `BackButton`, `useBackLayer`, `useQuizLeaveGuard`, `hidesPrimaryNavigation` | Many routes bypass `BackButton` and render bespoke `<Link>` or `<button>` back arrows with `.backBtn`, `.backButton`, `.notif-back-btn`, `.fn-back-btn`, etc. |

---

## 2. Inventory by Component Domain

### A. Shell, Navigation & Error Recovery (`components/`)
- `BottomNav.tsx` (122L) + `BottomNavIcons.tsx` (58L) — Mobile/tablet fixed bottom tab bar (`Home`, `Mock`, `Assistant`, `Play`, `You`). Styled by **3 competing sections** in `globals.css`, `dark-theme.css`, `light-theme.css`, and `interface.css`.
- `PageTransitionShell.tsx` (76L) — Route progress bar + transition wrapper.
- `AppRecovery.tsx` (106L) — Chunk/hydration error recovery.
- `SkipToContent.tsx` (20L) — Accessibility skip link.
- `RouteErrorState.tsx` (26L) — Error boundary UI using `.route-boundary*` classes from `globals.css`.
- `RiskyWidgetBoundary.tsx` (58L) — Error boundary for heavy widgets (KaTeX/Konva/Monaco).
- `BackButton.tsx` (8L) — Shared back button with `data-ui-button="icon"` + `ArrowLeft`.
- `NotificationBell.tsx` (43L) + `NotificationBell.module.css` (88L) — Header bell icon + unread badge.
- `UserProfileMenu.tsx` (24L) + `UserProfileMenu.module.css` (1,066L) — Avatar trigger; CSS module is 1,066 lines for legacy menu/settings styles.
- `ExamModeSwitch.tsx` (12L) + `exam-mode.module.css` (488L) — SSC vs IIT JAM switcher.
- `app/(admin)/AdminShell.tsx` (83L) + `AdminShell.module.css` (238L) — Admin sticky header & navigation bar.

### B. Modals, Drawers & Feedback (`components/`)
- `components/ui/Dialog.tsx` (57L) — `Dialog`, `BottomSheet`, `AlertDialog`, `useNativeDialog`, `useModalSurface`.
- `FeedbackToast.tsx` (33L) — Global toast region styled in `globals.css` (`.feedback-toast`).
- `QuizExitDialog.tsx` (61L) + `QuizExitDialog.module.css` (60L) — Native `<dialog>` exit guard.
- `EditProfileModal.tsx` (355L) — Profile editor modal (shares `UserProfileMenu.module.css` or bespoke styles).
- `UserSettingsModal.tsx` (903L) — Large settings modal with theme, audio, and preference controls.
- `SelectionPopover.tsx` (208L) + `SelectionPopoverLazy.tsx` (12L) + `selection-popover.css` (51L) — Custom `<select>` popover enhancer.
- `components/auth/ForgotPasswordModal.tsx` (143L) — Auth password reset dialog.

### C. Foundation, Typography, Rich Content & Brand Artwork (`components/`)
- **Math & Rich Content**: `MathRenderer.tsx` (32L), `MathRendererContent.tsx` (227L), `MathText.tsx` (22L), `formatted-text.tsx` (203L), `RichContent.tsx` (130L), `Typewriter.tsx` (263L), `QuestionImage.tsx` (203L) + `QuestionImage.module.css` (296L), `geometry/GeometryRenderer.tsx` (764L) + `diagramSchema.ts`.
- **Decorative & Brand**: `LiquidGlassText.tsx` (101L), `ShinyPill.tsx` (81L) + `ShinyPill.module.css` (114L), `MacTrafficLights.tsx` (57L) + `MacTrafficLights.module.css` (57L), `GoogleAvatarRing.tsx` (36L) + `GoogleAvatarRing.module.css` (39L), `QuizChartArt.tsx` (99L), `PhysicsArtwork.tsx` (7L), `SubjectIconBadges.tsx` (117L).
- **Custom SVG Icon Components** (mixed alongside `lucide-react`): `AiChatIcon.tsx`, `BattleIcon.tsx`, `BooksIcon.tsx`, `EnglishIcon.tsx`, `GkIcon.tsx`, `MathIcon.tsx`, `MicIcon.tsx`, `ReasoningIcon.tsx`, `WolfIcon.tsx`.
- **Controls**: `LangToggle.tsx` (162L, contains inline `<style>`), `MobileSearchBar.tsx` (3L re-export/legacy stub).

### D. Subject Hubs (`components/subject-hub/` & `app/(app)/english/`)
- `SubjectHub.tsx` (22L), `SubjectHubDesktop.tsx` (775L), `SubjectHubMobile.tsx` (223L), `useSubjectHub.ts` (32L), `useSubjectHubView.tsx` (292L), `MobileSearchBar.tsx` (86L) + `MobileSearchBar.module.css` (149L), `MobileTopicCard.tsx` (97L) + `mobile-topic-card.module.css` (270L), `TopicThumbnail.tsx` (27L), `CatalogSeed.tsx` (12L).
- **Duplication**: `app/(app)/english/EnglishHubClient.tsx` + `english.module.css` (1,926L) maintains a parallel English-specific hub alongside `components/subject-hub/` (`SubjectHub.module.css`, 2,715L), and `general-awareness/_shared/ranked-topic-group-page.tsx` + `RankedTopicGroupPage.module.css` (989L) implements a separate topic-group listing page.

### E. Quiz, Mock Test, Training & Battle Engines (5+ Separate Implementations)
1. **Subject Practice Engine (`features/quiz/`)**:
   - Entry: `QuizEngine.tsx` (140L), `QuizThemeProvider.tsx` (117L), `QuizRouteShell.tsx` (21L), `SubjectTopicPage.tsx` (152L), `SubjectTopicStyles.tsx` (733L inline `<style>`), `TopicPracticeModes.client.tsx` (150L).
   - Start screens: `QuizStartView.tsx` (180L), `SeriesStartViews.tsx` (94L), `IosQuizStartMobile.tsx` (360L), `MacOsQuizStartStudio.tsx` (571L), `IosExamPicker.tsx` (96L).
   - Active views: `MobileQuizView.tsx` (358L), `MobileQuizChrome.tsx` (224L), `MobileQuestionNavigator.tsx` (118L), `MobileQuizMetadata.tsx` (46L), `DesktopQuizView.tsx` (384L), `QuestionPalette.tsx` (210L), `QuizTimer.tsx` (264L), `QuizSettingsModal.tsx` (638L), `QuizResumeDialog.tsx` (68L), `SolutionViews.tsx` (633L), `ResultView.tsx` (607L).
2. **English Study Mode Engines (`app/(app)/english/_shared/`)**:
   - `StudyModeComparisonQuizEngine.tsx` + `StudyModeComparison.module.css` (1,455L)
   - `StudyModeTermsQuizEngine.tsx` (408L, inline `<style>`) + `study-library.module.css` (172L)
   - `study-mode-start.tsx` (inline `<style>`)
3. **Training / Play Engine (`components/training/` & `app/(app)/play/`)**:
   - Hub & Setup: `PlayClient.tsx`, `PlayHub.tsx` (150L), `TrainingSetupDialog.tsx`, `app/(app)/play/setup/[mode]/page.tsx` (419L).
   - Session: `TrainingSessionView.tsx` (159L), `TrainingSessionHeader.tsx` (165L), `TrainingQuestion.tsx` (93L), `TrainingFooter.tsx` (80L), `TrainingPalette.tsx` (129L), `TrainingConfidence.tsx` (44L), `TrainingPace.tsx` (43L), `TrainingFinishDialog.tsx` (54L), `TrainingResults.tsx` (823L), `TrainingInsights.tsx` (283L), `TrainingFilterPicker.tsx` (267L), `TrainingSelectDropdown.tsx` (252L), `TrainingLoading.tsx` (37L).
4. **Mock Test Engine (`app/(app)/mock-test/_shared/`)**:
   - `ExamLandingPage.tsx`, `ExamLandingLoader.tsx`, `TestInstructions.tsx`, `MockCountdown.tsx`, `MockTestEngine.tsx`, `PaperInfoDialog.tsx`, `ResultReport.tsx`, `ResultReportView.tsx`, `ReviewEngine.tsx`, `ReviewQuestionNavigator.tsx`, `MockTestLoading.tsx`.
   - Plus IIT JAM wrapper: `components/JamMockCatalog.tsx` (34L), `JamMockSectionCards.tsx` (35L), `JamQuiz.tsx` (18L).
5. **Battle Engine (`app/(app)/battle/`)**:
   - `battle/page.tsx` (549L) + `components/battle/BattleQuestionCard.tsx` (71L) (reuses `mobile-quiz-view.css` directly!)
   - `battle/_shared/BattleSection.tsx` + `sections.css` (103L) shared by `/battle/leaderboard`, `/battle/missions`, `/battle/profile`, `/battle/social` (but **not** `/battle/rewards`).

### F. AI Chat & Chatbot (`components/QuizChatbot/`, `components/chat/`, `components/ai/`, `app/(app)/ai-chat/`)
- `QuizChatbot/index.tsx` (581L) + `TutorComposer.tsx` (81L) + `TutorMarkdown.tsx` (31L) + `quiz-chatbot.css` (1,460L).
- `app/(app)/ai-chat/page.tsx` (479L) + `ChatComposer.tsx` + `AiChat.module.css` (1,031L) + `components/chat/MessageWindow.tsx` (37L) + `components/ai/VisualResponse.tsx` (631L, inline `<style>`).

### G. Auth & Admin (`components/auth/`, `components/admin/`, `features/admin/`, `features/notifications/`)
- **Auth**: `AuthCard.tsx` (155L), `AuthGoogleButton.tsx` (47L), `AuthInput.tsx` (64L), `EmailOtpLogin.tsx` (114L), `ForgotPasswordModal.tsx` (143L), `PasswordStrengthBar.tsx` (61L) — backed by `auth.module.css` (1,037L) and `verification.module.css` (68L).
- **Admin**: `AdminDisclosure.tsx` (12L), `MockTestManager.tsx` (447L), `QuestionUploadForm.tsx` (382L), `ScheduledNotificationsPanel.tsx` (402L), `BulkTopicImportManager.tsx` (412L), `QuestionBankZipUpload.tsx` (482L), `AdminQuestionDialogs.tsx`, `BulkImageQuestionUpload.tsx`, `PaperQuestionsEditor.tsx`, `AdminUsersTable.tsx`, `AdminUserDetails.tsx`, `AdminUserDeleteDialog.tsx`, `AdminUserNotificationDialog.tsx`, `AdminUserStatusDialog.tsx`, `AdminControlSkeleton.tsx`, `NotificationAnalyticsPanel.tsx`, `NotificationHistory.tsx`.

---

## 3. Duplicated Components & Patterns Summary

| Duplicated Pattern | Existing Implementations |
|---|---|
| **Buttons without shared component** | No `<Button>` React component exists; `105` files apply `data-ui-button="..."` manually, while `12` files render uncontracted `<button>` controls (e.g., `ReviewQuestionNavigator`, `TrainingSetupDialog`, `QuizSettingsModal`, `ExamModeSwitch`, `MobileSearchBar`, `TrainingSelectDropdown`, `check-email`, `reset-password`, `preview-palette`). |
| **Loading Spinners / Skeletons** | **11** separate `.spinner` CSS classes + `@keyframes spin` across admin, auth, profile, mock-test, study-mode, and `QuestionImage`; plus `TrainingLoading`, `MockTestLoading`, `AdminControlSkeleton`, `route-boundary__skeleton` (`globals.css`), and `StudyModeLoading.module.css`. |
| **Modals / Bottom Sheets** | **29** callers wrap `Dialog.tsx` with completely custom CSS/close buttons/headers; **6** (`MockTestEngine`, `ranked-topic-group-page`, `SelectionPopover`, `BulkTopicImportManager`, `preview-palette`) bypass `Dialog.tsx`. |
| **Search Inputs** | Separate search bar UIs in `SubjectHubDesktop`, `MobileSearchBar.tsx`, `RankedTopicGroupPage`, `HomeClient`, `notifications/page.tsx`, `resource/page.tsx`, `battle/social/page.tsx`, `ai-chat/page.tsx`, `TrainingFilterPicker`. |
| **Topic / Subject Cards & Lists** | `HomeClient` cards, `SubjectHubDesktop` macOS window cards, `MobileTopicCard`, `english.module.css` hub cards, `RankedTopicGroupPage`, `mock-test` exam cards, `PlayHub` mode cards. |
| **Quiz Question / Option Cards** | 5 independent UIs: `MobileQuizView`/`DesktopQuizView` (`features/quiz`), `MockTestEngine`, `TrainingQuestion` (`components/training`), `BattleQuestionCard` (`components/battle`), and `StudyModeComparisonQuizEngine`/`StudyModeTermsQuizEngine`. |
| **Subject `_shared` wrappers** | `english/_shared/quiz-engine.tsx`, `general-awareness/_shared/quiz-engine.tsx`, `mathematics/_shared/quiz-engine.tsx`, `reasoning/_shared/quiz-engine.tsx` (and `topic-page.tsx` x4) are thin 10–15 line wrappers around `features/quiz` — well-consolidated on `QuizEngine`, though English study-modes diverge. |
