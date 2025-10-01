import { Request, Response } from 'express';
import { TeamInvitationModel, CreateTeamInvitationData, UpdateTeamInvitationData, InvitationStatus } from '../models/TeamInvitation';
import { TeamMembershipModel } from '../models/TeamMembership';
import { TeamModel } from '../models/Team';
import { UserModel } from '../models/User';
import { NotificationModel } from '../models/Notification';
import { WebSocketService } from '../services/websocketService';

export class TeamInvitationController {
  // Send invitation to join team
  static async sendInvitation(req: Request, res: Response): Promise<void> {
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

      const { invitee_id, role, message } = req.body;

      // Check if user can invite to this team
      const canInvite = await TeamInvitationModel.canInviteToTeam(teamId, userId);
      if (!canInvite.canInvite) {
        res.status(403).json({
          success: false,
          message: canInvite.reason || 'Insufficient permissions to invite members'
        });
        return;
      }

      // Check if invitee exists
      const invitee = await UserModel.findById(invitee_id);
      if (!invitee) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if invitee is already a member
      const isMember = await TeamMembershipModel.isMember(teamId, invitee_id);
      if (isMember) {
        res.status(409).json({
          success: false,
          message: 'User is already a member of this team'
        });
        return;
      }

      // Check if there's already a pending invitation
      const hasPendingInvitation = await TeamInvitationModel.hasPendingInvitation(teamId, invitee_id);
      if (hasPendingInvitation) {
        res.status(409).json({
          success: false,
          message: 'User already has a pending invitation to this team'
        });
        return;
      }

      const invitationData: CreateTeamInvitationData = {
        team_id: teamId,
        inviter_id: userId,
        invitee_id,
        role,
        message: message || null
      };

      // Validate invitation data
      const validation = TeamInvitationModel.validateInvitationData(invitationData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      const invitation = await TeamInvitationModel.create(invitationData);

      // Get team and inviter info for notification
      const [team, inviter] = await Promise.all([
        TeamModel.findById(teamId),
        UserModel.findById(userId)
      ]);

      if (team && inviter) {
        // Create notification for invitee
        await NotificationModel.create({
          user_id: invitee_id,
          type: 'team_invite',
          title: 'Team Invitation',
          message: `${inviter.username} invited you to join ${team.name}`,
          data: {
            team_id: teamId,
            team_name: team.name,
            inviter_id: userId,
            inviter_username: inviter.username,
            invitation_id: invitation.id,
            role: role
          }
        });

        // Send real-time notification
        await WebSocketService.sendTeamInvitationNotification(invitee_id, {
          team_id: teamId,
          team_name: team.name,
          inviter_id: userId,
          inviter_username: inviter.username,
          invitation_id: invitation.id,
          role: role,
          message: message
        });
      }

      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        data: invitation
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team invitations
  static async getTeamInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { status } = req.query;

      const invitations = await TeamInvitationModel.getTeamInvitations(
        teamId, 
        status as InvitationStatus
      );

      res.status(200).json({
        success: true,
        data: {
          invitations,
          count: invitations.length
        }
      });
    } catch (error) {
      console.error('Error getting team invitations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's invitations (sent or received)
  static async getUserInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { type } = req.query;

      if (!['sent', 'received'].includes(type as string)) {
        res.status(400).json({
          success: false,
          message: 'Type must be "sent" or "received"'
        });
        return;
      }

      const invitations = await TeamInvitationModel.getUserInvitations(
        userId, 
        type as 'sent' | 'received'
      );

      res.status(200).json({
        success: true,
        data: {
          invitations,
          count: invitations.length
        }
      });
    } catch (error) {
      console.error('Error getting user invitations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get pending invitations for current user
  static async getPendingInvitations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const invitations = await TeamInvitationModel.getPendingInvitations(userId);

      res.status(200).json({
        success: true,
        data: {
          invitations,
          count: invitations.length
        }
      });
    } catch (error) {
      console.error('Error getting pending invitations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Accept invitation
  static async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Get invitation details
      const invitation = await TeamInvitationModel.findById(invitationId);
      if (!invitation) {
        res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
        return;
      }

      // Check if user is the invitee
      if (invitation.invitee_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only accept invitations sent to you'
        });
        return;
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'Invitation is no longer pending'
        });
        return;
      }

      // Check if invitation has expired
      if (new Date() > invitation.expires_at) {
        res.status(400).json({
          success: false,
          message: 'Invitation has expired'
        });
        return;
      }

      // Accept invitation
      const acceptedInvitation = await TeamInvitationModel.acceptInvitation(invitationId);
      if (!acceptedInvitation) {
        res.status(400).json({
          success: false,
          message: 'Failed to accept invitation'
        });
        return;
      }

      // Add user to team
      await TeamMembershipModel.create({
        team_id: invitation.team_id,
        user_id: userId,
        role: invitation.role as any // Type assertion since we know it's a valid role
      });

      // Get team and user info for notifications
      const [team, user] = await Promise.all([
        TeamModel.findById(invitation.team_id),
        UserModel.findById(userId)
      ]);

      if (team && user) {
        // Notify team members about new member
        await WebSocketService.sendTeamMemberJoinedNotification(invitation.team_id, {
          user_id: userId,
          username: user.username,
          team_id: invitation.team_id,
          team_name: team.name,
          role: invitation.role
        });

        // Notify inviter about acceptance
        await WebSocketService.sendInvitationAcceptedNotification(invitation.inviter_id, {
          invitee_id: userId,
          invitee_username: user.username,
          team_id: invitation.team_id,
          team_name: team.name
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invitation accepted successfully',
        data: acceptedInvitation
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Decline invitation
  static async declineInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Get invitation details
      const invitation = await TeamInvitationModel.findById(invitationId);
      if (!invitation) {
        res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
        return;
      }

      // Check if user is the invitee
      if (invitation.invitee_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only decline invitations sent to you'
        });
        return;
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'Invitation is no longer pending'
        });
        return;
      }

