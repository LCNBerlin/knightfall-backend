import pool from '../config/database';

export interface TeamChatMessage {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
  message_type: MessageType;
  created_at: Date;
}

export type MessageType = 'text' | 'system' | 'announcement';

// Helper function to convert database row to proper types
function convertDbRowToTeamChatMessage(row: any): TeamChatMessage {
  return {
    ...row,
    created_at: new Date(row.created_at),
  };
}

export interface CreateTeamChatMessageData {
  team_id: string;
  user_id: string;
  message: string;
  message_type?: MessageType;
}

export class TeamChatMessageModel {
  // Send a message to team chat
  static async sendMessage(data: CreateTeamChatMessageData): Promise<TeamChatMessage> {
    const query = `
      INSERT INTO team_chat_messages (team_id, user_id, message, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [data.team_id, data.user_id, data.message, data.message_type || 'text'];
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to send message');
    }
    return convertDbRowToTeamChatMessage(result.rows[0]);
  }

  // Get team chat messages with pagination
  static async getTeamMessages(teamId: string, limit: number = 50, offset: number = 0): Promise<TeamChatMessage[]> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.team_id = $1
      ORDER BY tcm.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [teamId, limit, offset]);
    return result.rows.map(convertDbRowToTeamChatMessage);
  }

  // Get recent team messages (last 24 hours)
  static async getRecentTeamMessages(teamId: string, limit: number = 100): Promise<TeamChatMessage[]> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.team_id = $1 AND tcm.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY tcm.created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [teamId, limit]);
    return result.rows.map(convertDbRowToTeamChatMessage);
  }

  // Get message by ID
  static async findById(id: string): Promise<TeamChatMessage | null> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamChatMessage(result.rows[0]) : null;
  }

  // Delete message (only by sender or team admin)
  static async deleteMessage(messageId: string, userId: string, userRole?: string): Promise<boolean> {
    let query = 'DELETE FROM team_chat_messages WHERE id = $1';
    let values = [messageId];

    // If not admin/owner, only allow sender to delete
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      query += ' AND user_id = $2';
      values.push(userId);
    }

    const result = await pool.query(query, values);
    return (result.rowCount ?? 0) > 0;
  }

  // Get message count for team
  static async getMessageCount(teamId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM team_chat_messages WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return parseInt(result.rows[0].count);
  }

  // Search messages in team
  static async searchTeamMessages(teamId: string, searchTerm: string, limit: number = 20): Promise<TeamChatMessage[]> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.team_id = $1 AND tcm.message ILIKE $2
      ORDER BY tcm.created_at DESC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [teamId, `%${searchTerm}%`, limit]);
    return result.rows.map(convertDbRowToTeamChatMessage);
  }

  // Get user's messages in team
  static async getUserMessagesInTeam(teamId: string, userId: string, limit: number = 20): Promise<TeamChatMessage[]> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.team_id = $1 AND tcm.user_id = $2
      ORDER BY tcm.created_at DESC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [teamId, userId, limit]);
    return result.rows.map(convertDbRowToTeamChatMessage);
  }

  // Get team activity (system messages and announcements)
  static async getTeamActivity(teamId: string, limit: number = 20): Promise<TeamChatMessage[]> {
    const query = `
      SELECT tcm.*, u.username, u.rank
      FROM team_chat_messages tcm
      JOIN users u ON tcm.user_id = u.id
      WHERE tcm.team_id = $1 AND tcm.message_type IN ('system', 'announcement')
      ORDER BY tcm.created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [teamId, limit]);
    return result.rows.map(convertDbRowToTeamChatMessage);
  }

  // Validate message data
  static validateMessageData(data: CreateTeamChatMessageData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (!data.user_id || typeof data.user_id !== 'string') {
      errors.push('User ID is required');
    }

    if (!data.message || typeof data.message !== 'string') {
      errors.push('Message is required');
    } else if (data.message.trim().length === 0) {
      errors.push('Message cannot be empty');
    } else if (data.message.length > 1000) {
      errors.push('Message must be less than 1000 characters');
    }

    if (data.message_type && !['text', 'system', 'announcement'].includes(data.message_type)) {
      errors.push('Invalid message type. Must be text, system, or announcement');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
