import pool from '../config/database';

export interface TeamAchievement {
  id: string;
  team_id: string;
  achievement_type: TeamAchievementType;
  earned_at: Date;
  description: string;
  points: number;
}

export type TeamAchievementType = 
  | 'first_win'
  | 'streak_5'
  | 'streak_10'
  | 'streak_20'
  | 'tournament_champion'
  | 'team_level_10'
  | 'team_level_25'
  | 'team_level_50'
  | 'perfect_season'
  | 'undefeated_month'
  | 'comeback_king'
  | 'domination'
  | 'team_spirit'
  | 'rising_stars'
  | 'veterans';

// Helper function to convert database row to proper types
function convertDbRowToTeamAchievement(row: any): TeamAchievement {
  return {
    ...row,
    points: Number(row.points),
    earned_at: new Date(row.earned_at),
  };
}

export interface CreateTeamAchievementData {
  team_id: string;
  achievement_type: TeamAchievementType;
  description?: string;
  points?: number;
}

// Achievement definitions with points and descriptions
export const ACHIEVEMENT_DEFINITIONS: Record<TeamAchievementType, { points: number; description: string }> = {
  'first_win': { points: 10, description: 'Win your first team game' },
  'streak_5': { points: 25, description: 'Win 5 games in a row' },
  'streak_10': { points: 50, description: 'Win 10 games in a row' },
  'streak_20': { points: 100, description: 'Win 20 games in a row' },
  'tournament_champion': { points: 200, description: 'Win a team tournament' },
  'team_level_10': { points: 30, description: 'Reach team level 10' },
  'team_level_25': { points: 75, description: 'Reach team level 25' },
  'team_level_50': { points: 150, description: 'Reach team level 50' },
  'perfect_season': { points: 300, description: 'Win all games in a season' },
  'undefeated_month': { points: 100, description: 'Go undefeated for a month' },
  'comeback_king': { points: 50, description: 'Win after being down 0-2' },
  'domination': { points: 75, description: 'Win 80% of games in a month' },
  'team_spirit': { points: 25, description: 'All team members participate in a game' },
  'rising_stars': { points: 40, description: 'Team rating increases by 200 points' },
  'veterans': { points: 60, description: 'Play 100 games as a team' }
};

export class TeamAchievementModel {
  // Create team achievement
  static async create(data: CreateTeamAchievementData): Promise<TeamAchievement> {
    const definition = ACHIEVEMENT_DEFINITIONS[data.achievement_type];
    
    const query = `
      INSERT INTO team_achievements (team_id, achievement_type, description, points)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      data.team_id,
      data.achievement_type,
      data.description || definition.description,
      data.points || definition.points
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create team achievement');
    }
    return convertDbRowToTeamAchievement(result.rows[0]);
  }

  // Get team achievements
  static async getTeamAchievements(teamId: string): Promise<TeamAchievement[]> {
    const query = `
      SELECT * FROM team_achievements 
      WHERE team_id = $1 
      ORDER BY earned_at DESC
    `;
    
    const result = await pool.query(query, [teamId]);
    return result.rows.map(convertDbRowToTeamAchievement);
  }

  // Get achievement by ID
  static async findById(id: string): Promise<TeamAchievement | null> {
    const query = 'SELECT * FROM team_achievements WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTeamAchievement(result.rows[0]) : null;
  }

  // Check if team has specific achievement
  static async hasAchievement(teamId: string, achievementType: TeamAchievementType): Promise<boolean> {
    const query = 'SELECT id FROM team_achievements WHERE team_id = $1 AND achievement_type = $2';
    const result = await pool.query(query, [teamId, achievementType]);
    return result.rows.length > 0;
  }

  // Get team achievement count
  static async getTeamAchievementCount(teamId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM team_achievements WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return parseInt(result.rows[0].count);
  }

  // Get team total achievement points
  static async getTeamAchievementPoints(teamId: string): Promise<number> {
    const query = 'SELECT SUM(points) as total_points FROM team_achievements WHERE team_id = $1';
    const result = await pool.query(query, [teamId]);
    return parseInt(result.rows[0].total_points) || 0;
  }

  // Get recent achievements
  static async getRecentAchievements(limit: number = 20): Promise<TeamAchievement[]> {
    const query = `
      SELECT ta.*, t.name as team_name, t.house_color
      FROM team_achievements ta
      JOIN teams t ON ta.team_id = t.id
      ORDER BY ta.earned_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(convertDbRowToTeamAchievement);
  }

