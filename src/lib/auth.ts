import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { Users, User } from './models/users';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'house_captain';
  houseId?: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Extract token from request
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Middleware to verify authentication
export async function verifyAuth(request: NextRequest): Promise<{ user: User; payload: JWTPayload } | null> {
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

  return { user, payload };
}

// Check if user has required role
export function hasRole(payload: JWTPayload, requiredRole: 'admin' | 'house_captain'): boolean {
  if (requiredRole === 'admin') {
    return payload.role === 'admin';
  }
  return payload.role === 'admin' || payload.role === 'house_captain';
}

// Check if user can access house data
export function canAccessHouse(payload: JWTPayload, houseId: string): boolean {
  if (payload.role === 'admin') {
    return true;
  }
  return payload.houseId === houseId;
}