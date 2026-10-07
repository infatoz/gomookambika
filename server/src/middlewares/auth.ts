import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { errors, AppError } from './errorHandler';
import { UserRole } from '@gomookambika/types';
import { logger } from '@/utils/logger';

export interface JWTPayload {
  userId: string;
  phone?: string;
  email?: string;
  role: UserRole;
  permissions: string[];
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw errors.unauthorized('No authentication token provided');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw errors.unauthorized('Token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw errors.unauthorized('Invalid token');
    }
    throw errors.unauthorized('Authentication failed');
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw errors.unauthorized();
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied: user ${req.user.userId} with role ${req.user.role} attempted to access ${req.path}. Required roles: ${roles.join(', ')}`);
      throw errors.forbidden(`Insufficient role. Required: ${roles.join(' or ')}`);
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw errors.unauthorized();
    }

    const hasPermission = req.user.permissions.includes(permission);
    const isSuperAdmin = req.user.role === UserRole.SUPER_ADMIN;

    if (!hasPermission && !isSuperAdmin) {
      logger.warn(`Permission denied: user ${req.user.userId} lacks ${permission}`);
      throw errors.forbidden(`Missing permission: ${permission}`);
    }

    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      req.user = payload;
    } catch {
      // Token present but invalid — don't throw, just don't set req.user
    }
  }

  next();
}

export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: { userId: string; tokenId: string }): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): { userId: string; tokenId: string } {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as { userId: string; tokenId: string };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw errors.unauthorized('Refresh token has expired');
    }
    throw errors.unauthorized('Invalid refresh token');
  }
}
