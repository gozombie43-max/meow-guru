// backend/middleware/requireRole.js
// Role-based authorization middleware.
// Must be used AFTER the `protect` middleware which attaches `req.user`.
//
// Usage:
//   router.get('/admin/users', protect, requireRole('admin', 'superadmin'), handler);

/**
 * Role hierarchy (higher index = more privileged):
 *   user (student) → moderator → admin → superadmin
 */
const ROLE_HIERARCHY = ['user', 'moderator', 'admin', 'superadmin'];

/**
 * Returns the canonical role name.
 * Legacy users have role "student" which maps to "user".
 */
const canonicalRole = (role) =>
  role === 'student' ? 'user' : (role || 'user');

/**
 * Returns the numeric privilege level for a role (0-based).
 * Unknown roles default to -1 (no privileges).
 */
export const roleLevel = (role) => {
  const idx = ROLE_HIERARCHY.indexOf(canonicalRole(role));
  return idx >= 0 ? idx : -1;
};

/**
 * Middleware factory.
 * Rejects with 403 if the authenticated user's role is not in the allowed list.
 *
 * @param  {...string} allowedRoles - Canonical role names that are permitted.
 */
export const requireRole = (...allowedRoles) => (req, res, next) => {
  const userRole = canonicalRole(req.user?.role);

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Attach canonical role for downstream use
  req.user._canonicalRole = userRole;

  next();
};

export default requireRole;
