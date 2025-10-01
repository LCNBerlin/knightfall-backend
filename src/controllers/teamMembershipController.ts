import { Request, Response } from 'express';
import { TeamMembershipModel, CreateTeamMembershipData, UpdateTeamMembershipData, TeamRole } from '../models/TeamMembership';
import { TeamModel } from '../models/Team';
import { UserModel } from '../models/User';

export class TeamMembershipController {
  // Join a team
  static async joinTeam(req: Request, res: Response): Promise<void> {
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

      // Check if user exists
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if user is already a member
      const existingMembership = await TeamMembershipModel.findByTeamAndUser(teamId, userId);
      if (existingMembership) {
        res.status(409).json({
          success: false,
          message: 'User is already a member of this team'
        });
        return;
      }

      // Check team capacity (max 50 members)
      const memberCount = await TeamMembershipModel.getTeamMemberCount(teamId);
      if (memberCount >= 50) {
        res.status(400).json({
          success: false,
          message: 'Team is at maximum capacity (50 members)'
        });
        return;
      }

      // Create membership
      const membershipData: CreateTeamMembershipData = {
        team_id: teamId,
        user_id: userId,
        role: 'member'
      };

      const membership = await TeamMembershipModel.create(membershipData);

      res.status(201).json({
        success: true,
        message: 'Successfully joined team',
        data: membership
      });
    } catch (error) {
      console.error('Error joining team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Leave a team
  static async leaveTeam(req: Request, res: Response): Promise<void> {
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

      // Check if user is a member
      const membership = await TeamMembershipModel.findByTeamAndUser(teamId, userId);
      if (!membership) {
        res.status(404).json({
          success: false,
          message: 'User is not a member of this team'
        });
        return;
      }

      // Check if user is the owner
      if (membership.role === 'owner') {
        res.status(400).json({
          success: false,
          message: 'Team owner cannot leave. Transfer ownership first.'
        });
        return;
      }

      // Remove membership
      const removed = await TeamMembershipModel.removeFromTeam(teamId, userId);
      if (!removed) {
        res.status(500).json({
          success: false,
          message: 'Failed to leave team'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Successfully left team'
      });
    } catch (error) {
      console.error('Error leaving team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team members
  static async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if team exists
      const team = await TeamModel.findById(teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      const members = await TeamMembershipModel.getTeamMembers(teamId);

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          members,
          count: members.length
        }
      });
    } catch (error) {
      console.error('Error getting team members:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's teams
  static async getUserTeams(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const teams = await TeamMembershipModel.getUserTeams(userId);

      res.status(200).json({
        success: true,
        data: {
          user_id: userId,
          teams,
          count: teams.length
        }
      });
    } catch (error) {
      console.error('Error getting user teams:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update member role
  static async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user?.userId;

      if (!currentUserId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validate role
      if (!role || !['owner', 'admin', 'moderator', 'member'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role. Must be owner, admin, moderator, or member'
        });
        return;
      }

      // Check if current user has permission to change roles
      const currentUserRole = await TeamMembershipModel.getUserRole(teamId, currentUserId);
      if (!currentUserRole || !TeamMembershipModel.canPerformAction(currentUserRole, 'member')) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to change member roles'
        });
        return;
      }

      // Check if target user is a member
      const targetMembership = await TeamMembershipModel.findByTeamAndUser(teamId, userId);
      if (!targetMembership) {
        res.status(404).json({
          success: false,
          message: 'User is not a member of this team'
        });
        return;
      }

      // Prevent changing owner role
      if (targetMembership.role === 'owner') {
        res.status(400).json({
          success: false,
          message: 'Cannot change owner role'
        });
        return;
      }

      // Update role
      const updatedMembership = await TeamMembershipModel.updateRole(targetMembership.id, role as TeamRole);

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully',
        data: updatedMembership
      });
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Remove member from team
  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;
      const currentUserId = req.user?.userId;

      if (!currentUserId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if current user has permission to remove members
      const currentUserRole = await TeamMembershipModel.getUserRole(teamId, currentUserId);
      if (!currentUserRole || !TeamMembershipModel.canPerformAction(currentUserRole, 'member')) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to remove members'
        });
        return;
      }

      // Check if target user is a member
      const targetMembership = await TeamMembershipModel.findByTeamAndUser(teamId, userId);
      if (!targetMembership) {
        res.status(404).json({
          success: false,
          message: 'User is not a member of this team'
        });
        return;
      }

      // Prevent removing owner
      if (targetMembership.role === 'owner') {
        res.status(400).json({
          success: false,
          message: 'Cannot remove team owner'
        });
        return;
      }

      // Remove member
      const removed = await TeamMembershipModel.removeFromTeam(teamId, userId);
      if (!removed) {
        res.status(500).json({
          success: false,
          message: 'Failed to remove member'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Transfer team ownership
  static async transferOwnership(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { newOwnerId } = req.body;
      const currentUserId = req.user?.userId;

      if (!currentUserId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if current user is the owner
      const currentUserRole = await TeamMembershipModel.getUserRole(teamId, currentUserId);
      if (currentUserRole !== 'owner') {
        res.status(403).json({
          success: false,
          message: 'Only team owner can transfer ownership'
        });
        return;
      }

      // Check if new owner is a member
      const newOwnerMembership = await TeamMembershipModel.findByTeamAndUser(teamId, newOwnerId);
      if (!newOwnerMembership) {
        res.status(404).json({
          success: false,
          message: 'New owner must be a member of the team'
        });
        return;
      }

      // Transfer ownership
      const transferred = await TeamMembershipModel.transferOwnership(teamId, currentUserId, newOwnerId);
      if (!transferred) {
        res.status(500).json({
          success: false,
          message: 'Failed to transfer ownership'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Team ownership transferred successfully'
      });
    } catch (error) {
      console.error('Error transferring ownership:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check if user is member of team
  static async checkMembership(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;

      const isMember = await TeamMembershipModel.isMember(teamId, userId);

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          user_id: userId,
          is_member: isMember
        }
      });
    } catch (error) {
      console.error('Error checking membership:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's role in team
  static async getUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;

      const role = await TeamMembershipModel.getUserRole(teamId, userId);

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          user_id: userId,
          role
        }
      });
    } catch (error) {
      console.error('Error getting user role:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

