export function signInErrorMessage(error: unknown): string {
  const failure = error as { status?: number; response?: { status?: number; data?: { error?: string } } };
  const status = failure?.response?.status ?? failure?.status;
  if (!status || status === 502 || status === 504) return 'Unable to reach the sign-in service. Please try again shortly.';
  // The server answered but could not complete the request (e.g. 503 when the code email could not be sent).
  if (status >= 500) return failure?.response?.data?.error || 'Unable to reach the sign-in service. Please try again shortly.';
  return failure?.response?.data?.error || 'Unable to sign in. Please try again.';
}
