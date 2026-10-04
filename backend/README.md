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
