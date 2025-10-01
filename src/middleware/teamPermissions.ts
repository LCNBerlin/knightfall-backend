import { Request, Response, NextFunction } from 'express';
import { TeamMembershipModel } from '../models/TeamMembership';
import { TeamPermissionModel, PermissionType, TeamRole } from '../models/TeamPermission';

// Extend Express Request interface to include team permissions
declare global {
  namespace Express {
    interface Request {
      teamPermissions?: {
        role: TeamRole;
        permissions: string[];
      };
    }
  }
}

export class TeamPermissionMiddleware {
  // Check if user has specific permission for a team
  static requirePermission(permission: PermissionType) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        if (!teamId) {
          res.status(400).json({
            success: false,
            message: 'Team ID is required'
          });
          return;
        }

        // Get user's role in the team
        const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
        if (!userRole) {
          res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
          });
          return;
        }

        // Check if user has the required permission
        const hasPermission = await TeamPermissionModel.hasPermission(teamId, userRole, permission);
        if (!hasPermission) {
          res.status(403).json({
            success: false,
            message: `Insufficient permissions. Required: ${permission}`
          });
          return;
        }

        // Add team permissions to request for use in controllers
        req.teamPermissions = {
          role: userRole,
          permissions: [permission]
        };

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  // Check if user has any of the specified permissions
  static requireAnyPermission(permissions: PermissionType[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        if (!teamId) {
          res.status(400).json({
            success: false,
            message: 'Team ID is required'
          });
          return;
        }

        // Get user's role in the team
        const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
        if (!userRole) {
          res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
          });
          return;
        }

        // Check if user has any of the required permissions
        let hasAnyPermission = false;
        const userPermissions: string[] = [];

        for (const permission of permissions) {
          const hasPermission = await TeamPermissionModel.hasPermission(teamId, userRole, permission);
          if (hasPermission) {
            hasAnyPermission = true;
            userPermissions.push(permission);
          }
        }

        if (!hasAnyPermission) {
          res.status(403).json({
            success: false,
            message: `Insufficient permissions. Required one of: ${permissions.join(', ')}`
          });
          return;
        }

        // Add team permissions to request
        req.teamPermissions = {
          role: userRole,
          permissions: userPermissions
        };

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  // Check if user has a specific role or higher
  static requireRole(minimumRole: TeamRole) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        if (!teamId) {
          res.status(400).json({
            success: false,
            message: 'Team ID is required'
          });
          return;
        }

        // Get user's role in the team
        const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
        if (!userRole) {
          res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
          });
          return;
        }

        // Check if user has minimum required role
        const hierarchy = TeamPermissionModel.getRoleHierarchy();
        const userRoleIndex = hierarchy.indexOf(userRole);
        const minimumRoleIndex = hierarchy.indexOf(minimumRole);

        if (userRoleIndex > minimumRoleIndex) {
          res.status(403).json({
            success: false,
            message: `Insufficient role. Required: ${minimumRole} or higher`
          });
          return;
        }

        // Add team permissions to request
        req.teamPermissions = {
          role: userRole,
          permissions: []
        };

        next();
      } catch (error) {
        console.error('Role check error:', error);
        res.status(500).json({
          success: false,
          message: 'Role check failed'
        });
      }
    };
  }

  // Check if user can manage another user's role
  static requireRoleManagement() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;
        const targetUserId = req.params.userId || req.body.userId;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        if (!teamId || !targetUserId) {
          res.status(400).json({
            success: false,
            message: 'Team ID and target user ID are required'
          });
          return;
        }

        // Get both users' roles
        const [managerRole, targetRole] = await Promise.all([
          TeamMembershipModel.getUserRole(teamId, userId),
          TeamMembershipModel.getUserRole(teamId, targetUserId)
        ]);

        if (!managerRole) {
          res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
          });
          return;
        }

        if (!targetRole) {
          res.status(404).json({
            success: false,
            message: 'Target user is not a member of this team'
          });
          return;
        }

        // Check if manager can manage target role
        const canManage = TeamPermissionModel.canManageRole(managerRole, targetRole);
        if (!canManage) {
          res.status(403).json({
            success: false,
            message: 'You cannot manage users with this role'
          });
          return;
        }

        // Prevent self-management
        if (userId === targetUserId) {
          res.status(400).json({
            success: false,
            message: 'You cannot manage your own role'
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Role management check error:', error);
        res.status(500).json({
          success: false,
          message: 'Role management check failed'
        });
      }
    };
  }

  // Load user's permissions for a team
  static loadTeamPermissions() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;

        if (!userId || !teamId) {
          next();
          return;
        }

        // Get user's role in the team
        const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
        if (!userRole) {
          next();
          return;
        }

        // Get all permissions for the user's role
        const permissions = await TeamPermissionModel.getPermissionsForRole(teamId, userRole);
        const grantedPermissions = permissions
          .filter(p => p.granted)
          .map(p => p.permission);

        // Add team permissions to request
        req.teamPermissions = {
          role: userRole,
          permissions: grantedPermissions
        };

        next();
      } catch (error) {
        console.error('Load permissions error:', error);
        next(); // Continue even if permission loading fails
      }
    };
  }

  // Check if user is team owner
  static requireTeamOwner() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.userId;
        const teamId = req.params.teamId || req.params.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
          return;
        }

        if (!teamId) {
          res.status(400).json({
            success: false,
            message: 'Team ID is required'
          });
          return;
        }

        // Get user's role in the team
        const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
        if (!userRole) {
          res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
          });
          return;
        }

        if (userRole !== 'owner') {
          res.status(403).json({
            success: false,
            message: 'Only the team owner can perform this action'
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Team owner check error:', error);
        res.status(500).json({
          success: false,
          message: 'Team owner check failed'
        });
      }
    };
  }
}