  // Get achievement leaderboard
  static async getAchievementLeaderboard(limit: number = 20): Promise<Array<{
    team_id: string;
    team_name: string;
    house_color: string;
    achievement_count: number;
    total_points: number;
  }>> {
    const query = `
      SELECT 
        t.id as team_id,
        t.name as team_name,
        t.house_color,
        COUNT(ta.id) as achievement_count,
        SUM(ta.points) as total_points
      FROM teams t
      LEFT JOIN team_achievements ta ON t.id = ta.team_id
      GROUP BY t.id, t.name, t.house_color
      ORDER BY total_points DESC, achievement_count DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      team_id: row.team_id,
      team_name: row.team_name,
      house_color: row.house_color,
      achievement_count: parseInt(row.achievement_count),
      total_points: parseInt(row.total_points) || 0
    }));
  }

  // Award achievement to team
  static async awardAchievement(teamId: string, achievementType: TeamAchievementType): Promise<TeamAchievement | null> {
    // Check if team already has this achievement
    const hasAchievement = await this.hasAchievement(teamId, achievementType);
    if (hasAchievement) {
      return null; // Already has this achievement
    }

    return this.create({
      team_id: teamId,
      achievement_type: achievementType
    });
  }

  // Check and award achievements based on team stats
  static async checkAndAwardAchievements(teamId: string, stats: any): Promise<TeamAchievement[]> {
    const newAchievements: TeamAchievement[] = [];

    // Check for win streak achievements
    if (stats.wins >= 5 && !(await this.hasAchievement(teamId, 'streak_5'))) {
      const achievement = await this.awardAchievement(teamId, 'streak_5');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.wins >= 10 && !(await this.hasAchievement(teamId, 'streak_10'))) {
      const achievement = await this.awardAchievement(teamId, 'streak_10');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.wins >= 20 && !(await this.hasAchievement(teamId, 'streak_20'))) {
      const achievement = await this.awardAchievement(teamId, 'streak_20');
      if (achievement) newAchievements.push(achievement);
    }

    // Check for first win
    if (stats.wins >= 1 && !(await this.hasAchievement(teamId, 'first_win'))) {
      const achievement = await this.awardAchievement(teamId, 'first_win');
      if (achievement) newAchievements.push(achievement);
    }

    // Check for team level achievements (based on total games)
    if (stats.total_games >= 10 && !(await this.hasAchievement(teamId, 'team_level_10'))) {
      const achievement = await this.awardAchievement(teamId, 'team_level_10');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.total_games >= 25 && !(await this.hasAchievement(teamId, 'team_level_25'))) {
      const achievement = await this.awardAchievement(teamId, 'team_level_25');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.total_games >= 50 && !(await this.hasAchievement(teamId, 'team_level_50'))) {
      const achievement = await this.awardAchievement(teamId, 'team_level_50');
      if (achievement) newAchievements.push(achievement);
    }

    // Check for veterans achievement
    if (stats.total_games >= 100 && !(await this.hasAchievement(teamId, 'veterans'))) {
      const achievement = await this.awardAchievement(teamId, 'veterans');
      if (achievement) newAchievements.push(achievement);
    }

    // Check for perfect season (100% win rate with at least 10 games)
    if (stats.total_games >= 10 && stats.losses === 0 && stats.draws === 0 && !(await this.hasAchievement(teamId, 'perfect_season'))) {
      const achievement = await this.awardAchievement(teamId, 'perfect_season');
      if (achievement) newAchievements.push(achievement);
    }

    // Check for domination (80% win rate with at least 10 games)
    const winRate = stats.total_games > 0 ? (stats.wins / stats.total_games) * 100 : 0;
    if (stats.total_games >= 10 && winRate >= 80 && !(await this.hasAchievement(teamId, 'domination'))) {
      const achievement = await this.awardAchievement(teamId, 'domination');
      if (achievement) newAchievements.push(achievement);
    }

    return newAchievements;
  }

  // Delete achievement
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM team_achievements WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Get achievement statistics
  static async getAchievementStats(): Promise<{
    total_achievements: number;
    most_common: { type: TeamAchievementType; count: number }[];
    rarest: { type: TeamAchievementType; count: number }[];
  }> {
    const totalQuery = 'SELECT COUNT(*) as count FROM team_achievements';
    const totalResult = await pool.query(totalQuery);
    const total_achievements = parseInt(totalResult.rows[0].count);

    const commonQuery = `
      SELECT achievement_type, COUNT(*) as count
      FROM team_achievements
      GROUP BY achievement_type
      ORDER BY count DESC
      LIMIT 5
    `;
    const commonResult = await pool.query(commonQuery);
    const most_common = commonResult.rows.map(row => ({
      type: row.achievement_type,
      count: parseInt(row.count)
    }));

    const rareQuery = `
      SELECT achievement_type, COUNT(*) as count
      FROM team_achievements
      GROUP BY achievement_type
      ORDER BY count ASC
      LIMIT 5
    `;
    const rareResult = await pool.query(rareQuery);
    const rarest = rareResult.rows.map(row => ({
      type: row.achievement_type,
      count: parseInt(row.count)
    }));

    return {
      total_achievements,
      most_common,
      rarest
    };
  }

  // Validate achievement data
  static validateAchievementData(data: CreateTeamAchievementData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (!data.achievement_type || !Object.keys(ACHIEVEMENT_DEFINITIONS).includes(data.achievement_type)) {
      errors.push('Invalid achievement type');
    }

    if (data.points !== undefined && (data.points < 0 || !Number.isInteger(data.points))) {
      errors.push('Points must be a non-negative integer');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
