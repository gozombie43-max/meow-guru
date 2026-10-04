# Firebase Gemini Tutor setup

Meow keeps its existing JWT/session login. Before each Gemini message, the
browser calls `POST /auth/firebase/token` with that session. The backend verifies
the active session and uses Firebase Admin to sign a custom token for the Meow
user ID. The browser signs into Firebase Auth, then initializes Firebase AI Logic.
Firebase Auth persistence is in memory; Meow logout clears the Firebase session.
App Check initializes before both Firebase Auth and AI Logic.

## Project setup

1. In the Firebase console, open **Authentication** and complete **Get started**
   if authentication has not been initialized. Custom authentication uses the
   existing Firebase Admin service account; no extra password or anonymous login
   provider is needed.
2. The backend `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
   `FIREBASE_PRIVATE_KEY` must belong to the same project as the frontend's
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and web app configuration.
3. Keep **AI Logic > Settings > Authenticated-users mode** enforced after deploying
   the updated backend and frontend. Older clients without this bridge still fail
   with HTTP 401.
4. Register the web app with **App Check** using reCAPTCHA Enterprise. Set
   `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, authorize the production domains in
   the reCAPTCHA key, and enforce App Check for Firebase AI Logic.
5. Supply all Firebase public configuration from `frontend/.env.example` during
   the frontend build. Next.js embeds `NEXT_PUBLIC_*` values at build time;
   changing runtime settings alone requires a new build to affect the browser.
   Restrict the Firebase web API key to the required Firebase APIs, including
   Firebase AI Logic and Firebase Authentication's Identity Toolkit and Secure
   Token APIs.
6. For localhost, register the development App Check debug token in the console.
   `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` is for development only. Production
   always uses reCAPTCHA Enterprise.

The Gemini request still runs through Firebase AI Logic. Its quotas apply there;
Meow's generation admission and tutor usage quotas apply to the existing Express
tutor provider. The authentication endpoint uses Meow's authentication rate
limiter. Moving Gemini generation to Express is a separate provider migration
that needs server Gemini credentials.

## Verification

Sign into Meow, send a Gemini Tutor message, and check that the custom-token
endpoint and Firebase custom-token sign-in both succeed before the Gemini
request. Verify a nonempty answer from each selectable Gemini model, then log
out and verify that another Gemini request cannot obtain a custom token.

- HTTP 401 from AI Logic: check Firebase sign-in and authenticated-users mode.
- `auth/configuration-not-found`: finish Firebase Authentication setup.
- `auth/custom-token-mismatch`: backend and frontend Firebase projects differ.
- HTTP 403 from AI Logic/App Check: check enforcement, site key, domain allowlist,
  API key restrictions, and registered development debug tokens.

Official references: [AI Logic authentication](https://firebase.google.com/docs/ai-logic/auth-mode?authuser=0),
[custom authentication](https://firebase.google.com/docs/auth/web/custom-auth),
[App Check](https://firebase.google.com/docs/ai-logic/app-check).
