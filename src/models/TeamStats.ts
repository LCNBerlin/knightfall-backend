import pool from '../config/database';

export interface TeamStats {
  id: string;
  team_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  team_rating: number;
  updated_at: Date;
}

// Helper function to convert database row to proper types
function convertDbRowToTeamStats(row: any): TeamStats {
  return {
    ...row,
    total_games: Number(row.total_games),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    team_rating: Number(row.team_rating),
    updated_at: new Date(row.updated_at),
  };
}

export interface CreateTeamStatsData {
  team_id: string;
  total_games?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  team_rating?: number;
}

export interface UpdateTeamStatsData {
  total_games?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  team_rating?: number;
}

export class TeamStatsModel {
  // Create team stats
  static async create(data: CreateTeamStatsData): Promise<TeamStats> {
    const query = `
      INSERT INTO team_stats (team_id, total_games, wins, losses, draws, team_rating)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      data.team_id,
      data.total_games || 0,
      data.wins || 0,
      data.losses || 0,
      data.draws || 0,
      data.team_rating || 1200
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team stats');
    }
    return convertDbRowToTeamStats(result.rows[0]);
  }

  // Get team stats by team ID
  static async findByTeamId(teamId: string): Promise<TeamStats | null> {
    const query = 'SELECT * FROM team_stats WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return result.rows[0] ? convertDbRowToTeamStats(result.rows[0]) : null;
  }

  // Update team stats
  static async update(teamId: string, data: UpdateTeamStatsData): Promise<TeamStats | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE team_stats 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [teamId, ...values]);
    return result.rows[0] ? convertDbRowToTeamStats(result.rows[0]) : null;
  }

  // Add game result to team stats
  static async addGameResult(teamId: string, result: 'win' | 'loss' | 'draw'): Promise<TeamStats | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current stats or create if doesn't exist
      let stats = await this.findByTeamId(teamId);
      if (!stats) {
        stats = await this.create({ team_id: teamId });
      }

      // Update stats based on result
      const updateData: UpdateTeamStatsData = {
        total_games: stats.total_games + 1
      };

      switch (result) {
        case 'win':
          updateData.wins = stats.wins + 1;
          updateData.team_rating = Math.min(stats.team_rating + 10, 2000); // Cap at 2000
          break;
        case 'loss':
          updateData.losses = stats.losses + 1;
          updateData.team_rating = Math.max(stats.team_rating - 10, 800); // Floor at 800
          break;
        case 'draw':
          updateData.draws = stats.draws + 1;
          updateData.team_rating = stats.team_rating; // No change for draws
          break;
      }

      const updatedStats = await this.update(teamId, updateData);
      await client.query('COMMIT');
      return updatedStats;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get team leaderboard
  static async getLeaderboard(limit: number = 20, offset: number = 0): Promise<TeamStats[]> {
    const query = `
      SELECT ts.*, t.name as team_name, t.house_color, t.description
      FROM team_stats ts
      JOIN teams t ON ts.team_id = t.id
      ORDER BY ts.team_rating DESC, ts.wins DESC, ts.total_games ASC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(convertDbRowToTeamStats);
  }

  // Get team leaderboard by win rate
  static async getLeaderboardByWinRate(limit: number = 20, offset: number = 0): Promise<TeamStats[]> {
    const query = `
      SELECT ts.*, t.name as team_name, t.house_color, t.description,
             CASE 
               WHEN ts.total_games > 0 
               THEN ROUND((ts.wins::float / ts.total_games::float) * 100, 2)
               ELSE 0 
             END as win_rate
      FROM team_stats ts
      JOIN teams t ON ts.team_id = t.id
      WHERE ts.total_games > 0
      ORDER BY win_rate DESC, ts.total_games DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(convertDbRowToTeamStats);
  }

  // Get team leaderboard by total games
  static async getLeaderboardByGames(limit: number = 20, offset: number = 0): Promise<TeamStats[]> {
    const query = `
      SELECT ts.*, t.name as team_name, t.house_color, t.description
      FROM team_stats ts
      JOIN teams t ON ts.team_id = t.id
      ORDER BY ts.total_games DESC, ts.team_rating DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(convertDbRowToTeamStats);
  }

