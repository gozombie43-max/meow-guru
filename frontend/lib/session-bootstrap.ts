import { getAccessToken, requestTokenRefresh } from "./axios";

let preparedSession: Promise<string | null> | null = null;
let restorationStarted = false;

// Start the existing cookie exchange while React is still loading. Keep even a
// null result until the auth provider consumes it, so guests do not refresh twice.
export function prepareSessionRestoration() {
  if (!restorationStarted && !getAccessToken() && !preparedSession) {
    preparedSession = requestTokenRefresh();
  }
}

export function restorePreparedSession(): Promise<string | null> {
  restorationStarted = true;
  const prepared = preparedSession;
  preparedSession = null;
  const token = getAccessToken();
  return token ? Promise.resolve(token) : prepared ?? requestTokenRefresh();
}

export function discardPreparedSession() {
  restorationStarted = true;
  preparedSession = null;
}
