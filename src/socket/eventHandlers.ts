import { AuthenticatedSocket } from './socketServer';
import { TeamChatMessageModel } from '../models/TeamChatMessage';
import { NotificationModel } from '../models/Notification';
import { TeamMembershipModel } from '../models/TeamMembership';
import { TeamAchievementModel } from '../models/TeamAchievement';
import { SocketAuthMiddleware } from '../middleware/socketAuth';

export class SocketEventHandlers {
  // Team Chat Event Handlers
  static setupTeamChatHandlers(socket: AuthenticatedSocket): void {
    // Join team chat room
    socket.on('join_team_chat', async (data: { teamId: string }) => {
      try {
        if (!socket.userId) return;

        // Rate limiting
        if (!SocketAuthMiddleware.rateLimit(socket, 'join_team_chat', 5, 60000)) {
          socket.emit('error', { message: 'Rate limit exceeded. Please wait before joining again.' });
          return;
        }

        const isMember = await SocketAuthMiddleware.requireTeamMembership(socket, data.teamId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to join chat' });
          return;
        }

        const roomName = `team_chat:${data.teamId}`;
        await socket.join(roomName);

        socket.emit('joined_team_chat', { 
          teamId: data.teamId,
          timestamp: new Date().toISOString()
        });

        // Notify other team members
        socket.to(roomName).emit('user_joined_chat', { 
          username: socket.username,
          teamId: data.teamId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join team chat' });
      }
    });

    // Leave team chat room
    socket.on('leave_team_chat', (data: { teamId: string }) => {
      const roomName = `team_chat:${data.teamId}`;
      socket.leave(roomName);

      socket.emit('left_team_chat', { 
        teamId: data.teamId,
        timestamp: new Date().toISOString()
      });

      // Notify other team members
      socket.to(roomName).emit('user_left_chat', { 
        username: socket.username,
        teamId: data.teamId,
        timestamp: new Date().toISOString()
      });
    });

    // Send team chat message
    socket.on('team_chat_message', async (data: { 
      teamId: string; 
      message: string; 
      messageType?: string;
      replyTo?: string;
    }) => {
      try {
        if (!socket.userId) return;

        // Rate limiting
        if (!SocketAuthMiddleware.rateLimit(socket, 'team_chat_message', 30, 60000)) {
          socket.emit('error', { message: 'Rate limit exceeded. Please slow down your messaging.' });
          return;
        }

        const isMember = await SocketAuthMiddleware.requireTeamMembership(socket, data.teamId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to send messages' });
          return;
        }

        // Validate message
        const messageData = {
          team_id: data.teamId,
          user_id: socket.userId,
          message: data.message,
          message_type: data.messageType || 'text'
        };

        const validation = TeamChatMessageModel.validateMessageData(messageData);
        if (!validation.isValid) {
          socket.emit('error', { 
            message: 'Invalid message data',
            errors: validation.errors
          });
          return;
        }

        // Save message to database
        const savedMessage = await TeamChatMessageModel.sendMessage(messageData);

        const messagePayload = {
          id: savedMessage.id,
          teamId: data.teamId,
          userId: socket.userId,
          username: socket.username,
          message: data.message,
          messageType: data.messageType || 'text',
          replyTo: data.replyTo,
          timestamp: savedMessage.created_at.toISOString()
        };

        // Broadcast to all team members
        const roomName = `team_chat:${data.teamId}`;
        socket.to(roomName).emit('team_chat_message', messagePayload);
        
        // Send confirmation to sender
        socket.emit('message_sent', messagePayload);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Get recent team messages
    socket.on('get_team_messages', async (data: { teamId: string; limit?: number }) => {
      try {
        if (!socket.userId) return;

        const isMember = await SocketAuthMiddleware.requireTeamMembership(socket, data.teamId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to view messages' });
          return;
        }

        const messages = await TeamChatMessageModel.getRecentTeamMessages(
          data.teamId, 
          data.limit || 50
        );

        socket.emit('team_messages', {
          teamId: data.teamId,
          messages: messages.map(msg => ({
            id: msg.id,
            userId: msg.user_id,
            message: msg.message,
            messageType: msg.message_type,
            timestamp: msg.created_at.toISOString()
          }))
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get team messages' });
      }
    });
  }

  // Notification Event Handlers
  static setupNotificationHandlers(socket: AuthenticatedSocket): void {
    // Subscribe to notifications
    socket.on('subscribe_notifications', () => {
      if (socket.userId) {
        socket.join(`notifications:${socket.userId}`);
        socket.emit('notifications_subscribed', { 
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Unsubscribe from notifications
    socket.on('unsubscribe_notifications', () => {
      if (socket.userId) {
        socket.leave(`notifications:${socket.userId}`);
        socket.emit('notifications_unsubscribed', { 
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Mark notification as read
    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
      try {
        if (!socket.userId) return;

        const marked = await NotificationModel.markAsRead(data.notificationId, socket.userId);
        if (marked) {
          socket.emit('notification_marked_read', { 
            notificationId: data.notificationId,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('error', { message: 'Notification not found' });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    // Get unread notifications count
    socket.on('get_unread_count', async () => {
      try {
        if (!socket.userId) return;

        const notifications = await NotificationModel.getUnreadNotifications(socket.userId);
        socket.emit('unread_count', { 
          count: notifications.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });
  }

  // Team Update Event Handlers
  static setupTeamUpdateHandlers(socket: AuthenticatedSocket): void {
    // Join team updates room
    socket.on('join_team_updates', async (data: { teamId: string }) => {
      try {
        if (!socket.userId) return;

        const isMember = await SocketAuthMiddleware.requireTeamMembership(socket, data.teamId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to receive updates' });
          return;
        }

        const roomName = `team_updates:${data.teamId}`;
        await socket.join(roomName);

        socket.emit('joined_team_updates', { 
          teamId: data.teamId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join team updates' });
      }
    });

    // Leave team updates room
    socket.on('leave_team_updates', (data: { teamId: string }) => {
      const roomName = `team_updates:${data.teamId}`;
      socket.leave(roomName);

      socket.emit('left_team_updates', { 
        teamId: data.teamId,
        timestamp: new Date().toISOString()
      });
    });

    // Get team members online status
    socket.on('get_team_online_status', async (data: { teamId: string }) => {
      try {
        if (!socket.userId) return;

        const isMember = await SocketAuthMiddleware.requireTeamMembership(socket, data.teamId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to view online status' });
          return;
        }

        // This would need to be implemented in the main socket server
        // For now, just acknowledge the request
        socket.emit('team_online_status', { 
          teamId: data.teamId,
          onlineMembers: [], // Would be populated by the main server
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to get team online status' });
      }
    });
  }

  // Game Event Handlers
  static setupGameHandlers(socket: AuthenticatedSocket): void {
    // Send game invite
    socket.on('send_game_invite', async (data: { 
      targetUserId: string; 
      gameType: string;
      timeControl?: string;
    }) => {
      try {
        if (!socket.userId) return;

        // Rate limiting
        if (!SocketAuthMiddleware.rateLimit(socket, 'send_game_invite', 10, 60000)) {
          socket.emit('error', { message: 'Rate limit exceeded. Please wait before sending more invites.' });
          return;
        }

        // Create notification
        const notification = await NotificationModel.createGameInviteNotification(
          data.targetUserId,
          socket.username || 'Unknown',
          data.gameType
        );

        // Send real-time notification
        socket.to(`notifications:${data.targetUserId}`).emit('game_invite', {
          id: notification.id,
          fromUserId: socket.userId,
          fromUsername: socket.username,
          gameType: data.gameType,
          timeControl: data.timeControl,
          timestamp: notification.created_at.toISOString()
        });

        socket.emit('game_invite_sent', {
          targetUserId: data.targetUserId,
          gameType: data.gameType,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send game invite' });
      }
    });

    // Accept game invite
    socket.on('accept_game_invite', async (data: { inviteId: string }) => {
      try {
        if (!socket.userId) return;

        // This would need to be implemented with game logic
        socket.emit('game_invite_accepted', {
          inviteId: data.inviteId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to accept game invite' });
      }
    });

    // Decline game invite
    socket.on('decline_game_invite', async (data: { inviteId: string }) => {
      try {
        if (!socket.userId) return;

        // This would need to be implemented with game logic
        socket.emit('game_invite_declined', {
          inviteId: data.inviteId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to decline game invite' });
      }
    });
  }

  // Friend Event Handlers
  static setupFriendHandlers(socket: AuthenticatedSocket): void {
    // Send friend request
    socket.on('send_friend_request', async (data: { targetUserId: string }) => {
      try {
        if (!socket.userId) return;

        // Rate limiting
        if (!SocketAuthMiddleware.rateLimit(socket, 'send_friend_request', 5, 60000)) {
          socket.emit('error', { message: 'Rate limit exceeded. Please wait before sending more requests.' });
          return;
        }

        // Create notification
        const notification = await NotificationModel.createFriendRequestNotification(
          data.targetUserId,
          socket.username || 'Unknown'
        );

        // Send real-time notification
        socket.to(`notifications:${data.targetUserId}`).emit('friend_request', {
          id: notification.id,
          fromUserId: socket.userId,
          fromUsername: socket.username,
          timestamp: notification.created_at.toISOString()
        });

        socket.emit('friend_request_sent', {
          targetUserId: data.targetUserId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send friend request' });
      }
    });

    // Accept friend request
    socket.on('accept_friend_request', async (data: { requestId: string }) => {
      try {
        if (!socket.userId) return;

        // This would need to be implemented with friendship logic
        socket.emit('friend_request_accepted', {
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to accept friend request' });
      }
    });
  }

  // Setup all event handlers
  static setupAllHandlers(socket: AuthenticatedSocket): void {
    this.setupTeamChatHandlers(socket);
    this.setupNotificationHandlers(socket);
    this.setupTeamUpdateHandlers(socket);
    this.setupGameHandlers(socket);
    this.setupFriendHandlers(socket);
  }
}