  // Get team ranking
  static async getTeamRanking(teamId: string): Promise<{ rank: number; total: number } | null> {
    const query = `
      WITH ranked_teams AS (
        SELECT team_id, ROW_NUMBER() OVER (ORDER BY team_rating DESC, wins DESC, total_games ASC) as rank
        FROM team_stats
      ),
      total_teams AS (
        SELECT COUNT(*) as total FROM team_stats
      )
      SELECT rt.rank, tt.total
      FROM ranked_teams rt
      CROSS JOIN total_teams tt
      WHERE rt.team_id = $1
    `;
    
    const result = await pool.query(query, [teamId]);
    return result.rows[0] ? {
      rank: Number(result.rows[0].rank),
      total: Number(result.rows[0].total)
    } : null;
  }

  // Get team performance summary
  static async getTeamPerformance(teamId: string): Promise<{
    stats: TeamStats;
    ranking: { rank: number; total: number };
    win_rate: number;
    recent_trend: 'up' | 'down' | 'stable';
  } | null> {
    const stats = await this.findByTeamId(teamId);
    if (!stats) return null;

    const ranking = await this.getTeamRanking(teamId);
    if (!ranking) return null;

    const win_rate = stats.total_games > 0 
      ? Math.round((stats.wins / stats.total_games) * 100 * 100) / 100
      : 0;

    // Simple trend calculation based on recent performance
    const recent_trend = stats.team_rating >= 1200 ? 'up' : 
                        stats.team_rating < 1200 ? 'down' : 'stable';

    return {
      stats,
      ranking,
      win_rate,
      recent_trend
    };
  }

  // Get top performing teams
  static async getTopTeams(limit: number = 10): Promise<TeamStats[]> {
    return this.getLeaderboard(limit, 0);
  }

  // Get most active teams
  static async getMostActiveTeams(limit: number = 10): Promise<TeamStats[]> {
    return this.getLeaderboardByGames(limit, 0);
  }

  // Get teams by rating range
  static async getTeamsByRatingRange(minRating: number, maxRating: number, limit: number = 20): Promise<TeamStats[]> {
    const query = `
      SELECT ts.*, t.name as team_name, t.house_color, t.description
      FROM team_stats ts
      JOIN teams t ON ts.team_id = t.id
      WHERE ts.team_rating >= $1 AND ts.team_rating <= $2
      ORDER BY ts.team_rating DESC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [minRating, maxRating, limit]);
    return result.rows.map(convertDbRowToTeamStats);
  }

  // Reset team stats
  static async resetTeamStats(teamId: string): Promise<TeamStats | null> {
    const resetData: UpdateTeamStatsData = {
      total_games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      team_rating: 1200
    };

    return this.update(teamId, resetData);
  }

  // Get total team count
  static async getTotalTeamCount(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM team_stats';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // Validate team stats data
  static validateTeamStatsData(data: CreateTeamStatsData | UpdateTeamStatsData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if ('team_id' in data && (!data.team_id || typeof data.team_id !== 'string')) {
      errors.push('Team ID is required');
    }

    if (data.total_games !== undefined && (data.total_games < 0 || !Number.isInteger(data.total_games))) {
      errors.push('Total games must be a non-negative integer');
    }

    if (data.wins !== undefined && (data.wins < 0 || !Number.isInteger(data.wins))) {
      errors.push('Wins must be a non-negative integer');
    }

    if (data.losses !== undefined && (data.losses < 0 || !Number.isInteger(data.losses))) {
      errors.push('Losses must be a non-negative integer');
    }

    if (data.draws !== undefined && (data.draws < 0 || !Number.isInteger(data.draws))) {
      errors.push('Draws must be a non-negative integer');
    }

    if (data.team_rating !== undefined && (data.team_rating < 0 || data.team_rating > 2000)) {
      errors.push('Team rating must be between 0 and 2000');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