      // Decline invitation
      const declinedInvitation = await TeamInvitationModel.declineInvitation(invitationId);
      if (!declinedInvitation) {
        res.status(400).json({
          success: false,
          message: 'Failed to decline invitation'
        });
        return;
      }

      // Get team and user info for notifications
      const [team, user] = await Promise.all([
        TeamModel.findById(invitation.team_id),
        UserModel.findById(userId)
      ]);

      if (team && user) {
        // Notify inviter about decline
        await WebSocketService.sendInvitationDeclinedNotification(invitation.inviter_id, {
          invitee_id: userId,
          invitee_username: user.username,
          team_id: invitation.team_id,
          team_name: team.name
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invitation declined successfully',
        data: declinedInvitation
      });
    } catch (error) {
      console.error('Error declining invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Cancel invitation (by inviter)
  static async cancelInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Get invitation details
      const invitation = await TeamInvitationModel.findById(invitationId);
      if (!invitation) {
        res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
        return;
      }

      // Check if user is the inviter
      if (invitation.inviter_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only cancel invitations you sent'
        });
        return;
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'Invitation is no longer pending'
        });
        return;
      }

      // Cancel invitation
      const cancelledInvitation = await TeamInvitationModel.cancelInvitation(invitationId);
      if (!cancelledInvitation) {
        res.status(400).json({
          success: false,
          message: 'Failed to cancel invitation'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled successfully',
        data: cancelledInvitation
      });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get invitation statistics for a team
  static async getInvitationStats(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const stats = await TeamInvitationModel.getTeamInvitationStats(teamId);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting invitation stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Clean up expired invitations
  static async cleanupExpiredInvitations(req: Request, res: Response): Promise<void> {
    try {
      const cleanedCount = await TeamInvitationModel.cleanupExpiredInvitations();

      res.status(200).json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired invitations`,
        data: { cleaned_count: cleanedCount }
      });
    } catch (error) {
      console.error('Error cleaning up expired invitations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update invitation
  static async updateInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { invitationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const updateData: UpdateTeamInvitationData = {
        message: req.body.message,
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : undefined
      };

      // Get invitation to check permissions
      const invitation = await TeamInvitationModel.findById(invitationId);
      if (!invitation) {
        res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
        return;
      }

      // Check if user can update this invitation (inviter or team admin)
      if (invitation.inviter_id !== userId) {
        // Check if user is team admin/owner
        const canInvite = await TeamInvitationModel.canInviteToTeam(invitation.team_id, userId);
        if (!canInvite.canInvite) {
          res.status(403).json({
            success: false,
            message: 'You can only update invitations you sent or have admin permissions'
          });
          return;
        }
      }

      const updatedInvitation = await TeamInvitationModel.update(invitationId, updateData);
      if (!updatedInvitation) {
        res.status(400).json({
          success: false,
          message: 'Failed to update invitation'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Invitation updated successfully',
        data: updatedInvitation
      });
    } catch (error) {
      console.error('Error updating invitation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
