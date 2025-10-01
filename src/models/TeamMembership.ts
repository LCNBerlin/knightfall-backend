import pool from '../config/database';

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: Date;
}

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member';

// Helper function to convert database row to proper types
function convertDbRowToTeamMembership(row: any): TeamMembership {
  return {
    ...row,
    joined_at: new Date(row.joined_at),
  };
}

export interface CreateTeamMembershipData {
  team_id: string;
  user_id: string;
  role?: TeamRole;
}

export interface UpdateTeamMembershipData {
  role?: TeamRole;
}

export class TeamMembershipModel {
  // Create a new team membership
  static async create(data: CreateTeamMembershipData): Promise<TeamMembership> {
    const query = `
      INSERT INTO team_memberships (team_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [data.team_id, data.user_id, data.role || 'member'];
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team membership');
    }
    return convertDbRowToTeamMembership(result.rows[0]);
  }

  // Find membership by ID
  static async findById(id: string): Promise<TeamMembership | null> {
    const query = 'SELECT * FROM team_memberships WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamMembership(result.rows[0]) : null;
  }

  // Find membership by team and user
  static async findByTeamAndUser(teamId: string, userId: string): Promise<TeamMembership | null> {
    const query = 'SELECT * FROM team_memberships WHERE team_id = $1 AND user_id = $2';
    const result = await pool.query(query, [teamId, userId]);
    return result.rows[0] ? convertDbRowToTeamMembership(result.rows[0]) : null;
  }

  // Get all members of a team
  static async getTeamMembers(teamId: string): Promise<TeamMembership[]> {
    const query = `
      SELECT tm.*, u.username, u.elo_rating, u.rank
      FROM team_memberships tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at ASC
    `;
    const result = await pool.query(query, [teamId]);
    return result.rows.map(convertDbRowToTeamMembership);
  }

  // Get all teams a user belongs to
  static async getUserTeams(userId: string): Promise<TeamMembership[]> {
    const query = `
      SELECT tm.*, t.name as team_name, t.description, t.house_color
      FROM team_memberships tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY tm.joined_at ASC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(convertDbRowToTeamMembership);
  }

  // Update membership role
  static async updateRole(id: string, role: TeamRole): Promise<TeamMembership | null> {
    const query = `
      UPDATE team_memberships 
      SET role = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, role]);
    return result.rows[0] ? convertDbRowToTeamMembership(result.rows[0]) : null;
  }

  // Remove user from team
  static async removeFromTeam(teamId: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2';
    const result = await pool.query(query, [teamId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Remove membership by ID
  static async removeById(id: string): Promise<boolean> {
    const query = 'DELETE FROM team_memberships WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Check if user is member of team
  static async isMember(teamId: string, userId: string): Promise<boolean> {
    const query = 'SELECT id FROM team_memberships WHERE team_id = $1 AND user_id = $2';
    const result = await pool.query(query, [teamId, userId]);
    return result.rows.length > 0;
  }

  // Check if user has specific role in team
  static async hasRole(teamId: string, userId: string, role: TeamRole): Promise<boolean> {
    const query = 'SELECT id FROM team_memberships WHERE team_id = $1 AND user_id = $2 AND role = $3';
    const result = await pool.query(query, [teamId, userId, role]);
    return result.rows.length > 0;
  }

  // Get team member count
  static async getTeamMemberCount(teamId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM team_memberships WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return parseInt(result.rows[0].count);
  }

  // Get user's role in team
  static async getUserRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const query = 'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2';
    const result = await pool.query(query, [teamId, userId]);
    return result.rows[0] ? result.rows[0].role : null;
  }

  // Check if user can perform action (role hierarchy)
  static canPerformAction(userRole: TeamRole, targetRole: TeamRole): boolean {
    const roleHierarchy = {
      'owner': 4,
      'admin': 3,
      'moderator': 2,
      'member': 1
    };

    return roleHierarchy[userRole] > roleHierarchy[targetRole];
  }

  // Get team owners
  static async getTeamOwners(teamId: string): Promise<TeamMembership[]> {
    const query = 'SELECT * FROM team_memberships WHERE team_id = $1 AND role = $2';
    const result = await pool.query(query, [teamId, 'owner']);
    return result.rows.map(convertDbRowToTeamMembership);
  }

  // Transfer team ownership
  static async transferOwnership(teamId: string, fromUserId: string, toUserId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove owner role from current owner
      await client.query(
        'UPDATE team_memberships SET role = $3 WHERE team_id = $1 AND user_id = $2 AND role = $4',
        [teamId, fromUserId, 'member', 'owner']
      );

      // Make new user the owner
      await client.query(
        'UPDATE team_memberships SET role = $3 WHERE team_id = $1 AND user_id = $2',
        [teamId, toUserId, 'owner']
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Validate membership data
  static validateMembershipData(data: CreateTeamMembershipData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (!data.user_id || typeof data.user_id !== 'string') {
      errors.push('User ID is required');
    }

    if (data.role && !['owner', 'admin', 'moderator', 'member'].includes(data.role)) {
      errors.push('Invalid role. Must be owner, admin, moderator, or member');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

