import { verifyToken } from "../auth/jwt.js";
import { findCurrentAdminUser } from '../repositories/adminUserRepository.js';
import { assertSession } from '../auth/sessions.js';

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

const adminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = verifyToken(authHeader.slice(7));
    await assertSession(decoded);

    const user = await findCurrentAdminUser(decoded.id);
    if (!user || ["suspended", "banned"].includes(user.status)) {
      return res.status(403).json({ error: "Account is not active" });
    }
    if (!ADMIN_ROLES.has(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    req.user = { ...decoded, ...user };
    return next();
  } catch (error) {
    if (!error.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return next(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export { adminAuth };
export default adminAuth;
