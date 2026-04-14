export default (req, res, next) => {
  if (!process.env.ADMIN_SECRET) {
    throw new Error("ADMIN_SECRET missing");
  }
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};