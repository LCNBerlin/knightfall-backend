import { Request, Response, NextFunction } from 'express';
import { AuthUtils, JWTPayload } from '../utils/auth';
import { UserModel } from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Access token required'
        }
      });
      return;
    }

    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token'
        }
      });
      return;
    }

    // Verify user still exists in database
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'User not found'
        }
      });
      return;
    }

    // Add user info to request
    req.user = payload;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed'
      }
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = AuthUtils.verifyToken(token);
      if (payload) {
        const user = await UserModel.findById(payload.userId);
        if (user) {
          req.user = payload;
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on errors
    next();
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required'
        }
      });
      return;
    }

    try {
      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'User not found'
          }
        });
        return;
      }

      if (!roles.includes(user.rank)) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions'
          }
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Authorization failed'
        }
      });
    }
  };
}; 