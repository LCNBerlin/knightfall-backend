import { Request, Response } from 'express';
import { FriendshipModel, CreateFriendshipData } from '../models/Friendship';
import { TeamChatMessageModel, CreateTeamChatMessageData } from '../models/TeamChatMessage';
import { NotificationModel, CreateNotificationData } from '../models/Notification';
import { TeamMembershipModel } from '../models/TeamMembership';
import { UserModel } from '../models/User';

export class SocialController {
  // === FRIEND SYSTEM ===

  // Send friend request
  static async sendFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const { friendId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!friendId) {
        res.status(400).json({
          success: false,
          message: 'Friend ID is required'
        });
        return;
      }

      if (userId === friendId) {
        res.status(400).json({
          success: false,
          message: 'Cannot send friend request to yourself'
        });
        return;
      }

      // Check if friend exists
      const friend = await UserModel.findById(friendId);
      if (!friend) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if friendship already exists
      const existingFriendship = await FriendshipModel.findByUsers(userId, friendId);
      if (existingFriendship) {
        res.status(409).json({
          success: false,
          message: 'Friendship already exists or request already sent'
        });
        return;
      }

      // Create friend request
      const friendshipData: CreateFriendshipData = {
        user_id: userId,
        friend_id: friendId,
        status: 'pending'
      };

      const friendship = await FriendshipModel.sendFriendRequest(friendshipData);

      // Create notification for friend
      await NotificationModel.createFriendRequestNotification(friendId, req.user?.username || 'Unknown');

      res.status(201).json({
        success: true,
        message: 'Friend request sent successfully',
        data: friendship
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Accept friend request
  static async acceptFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const { friendshipId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Get friendship details
      const friendship = await FriendshipModel.findById(friendshipId);
      if (!friendship) {
        res.status(404).json({
          success: false,
          message: 'Friend request not found'
        });
        return;
      }

      // Check if user is the recipient
      if (friendship.friend_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to accept this request'
        });
        return;
      }

      // Accept the request
      const acceptedFriendship = await FriendshipModel.acceptFriendRequest(friendshipId);
      if (!acceptedFriendship) {
        res.status(400).json({
          success: false,
          message: 'Failed to accept friend request'
        });
        return;
      }

      // Create notification for sender
      const sender = await UserModel.findById(friendship.user_id);
      if (sender) {
        await NotificationModel.createFriendAcceptedNotification(friendship.user_id, req.user?.username || 'Unknown');
      }

      res.status(200).json({
        success: true,
        message: 'Friend request accepted successfully',
        data: acceptedFriendship
      });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Decline friend request
  static async declineFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const { friendshipId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Get friendship details
      const friendship = await FriendshipModel.findById(friendshipId);
      if (!friendship) {
        res.status(404).json({
          success: false,
          message: 'Friend request not found'
        });
        return;
      }

      // Check if user is the recipient
      if (friendship.friend_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to decline this request'
        });
        return;
      }

      // Decline the request
      const declined = await FriendshipModel.declineFriendRequest(friendshipId);
      if (!declined) {
        res.status(400).json({
          success: false,
          message: 'Failed to decline friend request'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Friend request declined successfully'
      });
    } catch (error) {
      console.error('Error declining friend request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's friends
  static async getFriends(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const friends = await FriendshipModel.getUserFriends(userId);

      res.status(200).json({
        success: true,
        data: {
          friends,
          count: friends.length
        }
      });
    } catch (error) {
      console.error('Error getting friends:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get pending friend requests
  static async getPendingRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const requests = await FriendshipModel.getPendingRequests(userId);

      res.status(200).json({
        success: true,
        data: {
          requests,
          count: requests.length
        }
      });
    } catch (error) {
      console.error('Error getting pending requests:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Remove friend
  static async removeFriend(req: Request, res: Response): Promise<void> {
    try {
      const { friendId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const removed = await FriendshipModel.removeFriend(userId, friendId);
      if (!removed) {
        res.status(404).json({
          success: false,
          message: 'Friendship not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Friend removed successfully'
      });
    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // === TEAM CHAT ===

  // Send team message
  static async sendTeamMessage(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { message, messageType } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if user is member of team
      const isMember = await TeamMembershipModel.isMember(teamId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          message: 'You must be a member of this team to send messages'
        });
        return;
      }

      // Validate message data
      const messageData: CreateTeamChatMessageData = {
        team_id: teamId,
        user_id: userId,
        message,
        message_type: messageType || 'text'
      };

      const validation = TeamChatMessageModel.validateMessageData(messageData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      const chatMessage = await TeamChatMessageModel.sendMessage(messageData);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: chatMessage
      });
    } catch (error) {
      console.error('Error sending team message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team messages
  static async getTeamMessages(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      // Check if user is member of team
      const userId = req.user?.userId;
      if (userId) {
        const isMember = await TeamMembershipModel.isMember(teamId, userId);
        if (!isMember) {
          res.status(403).json({
            success: false,
            message: 'You must be a member of this team to view messages'
          });
          return;
        }
      }

      const messages = await TeamChatMessageModel.getTeamMessages(teamId, limit, offset);

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          messages,
          pagination: {
            page,
            limit,
            count: messages.length
          }
        }
      });
    } catch (error) {
      console.error('Error getting team messages:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // === NOTIFICATIONS ===

  // Get user notifications
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const notifications = await NotificationModel.getUserNotifications(userId, limit, offset);
      const counts = await NotificationModel.getNotificationCount(userId);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          counts,
          pagination: {
            page,
            limit,
            count: notifications.length
          }
        }
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get unread notifications
  static async getUnreadNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const notifications = await NotificationModel.getUnreadNotifications(userId);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          count: notifications.length
        }
      });
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const marked = await NotificationModel.markAsRead(notificationId, userId);
      if (!marked) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const count = await NotificationModel.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: `${count} notifications marked as read`
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete notification
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const deleted = await NotificationModel.delete(notificationId, userId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
