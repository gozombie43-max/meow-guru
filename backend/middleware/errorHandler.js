// middleware/errorHandler.js
// Global catch-all error handler + async route wrapper

/**
 * Express error-handling middleware (4-arg signature).
 * Register AFTER all routes so it catches anything that falls through.
 */
export function errorHandler(err, req, res, _next) {
  console.error("Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
}

/**
 * Wraps an async route handler so rejected promises are forwarded to
 * Express's error-handling middleware instead of crashing the process.
 *
 * Usage:  router.get("/foo", asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
