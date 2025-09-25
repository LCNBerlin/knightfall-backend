import pool from '../config/database';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  house_color: string | null;
  created_at: Date;
  updated_at: Date;
}

// Helper function to convert database row to proper types
function convertDbRowToTeam(row: any): Team {
  return {
    ...row,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export interface CreateTeamData {
  name: string;
  description?: string;
  logo_url?: string;
  house_color?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  logo_url?: string;
  house_color?: string;
}

export class TeamModel {
  // Create a new team
  static async create(data: CreateTeamData): Promise<Team> {
    const query = `
      INSERT INTO teams (name, description, logo_url, house_color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      data.name, 
      data.description || null, 
      data.logo_url || null, 
      data.house_color || null
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team');
    }
    return convertDbRowToTeam(result.rows[0]);
  }

  // Find team by ID
  static async findById(id: string): Promise<Team | null> {
    const query = 'SELECT * FROM teams WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeam(result.rows[0]) : null;
  }

  // Find team by name
  static async findByName(name: string): Promise<Team | null> {
    const query = 'SELECT * FROM teams WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0] ? convertDbRowToTeam(result.rows[0]) : null;
  }

  // Get all teams with pagination
  static async findAll(limit: number = 20, offset: number = 0): Promise<Team[]> {
    const query = `
      SELECT * FROM teams 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(convertDbRowToTeam);
  }

  // Search teams by name
  static async searchByName(searchTerm: string, limit: number = 20): Promise<Team[]> {
    const query = `
      SELECT * FROM teams 
      WHERE name ILIKE $1 
      ORDER BY name ASC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows.map(convertDbRowToTeam);
  }

  // Update team
  static async update(id: string, data: UpdateTeamData): Promise<Team | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE teams 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTeam(result.rows[0]) : null;
  }

  // Delete team
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM teams WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Check if team name exists
  static async nameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT id FROM teams WHERE name = $1';
    let values = [name];
    
    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }
    
    const result = await pool.query(query, values);
    return result.rows.length > 0;
  }

  // Get team count
  static async getCount(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM teams';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Get team with member count
  static async findByIdWithMemberCount(id: string): Promise<(Team & { member_count: number }) | null> {
    const query = `
      SELECT t.*, COUNT(tm.user_id) as member_count
      FROM teams t
      LEFT JOIN team_memberships tm ON t.id = tm.team_id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    
    const result = await pool.query(query, [id]);
    if (!result.rows[0]) return null;
    
    return {
      ...convertDbRowToTeam(result.rows[0]),
      member_count: parseInt(result.rows[0].member_count)
    };
  }

  // Validate team data
  static validateTeamData(data: CreateTeamData | UpdateTeamData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if ('name' in data && data.name) {
      if (data.name.length < 3) {
        errors.push('Team name must be at least 3 characters long');
      }
      if (data.name.length > 100) {
        errors.push('Team name must be less than 100 characters');
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
        errors.push('Team name can only contain letters, numbers, spaces, hyphens, and underscores');
      }
    }
    
    if ('description' in data && data.description && data.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }
    
    if ('house_color' in data && data.house_color && !/^#[0-9A-Fa-f]{6}$/.test(data.house_color)) {
      errors.push('House color must be a valid hex color (e.g., #FF0000)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
