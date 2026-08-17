import { timingSafeEqual } from "crypto";

const adminAuth = (req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  const expected = process.env.ADMIN_SECRET;
  if (!secret || !expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

export { adminAuth };
export default adminAuth;