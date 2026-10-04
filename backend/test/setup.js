// Explicit fixtures; runtime code has no fallback credentials.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret-only-for-isolated-tests-0001';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-only-for-isolated-tests-0002';
delete process.env.DEPLOYMENT_ENVIRONMENT;
