import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { TeamMembershipModel } from '../models/TeamMembership';

export interface AuthenticatedSocket {
  userId?: string;
  username?: string;
  userRole?: string;
  handshake: {
    auth: {
      token?: string;
    };
    headers: {
      authorization?: string;
    };
  };
  emit: (event: string, data: any) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  to: (room: string) => {
    emit: (event: string, data: any) => void;
  };
}

export class SocketAuthMiddleware {
  // Authenticate socket connection
  static async authenticate(socket: AuthenticatedSocket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      const user = await UserModel.findById(decoded.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.username = user.username;
      socket.userRole = user.rank; // Using rank as role for now

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  }

  // Check if user is member of team
  static async requireTeamMembership(socket: AuthenticatedSocket, teamId: string): Promise<boolean> {
    if (!socket.userId) return false;

    try {
      return await TeamMembershipModel.isMember(teamId, socket.userId);
    } catch (error) {
      return false;
    }
  }

  // Check if user has specific role in team
  static async requireTeamRole(socket: AuthenticatedSocket, teamId: string, requiredRoles: string[]): Promise<boolean> {
    if (!socket.userId) return false;

    try {
      const userRole = await TeamMembershipModel.getUserRole(teamId, socket.userId);
      return userRole ? requiredRoles.includes(userRole) : false;
    } catch (error) {
      return false;
    }
  }

  // Middleware for team chat access
  static async teamChatAccess(socket: AuthenticatedSocket, teamId: string, next: (err?: Error) => void): Promise<void> {
    try {
      const isMember = await this.requireTeamMembership(socket, teamId);
      
      if (!isMember) {
        return next(new Error('You must be a member of this team to access chat'));
      }

      next();
    } catch (error) {
      next(new Error('Failed to verify team membership'));
    }
  }

  // Middleware for team admin access
  static async teamAdminAccess(socket: AuthenticatedSocket, teamId: string, next: (err?: Error) => void): Promise<void> {
    try {
      const hasAccess = await this.requireTeamRole(socket, teamId, ['owner', 'admin']);
      
      if (!hasAccess) {
        return next(new Error('You must be an admin or owner to perform this action'));
      }

      next();
    } catch (error) {
      next(new Error('Failed to verify team permissions'));
    }
  }

  // Middleware for team owner access
  static async teamOwnerAccess(socket: AuthenticatedSocket, teamId: string, next: (err?: Error) => void): Promise<void> {
    try {
      const hasAccess = await this.requireTeamRole(socket, teamId, ['owner']);
      
      if (!hasAccess) {
        return next(new Error('You must be the team owner to perform this action'));
      }

      next();
    } catch (error) {
      next(new Error('Failed to verify team ownership'));
    }
  }

  // Rate limiting for socket events
  private static rateLimits = new Map<string, { count: number; resetTime: number }>();

  static rateLimit(socket: AuthenticatedSocket, event: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
    const key = `${socket.userId}:${event}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  // Clean up expired rate limits
  static cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, limit] of this.rateLimits.entries()) {
      if (now > limit.resetTime) {
        this.rateLimits.delete(key);
      }
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(() => {
  SocketAuthMiddleware.cleanupRateLimits();
}, 5 * 60 * 1000);
