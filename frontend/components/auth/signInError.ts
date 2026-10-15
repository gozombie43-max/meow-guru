export function signInErrorMessage(error: unknown): string {
  const failure = error as { status?: number; response?: { status?: number; data?: { error?: string } } };
  const status = failure?.response?.status ?? failure?.status;
  if (!status || status >= 500) return 'Unable to reach the sign-in service. Please try again shortly.';
  return failure?.response?.data?.error || 'Unable to sign in. Please try again.';
}
