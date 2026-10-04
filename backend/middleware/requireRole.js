// backend/middleware/requireRole.js
// @ts-check
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
/** @param {string | undefined} role */
const canonicalRole = (role) =>
  role === 'student' ? 'user' : (role || 'user');

/**
 * Returns the numeric privilege level for a role (0-based).
 * Unknown roles default to -1 (no privileges).
 */
/** @param {string | undefined} role */
export const roleLevel = (role) => {
  const idx = ROLE_HIERARCHY.indexOf(canonicalRole(role));
  return idx >= 0 ? idx : -1;
};

/**
 * Middleware factory.
 * Rejects with 403 if the authenticated user's role is not in the allowed list.
 *
 * @param  {...string} allowedRoles - Canonical role names that are permitted.
 * @returns {(req: { user?: { role?: string, _canonicalRole?: string } }, res: { status: (code: number) => { json: (body: unknown) => unknown } }, next: () => unknown) => unknown}
 */
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const userRole = canonicalRole(req.user?.role);

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Attach canonical role for downstream use
  req.user._canonicalRole = userRole;

  next();
};

export default requireRole;
