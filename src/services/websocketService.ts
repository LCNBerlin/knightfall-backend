import { SocketServer } from '../socket/socketServer';
import { NotificationModel } from '../models/Notification';
import { TeamAchievementModel } from '../models/TeamAchievement';

export class WebSocketService {
  private static socketServer: SocketServer | null = null;

  // Initialize the WebSocket service
  static initialize(socketServer: SocketServer): void {
    this.socketServer = socketServer;
  }

  // Send notification to user
  static async sendNotification(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    if (!this.socketServer) return;

    try {
      // Create notification in database
      const savedNotification = await NotificationModel.create({
        user_id: userId,
        type: notification.type as any,
        title: notification.title,
        message: notification.message,
        data: notification.data
      });

      // Send real-time notification
      this.socketServer.sendNotification(userId, {
        id: savedNotification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        is_read: false,
        created_at: savedNotification.created_at.toISOString()
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  // Send friend request notification
  static async sendFriendRequestNotification(userId: string, fromUsername: string): Promise<void> {
    if (!this.socketServer) return;

    try {
      const notification = await NotificationModel.createFriendRequestNotification(userId, fromUsername);
      
      this.socketServer.sendNotification(userId, {
        id: notification.id,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${fromUsername} sent you a friend request`,
        data: { from_username: fromUsername },
        is_read: false,
        created_at: notification.created_at.toISOString()
      });
    } catch (error) {
      console.error('Failed to send friend request notification:', error);
    }
  }

  // Send friend accepted notification
  static async sendFriendAcceptedNotification(userId: string, fromUsername: string): Promise<void> {
    if (!this.socketServer) return;

    try {
      const notification = await NotificationModel.createFriendAcceptedNotification(userId, fromUsername);
      
      this.socketServer.sendNotification(userId, {
        id: notification.id,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${fromUsername} accepted your friend request`,
        data: { from_username: fromUsername },
        is_read: false,
        created_at: notification.created_at.toISOString()
      });
    } catch (error) {
      console.error('Failed to send friend accepted notification:', error);
    }
  }

  // Send team join notification
  static async sendTeamJoinNotification(teamId: string, username: string): Promise<void> {
    if (!this.socketServer) return;

    try {
      const notifications = await NotificationModel.createTeamJoinNotification(teamId, username);
      
      // Send team update to all team members
      this.socketServer.sendTeamUpdate(teamId, {
        type: 'member_joined',
        message: `${username} joined the team`,
        data: { username, teamId },
        timestamp: new Date().toISOString()
      });

      // Send individual notifications
      notifications.forEach(notification => {
        this.socketServer?.sendNotification(notification.user_id, {
          id: notification.id,
          type: 'team_join',
          title: 'New Team Member',
          message: `${username} joined the team`,
          data: { team_id: teamId, username },
          is_read: false,
          created_at: notification.created_at.toISOString()
        });
      });
    } catch (error) {
      console.error('Failed to send team join notification:', error);
    }
  }

  // Send team leave notification
  static async sendTeamLeaveNotification(teamId: string, username: string): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendTeamUpdate(teamId, {
        type: 'member_left',
        message: `${username} left the team`,
        data: { username, teamId },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send team leave notification:', error);
    }
  }

  // Send achievement notification
  static async sendAchievementNotification(userId: string, achievement: {
    type: string;
    description: string;
    points: number;
  }): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendAchievementNotification(userId, {
        type: 'achievement',
        title: 'Achievement Unlocked!',
        message: achievement.description,
        data: achievement,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send achievement notification:', error);
    }
  }

  // Send game invite notification
  static async sendGameInviteNotification(userId: string, fromUsername: string, gameType: string): Promise<void> {
    if (!this.socketServer) return;

    try {
      const notification = await NotificationModel.createGameInviteNotification(userId, fromUsername, gameType);
      
      this.socketServer.sendNotification(userId, {
        id: notification.id,
        type: 'game_invite',
        title: 'Game Invitation',
        message: `${fromUsername} invited you to a ${gameType} game`,
        data: { from_username: fromUsername, game_type: gameType },
        is_read: false,
        created_at: notification.created_at.toISOString()
      });
    } catch (error) {
      console.error('Failed to send game invite notification:', error);
    }
  }

  // Send team chat message
  static sendTeamChatMessage(teamId: string, message: {
    id: string;
    userId: string;
    username: string;
    message: string;
    messageType: string;
    timestamp: string;
  }): void {
    if (!this.socketServer) return;

    this.socketServer.sendTeamChatMessage(teamId, message);
  }

  // Send team update
  static sendTeamUpdate(teamId: string, update: {
    type: string;
    message: string;
    data: any;
    timestamp: string;
  }): void {
    if (!this.socketServer) return;

    this.socketServer.sendTeamUpdate(teamId, update);
  }

  // Check if user is online
  static isUserOnline(userId: string): boolean {
    if (!this.socketServer) return false;
    return this.socketServer.isUserOnline(userId);
  }

  // Get connected users count
  static getConnectedUsersCount(): number {
    if (!this.socketServer) return 0;
    return this.socketServer.getConnectedUsersCount();
  }

  // Get users in team chat
  static getUsersInTeamChat(teamId: string): string[] {
    if (!this.socketServer) return [];
    return this.socketServer.getUsersInTeamChat(teamId);
  }

  // Send notification to multiple users
  static async sendNotificationToUsers(userIds: string[], notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    if (!this.socketServer) return;

    try {
      // Create notifications for all users
      const notifications = await Promise.all(
        userIds.map(userId => 
          NotificationModel.create({
            user_id: userId,
            type: notification.type as any,
            title: notification.title,
            message: notification.message,
            data: notification.data
          })
        )
      );

      // Send real-time notifications
      this.socketServer.sendNotificationToUsers(userIds, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send notifications to users:', error);
    }
  }

  // Broadcast system message to all connected users
  static broadcastSystemMessage(message: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }): void {
    if (!this.socketServer) return;

    // This would need to be implemented in the SocketServer class
    // For now, we'll just log it
    console.log('System broadcast:', message);
  }

  // Send leaderboard update
  static sendLeaderboardUpdate(teamId: string, update: {
    type: 'rating_change' | 'achievement' | 'game_result';
    data: any;
  }): void {
    if (!this.socketServer) return;

    this.socketServer.sendTeamUpdate(teamId, {
      type: 'leaderboard_update',
      message: 'Team leaderboard updated',
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  // Send team invitation notification
  static async sendTeamInvitationNotification(userId: string, invitationData: any): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendToUser(userId, 'team_invitation', {
        ...invitationData,
        message: `You've been invited to join ${invitationData.team_name}`
      });
    } catch (error) {
      console.error('Failed to send team invitation notification:', error);
    }
  }

  // Send invitation accepted notification
  static async sendInvitationAcceptedNotification(userId: string, data: any): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendToUser(userId, 'invitation_accepted', {
        ...data,
        message: `${data.invitee_username} accepted your invitation to join ${data.team_name}`
      });
    } catch (error) {
      console.error('Failed to send invitation accepted notification:', error);
    }
  }

  // Send invitation declined notification
  static async sendInvitationDeclinedNotification(userId: string, data: any): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendToUser(userId, 'invitation_declined', {
        ...data,
        message: `${data.invitee_username} declined your invitation to join ${data.team_name}`
      });
    } catch (error) {
      console.error('Failed to send invitation declined notification:', error);
    }
  }

  // Send team member joined notification
  static async sendTeamMemberJoinedNotification(teamId: string, data: any): Promise<void> {
    if (!this.socketServer) return;

    try {
      this.socketServer.sendToTeam(teamId, 'member_joined', {
        ...data,
        message: `${data.username} joined the team as ${data.role}`
      });
    } catch (error) {
      console.error('Failed to send team member joined notification:', error);
    }
  }
}
