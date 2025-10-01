import pool from '../config/database';

export interface TeamInvitation {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  role: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  responded_at: Date | null;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type InvitationRole = 'admin' | 'moderator' | 'member' | 'guest';

// Helper function to convert database row to proper types
function convertDbRowToTeamInvitation(row: any): TeamInvitation {
  return {
    ...row,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    responded_at: row.responded_at ? new Date(row.responded_at) : null,
  };
}

export interface CreateTeamInvitationData {
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  role: InvitationRole;
  message?: string | null;
  expires_at?: Date;
}

export interface UpdateTeamInvitationData {
  status?: InvitationStatus;
  message?: string | null;
  expires_at?: Date;
}

export class TeamInvitationModel {
  // Create a new invitation
  static async create(data: CreateTeamInvitationData): Promise<TeamInvitation> {
    const query = `
      INSERT INTO team_invitations (
        team_id, inviter_id, invitee_id, role, message, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      data.team_id,
      data.inviter_id,
      data.invitee_id,
      data.role,
      data.message || null,
      data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team invitation');
    }
    return convertDbRowToTeamInvitation(result.rows[0]);
  }

  // Get invitation by ID
  static async findById(id: string): Promise<TeamInvitation | null> {
    const query = 'SELECT * FROM team_invitations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamInvitation(result.rows[0]) : null;
  }

  // Get invitations for a team
  static async getTeamInvitations(teamId: string, status?: InvitationStatus): Promise<TeamInvitation[]> {
    let query = 'SELECT * FROM team_invitations WHERE team_id = $1';
    const values: any[] = [teamId];
    
    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, values);
    return result.rows.map(convertDbRowToTeamInvitation);
  }

  // Get invitations for a user (sent or received)
  static async getUserInvitations(userId: string, type: 'sent' | 'received'): Promise<TeamInvitation[]> {
    const field = type === 'sent' ? 'inviter_id' : 'invitee_id';
    const query = `
      SELECT * FROM team_invitations 
      WHERE ${field} = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToTeamInvitation);
  }

  // Get pending invitations for a user
  static async getPendingInvitations(userId: string): Promise<TeamInvitation[]> {
    const query = `
      SELECT * FROM team_invitations 
      WHERE invitee_id = $1 AND status = 'pending' AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToTeamInvitation);
  }

  // Check if user has pending invitation to team
  static async hasPendingInvitation(teamId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT id FROM team_invitations 
      WHERE team_id = $1 AND invitee_id = $2 AND status = 'pending' AND expires_at > NOW()
    `;
    
    const result = await pool.query(query, [teamId, userId]);
    return result.rows.length > 0;
  }

  // Update invitation
  static async update(id: string, data: UpdateTeamInvitationData): Promise<TeamInvitation | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE team_invitations 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTeamInvitation(result.rows[0]) : null;
  }

  // Accept invitation
  static async acceptInvitation(id: string): Promise<TeamInvitation | null> {
    const query = `
      UPDATE team_invitations 
      SET status = 'accepted', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending' AND expires_at > NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamInvitation(result.rows[0]) : null;
  }

  // Decline invitation
  static async declineInvitation(id: string): Promise<TeamInvitation | null> {
    const query = `
      UPDATE team_invitations 
      SET status = 'declined', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamInvitation(result.rows[0]) : null;
  }

  // Cancel invitation
  static async cancelInvitation(id: string): Promise<TeamInvitation | null> {
    const query = `
      UPDATE team_invitations 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamInvitation(result.rows[0]) : null;
  }

  // Delete invitation
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM team_invitations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Clean up expired invitations
  static async cleanupExpiredInvitations(): Promise<number> {
    const query = `
      UPDATE team_invitations 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'pending' AND expires_at <= NOW()
    `;
    
    const result = await pool.query(query);
    return result.rowCount ?? 0;
  }

  // Get invitation statistics for a team
  static async getTeamInvitationStats(teamId: string): Promise<{
    total: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
    cancelled: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM team_invitations 
      WHERE team_id = $1
    `;
    
    const result = await pool.query(query, [teamId]);
    const stats = result.rows[0];
    
    return {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      accepted: parseInt(stats.accepted, 10),
      declined: parseInt(stats.declined, 10),
      expired: parseInt(stats.expired, 10),
      cancelled: parseInt(stats.cancelled, 10),
    };
  }

  // Validate invitation data
  static validateInvitationData(data: CreateTeamInvitationData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (!data.inviter_id || typeof data.inviter_id !== 'string') {
      errors.push('Inviter ID is required');
    }

    if (!data.invitee_id || typeof data.invitee_id !== 'string') {
      errors.push('Invitee ID is required');
    }

    if (data.inviter_id === data.invitee_id) {
      errors.push('Cannot invite yourself');
    }

    if (!data.role || !['admin', 'moderator', 'member', 'guest'].includes(data.role)) {
      errors.push('Invalid role. Must be admin, moderator, member, or guest');
    }

    if (data.message && typeof data.message !== 'string') {
      errors.push('Message must be a string');
    }

    if (data.message && data.message.length > 500) {
      errors.push('Message must be 500 characters or less');
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      errors.push('Expiration date must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check if user can invite to team (permission check)
  static async canInviteToTeam(teamId: string, inviterId: string): Promise<{ canInvite: boolean; reason?: string }> {
    // This would typically check team membership and permissions
    // For now, we'll implement a basic check
    try {
      // Check if inviter is a member of the team
      const membershipQuery = 'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2';
      const membershipResult = await pool.query(membershipQuery, [teamId, inviterId]);
      
      if (membershipResult.rows.length === 0) {
        return { canInvite: false, reason: 'You are not a member of this team' };
      }

      const inviterRole = membershipResult.rows[0].role;
      
      // Only owners, admins, and moderators can invite (based on permission system)
      if (!['owner', 'admin', 'moderator'].includes(inviterRole)) {
        return { canInvite: false, reason: 'Insufficient permissions to invite members' };
      }

      return { canInvite: true };
    } catch (error) {
      console.error('Error checking invite permissions:', error);
      return { canInvite: false, reason: 'Error checking permissions' };
    }
  }
}
