// Compatibility method facade. JSON/Response helpers and this facade share the
// same authentication, retries, cancellation, timeout and normalized errors.
// New domain APIs can use request<T> without depending on the adapter's methods.
export { default } from '@/lib/axios';
export * from '@/lib/axios';
export { ApiError } from './error';
