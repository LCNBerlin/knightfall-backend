import pool from '../config/database';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

// Helper function to convert database row to proper types
function convertDbRowToFriendship(row: any): Friendship {
  return {
    ...row,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export interface CreateFriendshipData {
  user_id: string;
  friend_id: string;
  status?: FriendshipStatus;
}

export interface UpdateFriendshipData {
  status: FriendshipStatus;
}

export class FriendshipModel {
  // Send friend request
  static async sendFriendRequest(data: CreateFriendshipData): Promise<Friendship> {
    const query = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [data.user_id, data.friend_id, data.status || 'pending'];
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to send friend request');
    }
    return convertDbRowToFriendship(result.rows[0]);
  }

  // Accept friend request
  static async acceptFriendRequest(friendshipId: string): Promise<Friendship | null> {
    const query = `
      UPDATE friendships 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [friendshipId]);
    return result.rows[0] ? convertDbRowToFriendship(result.rows[0]) : null;
  }

  // Decline friend request
  static async declineFriendRequest(friendshipId: string): Promise<boolean> {
    const query = 'DELETE FROM friendships WHERE id = $1 AND status = $2';
    const result = await pool.query(query, [friendshipId, 'pending']);
    return (result.rowCount ?? 0) > 0;
  }

  // Block user
  static async blockUser(userId: string, friendId: string): Promise<Friendship> {
    // First, remove any existing friendship
    await pool.query('DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [userId, friendId]);
    
    // Create blocked relationship
    const query = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'blocked')
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, friendId]);
    return convertDbRowToFriendship(result.rows[0]);
  }

  // Unblock user
  static async unblockUser(userId: string, friendId: string): Promise<boolean> {
    const query = 'DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2 AND status = $3';
    const result = await pool.query(query, [userId, friendId, 'blocked']);
    return (result.rowCount ?? 0) > 0;
  }

  // Remove friend
  static async removeFriend(userId: string, friendId: string): Promise<boolean> {
    const query = 'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)';
    const result = await pool.query(query, [userId, friendId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Get friendship by ID
  static async findById(id: string): Promise<Friendship | null> {
    const query = 'SELECT * FROM friendships WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToFriendship(result.rows[0]) : null;
  }

  // Get friendship between two users
  static async findByUsers(userId: string, friendId: string): Promise<Friendship | null> {
    const query = `
      SELECT * FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
    `;
    const result = await pool.query(query, [userId, friendId]);
    return result.rows[0] ? convertDbRowToFriendship(result.rows[0]) : null;
  }

  // Get user's friends
  static async getUserFriends(userId: string): Promise<Friendship[]> {
    const query = `
      SELECT f.*, u.username, u.elo_rating, u.rank
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id = u.id
          ELSE f.user_id = u.id
        END
      )
      WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
      ORDER BY f.updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToFriendship);
  }

  // Get pending friend requests (received)
  static async getPendingRequests(userId: string): Promise<Friendship[]> {
    const query = `
      SELECT f.*, u.username, u.elo_rating, u.rank
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToFriendship);
  }

  // Get sent friend requests
  static async getSentRequests(userId: string): Promise<Friendship[]> {
    const query = `
      SELECT f.*, u.username, u.elo_rating, u.rank
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToFriendship);
  }

  // Get blocked users
  static async getBlockedUsers(userId: string): Promise<Friendship[]> {
    const query = `
      SELECT f.*, u.username, u.elo_rating, u.rank
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1 AND f.status = 'blocked'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToFriendship);
  }

  // Check if users are friends
  static async areFriends(userId: string, friendId: string): Promise<boolean> {
    const query = `
      SELECT id FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
      AND status = 'accepted'
    `;
    const result = await pool.query(query, [userId, friendId]);
    return result.rows.length > 0;
  }

  // Check if user is blocked
  static async isBlocked(userId: string, friendId: string): Promise<boolean> {
    const query = `
      SELECT id FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
      AND status = 'blocked'
    `;
    const result = await pool.query(query, [userId, friendId]);
    return result.rows.length > 0;
  }

  // Get friend count
  static async getFriendCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM friendships 
      WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  // Validate friendship data
  static validateFriendshipData(data: CreateFriendshipData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.user_id || typeof data.user_id !== 'string') {
      errors.push('User ID is required');
    }

    if (!data.friend_id || typeof data.friend_id !== 'string') {
      errors.push('Friend ID is required');
    }

    if (data.user_id === data.friend_id) {
      errors.push('User cannot be friends with themselves');
    }

    if (data.status && !['pending', 'accepted', 'blocked'].includes(data.status)) {
      errors.push('Invalid status. Must be pending, accepted, or blocked');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
