import pool from '../config/database';

export interface TeamPermission {
  id: string;
  team_id: string;
  role: string;
  permission: string;
  granted: boolean;
  granted_by: string;
  granted_at: Date;
  expires_at: Date | null;
}

export type PermissionType = 
  | 'team.manage'           // Manage team settings
  | 'team.delete'           // Delete team
  | 'team.invite'           // Invite members
  | 'team.kick'             // Remove members
  | 'team.promote'          // Promote/demote members
  | 'team.chat'             // Send team chat messages
  | 'team.chat.moderate'    // Moderate team chat
  | 'team.tournament.create' // Create tournaments
  | 'team.tournament.join'  // Join tournaments
  | 'team.tournament.manage' // Manage team tournaments
  | 'team.analytics.view'   // View team analytics
  | 'team.analytics.export' // Export team data
  | 'team.leaderboard.view' // View team leaderboards
  | 'team.achievements.manage' // Manage team achievements
  | 'team.settings.update'  // Update team settings
  | 'team.members.view'     // View team members
  | 'team.members.manage'   // Manage team members
  | 'team.finances.view'    // View team finances
  | 'team.finances.manage'; // Manage team finances

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';

// Helper function to convert database row to proper types
function convertDbRowToTeamPermission(row: any): TeamPermission {
  return {
    ...row,
    granted: Boolean(row.granted),
    granted_at: new Date(row.granted_at),
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
  };
}

export interface CreateTeamPermissionData {
  team_id: string;
  role: TeamRole;
  permission: PermissionType;
  granted: boolean;
  granted_by: string;
  expires_at?: Date | null;
}

export interface UpdateTeamPermissionData {
  granted?: boolean;
  expires_at?: Date | null;
}

export class TeamPermissionModel {
  // Create a new permission
  static async create(data: CreateTeamPermissionData): Promise<TeamPermission> {
    const query = `
      INSERT INTO team_permissions (
        team_id, role, permission, granted, granted_by, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      data.team_id,
      data.role,
      data.permission,
      data.granted,
      data.granted_by,
      data.expires_at || null
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team permission');
    }
    return convertDbRowToTeamPermission(result.rows[0]);
  }

  // Get permission by ID
  static async findById(id: string): Promise<TeamPermission | null> {
    const query = 'SELECT * FROM team_permissions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamPermission(result.rows[0]) : null;
  }

  // Get permissions for a team and role
  static async getPermissionsForRole(teamId: string, role: TeamRole): Promise<TeamPermission[]> {
    const query = `
      SELECT * FROM team_permissions 
      WHERE team_id = $1 AND role = $2
      ORDER BY permission ASC
    `;
    const result = await pool.query(query, [teamId, role]);
    return result.rows.map(convertDbRowToTeamPermission);
  }

  // Get all permissions for a team
  static async getTeamPermissions(teamId: string): Promise<TeamPermission[]> {
    const query = `
      SELECT * FROM team_permissions 
      WHERE team_id = $1
      ORDER BY role ASC, permission ASC
    `;
    const result = await pool.query(query, [teamId]);
    return result.rows.map(convertDbRowToTeamPermission);
  }

  // Check if a role has a specific permission
  static async hasPermission(
    teamId: string, 
    role: TeamRole, 
    permission: PermissionType
  ): Promise<boolean> {
    const query = `
      SELECT granted FROM team_permissions 
      WHERE team_id = $1 AND role = $2 AND permission = $3
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const result = await pool.query(query, [teamId, role, permission]);
    return result.rows.length > 0 && result.rows[0].granted === true;
  }

