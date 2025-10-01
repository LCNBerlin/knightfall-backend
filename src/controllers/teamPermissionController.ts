import { Request, Response } from 'express';
import { TeamPermissionModel, CreateTeamPermissionData, UpdateTeamPermissionData, TeamRole, PermissionType } from '../models/TeamPermission';
import { TeamMembershipModel } from '../models/TeamMembership';
import { TeamModel } from '../models/Team';

export class TeamPermissionController {
  // Get all permissions for a team
  static async getTeamPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const permissions = await TeamPermissionModel.getTeamPermissions(teamId);

      res.status(200).json({
        success: true,
        data: {
          permissions,
          count: permissions.length
        }
      });
    } catch (error) {
      console.error('Error getting team permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get permissions for a specific role
  static async getRolePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, role } = req.params;

      if (!['owner', 'admin', 'moderator', 'member', 'guest'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
        return;
      }

      const permissions = await TeamPermissionModel.getPermissionsForRole(teamId, role as TeamRole);

      res.status(200).json({
        success: true,
        data: {
          role,
          permissions,
          count: permissions.length
        }
      });
    } catch (error) {
      console.error('Error getting role permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create a new permission
  static async createPermission(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const permissionData: CreateTeamPermissionData = {
        team_id: teamId,
        role: req.body.role,
        permission: req.body.permission,
        granted: req.body.granted,
        granted_by: userId,
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : null
      };

      // Validate permission data
      const validation = TeamPermissionModel.validatePermissionData(permissionData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      const permission = await TeamPermissionModel.create(permissionData);

      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: permission
      });
    } catch (error) {
      console.error('Error creating permission:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update a permission
  static async updatePermission(req: Request, res: Response): Promise<void> {
    try {
      const { permissionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const updateData: UpdateTeamPermissionData = {
        granted: req.body.granted,
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : null
      };

      const permission = await TeamPermissionModel.update(permissionId, updateData);
      if (!permission) {
        res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Permission updated successfully',
        data: permission
      });
    } catch (error) {
      console.error('Error updating permission:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete a permission
  static async deletePermission(req: Request, res: Response): Promise<void> {
    try {
      const { permissionId } = req.params;

      const deleted = await TeamPermissionModel.delete(permissionId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Permission deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting permission:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check if user has specific permission
  static async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, role, permission } = req.params;

      if (!['owner', 'admin', 'moderator', 'member', 'guest'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
        return;
      }

      const hasPermission = await TeamPermissionModel.hasPermission(
        teamId, 
        role as TeamRole, 
        permission as PermissionType
      );

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          role,
          permission,
          has_permission: hasPermission
        }
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get available permissions
  static async getAvailablePermissions(req: Request, res: Response): Promise<void> {
    try {
      const permissions: PermissionType[] = [
        'team.manage',
        'team.delete',
        'team.invite',
        'team.kick',
        'team.promote',
        'team.chat',
        'team.chat.moderate',
        'team.tournament.create',
        'team.tournament.join',
        'team.tournament.manage',
        'team.analytics.view',
        'team.analytics.export',
        'team.leaderboard.view',
        'team.achievements.manage',
        'team.settings.update',
        'team.members.view',
        'team.members.manage',
        'team.finances.view',
        'team.finances.manage'
      ];

      const roles: TeamRole[] = ['owner', 'admin', 'moderator', 'member', 'guest'];

      res.status(200).json({
        success: true,
        data: {
          permissions,
          roles,
          role_hierarchy: TeamPermissionModel.getRoleHierarchy()
        }
      });
    } catch (error) {
      console.error('Error getting available permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Initialize default permissions for a team
  static async initializeDefaultPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if team exists
      const team = await TeamModel.findById(teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Initialize default permissions
      await TeamPermissionModel.initializeDefaultPermissions(teamId, userId);

      res.status(200).json({
        success: true,
        message: 'Default permissions initialized successfully'
      });
    } catch (error) {
      console.error('Error initializing default permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's permissions for a team
  static async getUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;

      // Get user's role in the team
      const userRole = await TeamMembershipModel.getUserRole(teamId, userId);
      if (!userRole) {
        res.status(404).json({
          success: false,
          message: 'User is not a member of this team'
        });
        return;
      }

      // Get permissions for the user's role
      const permissions = await TeamPermissionModel.getPermissionsForRole(teamId, userRole);
      const grantedPermissions = permissions
        .filter(p => p.granted)
        .map(p => p.permission);

      res.status(200).json({
        success: true,
        data: {
          user_id: userId,
          team_id: teamId,
          role: userRole,
          permissions: grantedPermissions,
          count: grantedPermissions.length
        }
      });
    } catch (error) {
      console.error('Error getting user permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Bulk update permissions for a role
  static async updateRolePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, role } = req.params;
      const userId = req.user?.userId;
      const { permissions } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!['owner', 'admin', 'moderator', 'member', 'guest'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
        return;
      }

      if (!Array.isArray(permissions)) {
        res.status(400).json({
          success: false,
          message: 'Permissions must be an array'
        });
        return;
      }

      // Get existing permissions for the role
      const existingPermissions = await TeamPermissionModel.getPermissionsForRole(teamId, role as TeamRole);
      
      // Update each permission
      const results = [];
      for (const permissionUpdate of permissions) {
        const existing = existingPermissions.find(p => p.permission === permissionUpdate.permission);
        
        if (existing) {
          // Update existing permission
          const updated = await TeamPermissionModel.update(existing.id, {
            granted: permissionUpdate.granted,
            expires_at: permissionUpdate.expires_at ? new Date(permissionUpdate.expires_at) : null
          });
          if (updated) results.push(updated);
        } else {
          // Create new permission
          const created = await TeamPermissionModel.create({
            team_id: teamId,
            role: role as TeamRole,
            permission: permissionUpdate.permission,
            granted: permissionUpdate.granted,
            granted_by: userId,
            expires_at: permissionUpdate.expires_at ? new Date(permissionUpdate.expires_at) : null
          });
          results.push(created);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Role permissions updated successfully',
        data: {
          role,
          permissions: results,
          count: results.length
        }
      });
    } catch (error) {
      console.error('Error updating role permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
