# Backend development

From this directory, run `npm run dev` (or `npm run dev:backend` from the repository root).
The API uses `PORT` from the environment or `.env`, defaulting to `10000`.

Run one backend session per port. If another process already owns the port, development startup
prints a message and waits before loading the API, connecting to MongoDB, or starting workers.
Stop the existing backend with Ctrl+C in its terminal; the waiting session starts automatically.
Ctrl+C also cancels a waiting session. Node's built-in watch mode restarts the API when the
entry point or an imported module changes. Restart the command manually after changing `.env`.

The development command keeps the configured port so the frontend API URL stays valid.
It does not terminate the process already using the port. Production startup (`npm start`)
fails with an explicit port conflict message and shuts down its dependencies.

Check `http://localhost:10000/live` for liveness and `http://localhost:10000/health` for readiness
(substitute your configured port when necessary).

## Resend email smoke test

Set `RESEND_API_KEY` in `backend/.env` (or the backend application's Azure
environment settings). `EMAIL_FROM` is optional and defaults to
`Meow <onboarding@resend.dev>`. Keep the key in the backend environment.

From this directory, run:

```sh
npm run test:email
```

The script sends one message to `delivered@resend.dev`, logs the result, and exits
nonzero for a missing key or failed request. It does not send during API startup.
The reusable client is exported from `services/email/resendClient.js` and
`sendEmail` from `services/email/emailService.js`. Load environment configuration
before importing either module. `sendEmail` returns Resend's data on success and
throws on provider errors; it accepts optional plain-text content alongside HTML.

From the repository root, use `npm run test:email --workspace backend`.
For an Azure-hosted test, deploy the changes first, then run `npm run test:email`
in the backend app directory through App Service SSH/Console. A returned email
ID confirms API acceptance; check the matching email in Resend for its delivered
status. This command creates no public email endpoint. `test:resend` remains an
alias for the same script.

The sender and recipient follow the [official Resend Node.js example](https://resend.com/docs/send-with-nodejs).
Use a verified domain for your own sender address.
