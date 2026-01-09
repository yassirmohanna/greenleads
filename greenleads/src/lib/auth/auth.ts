import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);

export const verifyPassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signToken = (payload: { userId: string; email: string }) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.session;
  if (!token) {
    return res.redirect("/login");
  }
  try {
    const decoded = verifyToken(token);
    res.locals.user = decoded;
    return next();
  } catch {
    return res.redirect("/login");
  }
};
