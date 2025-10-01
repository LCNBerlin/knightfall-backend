import pool from '../config/database';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: any; // JSON data for additional context
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

export type NotificationType = 
  | 'friend_request'
  | 'friend_accepted'
  | 'team_invite'
  | 'team_join'
  | 'team_leave'
  | 'team_message'
  | 'game_invite'
  | 'game_result'
  | 'tournament_start'
  | 'tournament_result'
  | 'achievement'
  | 'system';

// Helper function to convert database row to proper types
function convertDbRowToNotification(row: any): Notification {
  return {
    ...row,
    data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {},
    created_at: new Date(row.created_at),
    read_at: row.read_at ? new Date(row.read_at) : null,
  };
}

export interface CreateNotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export class NotificationModel {
  // Create a new notification
  static async create(data: CreateNotificationData): Promise<Notification> {
    const query = `
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      data.user_id, 
      data.type, 
      data.title, 
      data.message, 
      JSON.stringify(data.data || {})
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create notification');
    }
    return convertDbRowToNotification(result.rows[0]);
  }

  // Get user's notifications with pagination
  static async getUserNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows.map(convertDbRowToNotification);
  }

  // Get unread notifications
  static async getUnreadNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 AND is_read = false
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows.map(convertDbRowToNotification);
  }

  // Get notification by ID
  static async findById(id: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToNotification(result.rows[0]) : null;
  }

  // Mark notification as read
  static async markAsRead(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await pool.query(query, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rowCount ?? 0;
  }

  // Delete notification
  static async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM notifications WHERE id = $1 AND user_id = $2';
    const result = await pool.query(query, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Delete all read notifications
  static async deleteReadNotifications(userId: string): Promise<number> {
    const query = 'DELETE FROM notifications WHERE user_id = $1 AND is_read = true';
    const result = await pool.query(query, [userId]);
    return result.rowCount ?? 0;
  }

  // Get notification count
  static async getNotificationCount(userId: string): Promise<{ total: number; unread: number }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread
      FROM notifications 
      WHERE user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      unread: parseInt(row.unread)
    };
  }

  // Get notifications by type
  static async getNotificationsByType(userId: string, type: NotificationType, limit: number = 20): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [userId, type, limit]);
    return result.rows.map(convertDbRowToNotification);
  }

  // Create friend request notification
  static async createFriendRequestNotification(userId: string, fromUsername: string): Promise<Notification> {
    return this.create({
      user_id: userId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUsername} sent you a friend request`,
      data: { from_username: fromUsername }
    });
  }

  // Create friend accepted notification
  static async createFriendAcceptedNotification(userId: string, fromUsername: string): Promise<Notification> {
    return this.create({
      user_id: userId,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${fromUsername} accepted your friend request`,
      data: { from_username: fromUsername }
    });
  }

  // Create team invite notification
  static async createTeamInviteNotification(userId: string, teamName: string, fromUsername: string): Promise<Notification> {
    return this.create({
      user_id: userId,
      type: 'team_invite',
      title: 'Team Invitation',
      message: `${fromUsername} invited you to join ${teamName}`,
      data: { team_name: teamName, from_username: fromUsername }
    });
  }

  // Create team join notification
  static async createTeamJoinNotification(teamId: string, username: string): Promise<Notification[]> {
    // Get all team members except the one who joined
    const teamMembersQuery = `
      SELECT DISTINCT user_id FROM team_memberships 
      WHERE team_id = $1
    `;
    const teamMembers = await pool.query(teamMembersQuery, [teamId]);
    
    const notifications: Notification[] = [];
    for (const member of teamMembers.rows) {
      const notification = await this.create({
        user_id: member.user_id,
        type: 'team_join',
        title: 'New Team Member',
        message: `${username} joined the team`,
        data: { team_id: teamId, username }
      });
      notifications.push(notification);
    }
    
    return notifications;
  }

  // Create game invite notification
  static async createGameInviteNotification(userId: string, fromUsername: string, gameType: string): Promise<Notification> {
    return this.create({
      user_id: userId,
      type: 'game_invite',
      title: 'Game Invitation',
      message: `${fromUsername} invited you to a ${gameType} game`,
      data: { from_username: fromUsername, game_type: gameType }
    });
  }

  // Validate notification data
  static validateNotificationData(data: CreateNotificationData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.user_id || typeof data.user_id !== 'string') {
      errors.push('User ID is required');
    }

    if (!data.type || !['friend_request', 'friend_accepted', 'team_invite', 'team_join', 'team_leave', 'team_message', 'game_invite', 'game_result', 'tournament_start', 'tournament_result', 'achievement', 'system'].includes(data.type)) {
      errors.push('Invalid notification type');
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
      errors.push('Message is required');
    }

    if (data.title && data.title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }

    if (data.message && data.message.length > 500) {
      errors.push('Message must be less than 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
