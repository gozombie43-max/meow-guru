import { verifyToken, isRevoked } from "../auth/jwt.js";

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = verifyToken(authHeader.slice(7));
    if (decoded.jti && isRevoked(decoded.jti)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    if (!ADMIN_ROLES.has(decoded.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export { adminAuth };
export default adminAuth;