  // Update permission
  static async update(id: string, data: UpdateTeamPermissionData): Promise<TeamPermission | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE team_permissions 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTeamPermission(result.rows[0]) : null;
  }

  // Delete permission
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM team_permissions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Initialize default permissions for a team
  static async initializeDefaultPermissions(teamId: string, createdBy: string): Promise<void> {
    const defaultPermissions = this.getDefaultPermissions();
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const permission of defaultPermissions) {
        await client.query(`
          INSERT INTO team_permissions (team_id, role, permission, granted, granted_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [teamId, permission.role, permission.permission, permission.granted, createdBy]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get default permissions for all roles
  static getDefaultPermissions(): Array<{ role: TeamRole; permission: PermissionType; granted: boolean }> {
    return [
      // Owner permissions (all permissions)
      { role: 'owner', permission: 'team.manage', granted: true },
      { role: 'owner', permission: 'team.delete', granted: true },
      { role: 'owner', permission: 'team.invite', granted: true },
      { role: 'owner', permission: 'team.kick', granted: true },
      { role: 'owner', permission: 'team.promote', granted: true },
      { role: 'owner', permission: 'team.chat', granted: true },
      { role: 'owner', permission: 'team.chat.moderate', granted: true },
      { role: 'owner', permission: 'team.tournament.create', granted: true },
      { role: 'owner', permission: 'team.tournament.join', granted: true },
      { role: 'owner', permission: 'team.tournament.manage', granted: true },
      { role: 'owner', permission: 'team.analytics.view', granted: true },
      { role: 'owner', permission: 'team.analytics.export', granted: true },
      { role: 'owner', permission: 'team.leaderboard.view', granted: true },
      { role: 'owner', permission: 'team.achievements.manage', granted: true },
      { role: 'owner', permission: 'team.settings.update', granted: true },
      { role: 'owner', permission: 'team.members.view', granted: true },
      { role: 'owner', permission: 'team.members.manage', granted: true },
      { role: 'owner', permission: 'team.finances.view', granted: true },
      { role: 'owner', permission: 'team.finances.manage', granted: true },

      // Admin permissions
      { role: 'admin', permission: 'team.manage', granted: true },
      { role: 'admin', permission: 'team.delete', granted: false },
      { role: 'admin', permission: 'team.invite', granted: true },
      { role: 'admin', permission: 'team.kick', granted: true },
      { role: 'admin', permission: 'team.promote', granted: true },
      { role: 'admin', permission: 'team.chat', granted: true },
      { role: 'admin', permission: 'team.chat.moderate', granted: true },
      { role: 'admin', permission: 'team.tournament.create', granted: true },
      { role: 'admin', permission: 'team.tournament.join', granted: true },
      { role: 'admin', permission: 'team.tournament.manage', granted: true },
      { role: 'admin', permission: 'team.analytics.view', granted: true },
      { role: 'admin', permission: 'team.analytics.export', granted: true },
      { role: 'admin', permission: 'team.leaderboard.view', granted: true },
      { role: 'admin', permission: 'team.achievements.manage', granted: true },
      { role: 'admin', permission: 'team.settings.update', granted: true },
      { role: 'admin', permission: 'team.members.view', granted: true },
      { role: 'admin', permission: 'team.members.manage', granted: true },
      { role: 'admin', permission: 'team.finances.view', granted: true },
      { role: 'admin', permission: 'team.finances.manage', granted: false },

      // Moderator permissions
      { role: 'moderator', permission: 'team.manage', granted: false },
      { role: 'moderator', permission: 'team.delete', granted: false },
      { role: 'moderator', permission: 'team.invite', granted: false },
      { role: 'moderator', permission: 'team.kick', granted: true },
      { role: 'moderator', permission: 'team.promote', granted: false },
      { role: 'moderator', permission: 'team.chat', granted: true },
      { role: 'moderator', permission: 'team.chat.moderate', granted: true },
      { role: 'moderator', permission: 'team.tournament.create', granted: false },
      { role: 'moderator', permission: 'team.tournament.join', granted: true },
      { role: 'moderator', permission: 'team.tournament.manage', granted: false },
      { role: 'moderator', permission: 'team.analytics.view', granted: true },
      { role: 'moderator', permission: 'team.analytics.export', granted: false },
      { role: 'moderator', permission: 'team.leaderboard.view', granted: true },
      { role: 'moderator', permission: 'team.achievements.manage', granted: false },
      { role: 'moderator', permission: 'team.settings.update', granted: false },
      { role: 'moderator', permission: 'team.members.view', granted: true },
      { role: 'moderator', permission: 'team.members.manage', granted: false },
      { role: 'moderator', permission: 'team.finances.view', granted: false },
      { role: 'moderator', permission: 'team.finances.manage', granted: false },

      // Member permissions
      { role: 'member', permission: 'team.manage', granted: false },
      { role: 'member', permission: 'team.delete', granted: false },
      { role: 'member', permission: 'team.invite', granted: false },
      { role: 'member', permission: 'team.kick', granted: false },
      { role: 'member', permission: 'team.promote', granted: false },
      { role: 'member', permission: 'team.chat', granted: true },
      { role: 'member', permission: 'team.chat.moderate', granted: false },
      { role: 'member', permission: 'team.tournament.create', granted: false },
      { role: 'member', permission: 'team.tournament.join', granted: true },
      { role: 'member', permission: 'team.tournament.manage', granted: false },
      { role: 'member', permission: 'team.analytics.view', granted: true },
      { role: 'member', permission: 'team.analytics.export', granted: false },
      { role: 'member', permission: 'team.leaderboard.view', granted: true },
      { role: 'member', permission: 'team.achievements.manage', granted: false },
      { role: 'member', permission: 'team.settings.update', granted: false },
      { role: 'member', permission: 'team.members.view', granted: true },
      { role: 'member', permission: 'team.members.manage', granted: false },
      { role: 'member', permission: 'team.finances.view', granted: false },
      { role: 'member', permission: 'team.finances.manage', granted: false },

      // Guest permissions
      { role: 'guest', permission: 'team.manage', granted: false },
      { role: 'guest', permission: 'team.delete', granted: false },
      { role: 'guest', permission: 'team.invite', granted: false },
      { role: 'guest', permission: 'team.kick', granted: false },
      { role: 'guest', permission: 'team.promote', granted: false },
      { role: 'guest', permission: 'team.chat', granted: false },
      { role: 'guest', permission: 'team.chat.moderate', granted: false },
      { role: 'guest', permission: 'team.tournament.create', granted: false },
      { role: 'guest', permission: 'team.tournament.join', granted: false },
      { role: 'guest', permission: 'team.tournament.manage', granted: false },
      { role: 'guest', permission: 'team.analytics.view', granted: false },
      { role: 'guest', permission: 'team.analytics.export', granted: false },
      { role: 'guest', permission: 'team.leaderboard.view', granted: true },
      { role: 'guest', permission: 'team.achievements.manage', granted: false },
      { role: 'guest', permission: 'team.settings.update', granted: false },
      { role: 'guest', permission: 'team.members.view', granted: true },
      { role: 'guest', permission: 'team.members.manage', granted: false },
      { role: 'guest', permission: 'team.finances.view', granted: false },
      { role: 'guest', permission: 'team.finances.manage', granted: false },
    ];
  }

  // Get permission hierarchy
  static getRoleHierarchy(): TeamRole[] {
    return ['owner', 'admin', 'moderator', 'member', 'guest'];
  }

  // Check if role can manage another role
  static canManageRole(managerRole: TeamRole, targetRole: TeamRole): boolean {
    const hierarchy = this.getRoleHierarchy();
    const managerIndex = hierarchy.indexOf(managerRole);
    const targetIndex = hierarchy.indexOf(targetRole);
    
    // Can only manage roles below in hierarchy, and not self
    return managerIndex < targetIndex;
  }

  // Validate permission data
  static validatePermissionData(data: CreateTeamPermissionData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (!data.role || !['owner', 'admin', 'moderator', 'member', 'guest'].includes(data.role)) {
      errors.push('Invalid role');
    }

    if (!data.permission || typeof data.permission !== 'string') {
      errors.push('Permission is required');
    }

    if (typeof data.granted !== 'boolean') {
      errors.push('Granted must be a boolean');
    }

    if (!data.granted_by || typeof data.granted_by !== 'string') {
      errors.push('Granted by user ID is required');
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      errors.push('Expiration date must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
