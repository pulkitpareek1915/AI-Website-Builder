import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

// Creates a signed JWT for the given user id, valid for 30 days by default.
export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ sub: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
}

// Blocks the request unless a valid token is sent; attaches the user to req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Like requireAuth but never blocks — attaches req.user if a valid token is
// present, otherwise just continues as an anonymous request.
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    }
  } catch {
    // Invalid token — treat as unauthenticated, keep going
  }
  next();
}
