import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { Users, User } from "./models/users";

// Change session timeout duration here (in minutes)
export const SESSION_TIMEOUT_MINUTES = 30;

// const JWT_SECRET = process.env.JWT_SECRET;
// if (!JWT_SECRET) {
//   throw new Error(
//     "JWT_SECRET is not defined in environment variables. Please set it in .env or .env.local"
//   );
// }

// Fallback for development/testing (DO NOT USE IN PRODUCTION)
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

export interface JWTPayload {
  userId: string;
  username: string;
  role: "admin" | "house_captain";
  houseId?: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" }); // 8 hours for better testing experience
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// Extract token from request
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

// Middleware to verify authentication
export async function verifyAuth(
  request: NextRequest
): Promise<{ user: User; payload: JWTPayload } | null> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await Users.getById(payload.userId);
  if (!user) {
    return null;
  }

  // Check if the user's active session matches the provided token
  if (user.activeSessionToken !== token) {
    console.warn(`Token mismatch for user ${user.username}`);
    return null;
  }

  // Check if session has expired (30-minute inactivity)
  if (user.lastActiveAt) {
    const minutesSinceLastActive =
      (Date.now() - new Date(user.lastActiveAt).getTime()) / (1000 * 60);
    if (minutesSinceLastActive > SESSION_TIMEOUT_MINUTES) {
      console.log(`Session expired for user ${user.username}`);
      // Invalidate expired session
      await Users.update(user._id!.toString(), {
        activeSessionToken: null,
        lastActiveAt: null,
      });
      return null;
    }
  }

  // Throttle lastActiveAt updates to reduce write load (e.g. update if >=60s since last activity)
  const THROTTLE_MS = 60_000;
  let shouldUpdate = false;
  if (!user.lastActiveAt) {
    shouldUpdate = true;
  } else {
    const elapsed = Date.now() - new Date(user.lastActiveAt).getTime();
    if (elapsed >= THROTTLE_MS) shouldUpdate = true;
  }

  if (shouldUpdate) {
    await Users.update(user._id!.toString(), {
      lastActiveAt: new Date(),
    });
  }

  return { user, payload };
}

// Check if user has required role
export function hasRole(
  payload: JWTPayload,
  requiredRole: "admin" | "house_captain"
): boolean {
  if (requiredRole === "admin") {
    return payload.role === "admin";
  }
  return payload.role === "admin" || payload.role === "house_captain";
}

// Check if user can access house data
export function canAccessHouse(payload: JWTPayload, houseId: string): boolean {
  if (payload.role === "admin") {
    return true;
  }
  return payload.houseId === houseId;
}
