import pool from '../config/database';

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  team_id: string;
  registered_at: Date;
  status: ParticipantStatus;
  seed_position?: number;
  final_position?: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

export type ParticipantStatus = 'registered' | 'active' | 'eliminated' | 'withdrawn';

// Helper function to convert database row to proper types
function convertDbRowToTournamentParticipant(row: any): TournamentParticipant {
  return {
    ...row,
    points: Number(row.points),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    registered_at: new Date(row.registered_at),
  };
}

export interface CreateTournamentParticipantData {
  tournament_id: string;
  team_id: string;
  seed_position?: number;
}

export interface UpdateTournamentParticipantData {
  status?: ParticipantStatus;
  seed_position?: number;
  final_position?: number;
  points?: number;
  wins?: number;
  losses?: number;
  draws?: number;
}

export class TournamentParticipantModel {
  // Register team for tournament
  static async registerTeam(data: CreateTournamentParticipantData): Promise<TournamentParticipant> {
    const query = `
      INSERT INTO tournament_participants (
        tournament_id, team_id, status, points, wins, losses, draws, seed_position
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      data.tournament_id,
      data.team_id,
      'registered',
      0, // points
      0, // wins
      0, // losses
      0, // draws
      data.seed_position || null
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to register team for tournament');
    }
    return convertDbRowToTournamentParticipant(result.rows[0]);
  }

  // Get participant by ID
  static async findById(id: string): Promise<TournamentParticipant | null> {
    const query = 'SELECT * FROM tournament_participants WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournamentParticipant(result.rows[0]) : null;
  }

  // Get participant by tournament and team
  static async findByTournamentAndTeam(tournamentId: string, teamId: string): Promise<TournamentParticipant | null> {
    const query = `
      SELECT * FROM tournament_participants 
      WHERE tournament_id = $1 AND team_id = $2
    `;
    const result = await pool.query(query, [tournamentId, teamId]);
    return result.rows[0] ? convertDbRowToTournamentParticipant(result.rows[0]) : null;
  }

  // Get all participants for a tournament
  static async getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
    const query = `
      SELECT tp.*, t.name as team_name, t.house_color, t.description
      FROM tournament_participants tp
      JOIN teams t ON tp.team_id = t.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.seed_position ASC, tp.registered_at ASC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentParticipant);
  }

  // Get active participants for a tournament
  static async getActiveParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
    const query = `
      SELECT tp.*, t.name as team_name, t.house_color, t.description
      FROM tournament_participants tp
      JOIN teams t ON tp.team_id = t.id
      WHERE tp.tournament_id = $1 AND tp.status = 'active'
      ORDER BY tp.seed_position ASC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentParticipant);
  }

  // Update participant
  static async update(id: string, data: UpdateTournamentParticipantData): Promise<TournamentParticipant | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE tournament_participants 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTournamentParticipant(result.rows[0]) : null;
  }

  // Update participant stats
  static async updateStats(
    tournamentId: string, 
    teamId: string, 
    result: 'win' | 'loss' | 'draw'
  ): Promise<TournamentParticipant | null> {
    const participant = await this.findByTournamentAndTeam(tournamentId, teamId);
    if (!participant) return null;

    const updateData: UpdateTournamentParticipantData = {
      points: participant.points,
      wins: participant.wins,
      losses: participant.losses,
      draws: participant.draws
    };

    switch (result) {
      case 'win':
        updateData.wins = participant.wins + 1;
        updateData.points = participant.points + 3; // 3 points for win
        break;
      case 'loss':
        updateData.losses = participant.losses + 1;
        // No points for loss
        break;
      case 'draw':
        updateData.draws = participant.draws + 1;
        updateData.points = participant.points + 1; // 1 point for draw
        break;
    }

    return this.update(participant.id, updateData);
  }

  // Set seed positions for elimination tournaments
  static async setSeedPositions(tournamentId: string, seedings: Array<{ teamId: string; position: number }>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const seeding of seedings) {
        await client.query(
          'UPDATE tournament_participants SET seed_position = $1 WHERE tournament_id = $2 AND team_id = $3',
          [seeding.position, tournamentId, seeding.teamId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get tournament standings
  static async getTournamentStandings(tournamentId: string): Promise<TournamentParticipant[]> {
    const query = `
      SELECT tp.*, t.name as team_name, t.house_color, t.description
      FROM tournament_participants tp
      JOIN teams t ON tp.team_id = t.id
      WHERE tp.tournament_id = $1 AND tp.status IN ('active', 'eliminated')
      ORDER BY tp.points DESC, tp.wins DESC, (tp.wins + tp.losses + tp.draws) ASC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentParticipant);
  }

  // Eliminate participant
  static async eliminateParticipant(tournamentId: string, teamId: string): Promise<TournamentParticipant | null> {
    const participant = await this.findByTournamentAndTeam(tournamentId, teamId);
    if (!participant) return null;

    return this.update(participant.id, { status: 'eliminated' });
  }

  // Withdraw participant
  static async withdrawParticipant(tournamentId: string, teamId: string): Promise<TournamentParticipant | null> {
    const participant = await this.findByTournamentAndTeam(tournamentId, teamId);
    if (!participant) return null;

    return this.update(participant.id, { status: 'withdrawn' });
  }

  // Activate all registered participants (when tournament starts)
  static async activateAllParticipants(tournamentId: string): Promise<void> {
    const query = `
      UPDATE tournament_participants 
      SET status = 'active'
      WHERE tournament_id = $1 AND status = 'registered'
    `;
    
    await pool.query(query, [tournamentId]);
  }

  // Get participant count for tournament
  static async getParticipantCount(tournamentId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = $1';
    const result = await pool.query(query, [tournamentId]);
    return parseInt(result.rows[0].count);
  }

  // Get active participant count for tournament
  static async getActiveParticipantCount(tournamentId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM tournament_participants 
      WHERE tournament_id = $1 AND status = 'active'
    `;
    const result = await pool.query(query, [tournamentId]);
    return parseInt(result.rows[0].count);
  }

  // Check if team is registered for tournament
  static async isTeamRegistered(tournamentId: string, teamId: string): Promise<boolean> {
    const participant = await this.findByTournamentAndTeam(tournamentId, teamId);
    return participant !== null;
  }

  // Get teams by tournament
  static async getTeamsByTournament(tournamentId: string): Promise<Array<{
    team_id: string;
    team_name: string;
    house_color: string;
    status: ParticipantStatus;
    points: number;
    wins: number;
    losses: number;
    draws: number;
  }>> {
    const query = `
      SELECT 
        tp.team_id,
        t.name as team_name,
        t.house_color,
        tp.status,
        tp.points,
        tp.wins,
        tp.losses,
        tp.draws
      FROM tournament_participants tp
      JOIN teams t ON tp.team_id = t.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.points DESC, tp.wins DESC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(row => ({
      team_id: row.team_id,
      team_name: row.team_name,
      house_color: row.house_color,
      status: row.status,
      points: parseInt(row.points),
      wins: parseInt(row.wins),
      losses: parseInt(row.losses),
      draws: parseInt(row.draws)
    }));
  }

  // Remove participant from tournament
  static async removeParticipant(tournamentId: string, teamId: string): Promise<boolean> {
    const query = `
      DELETE FROM tournament_participants 
      WHERE tournament_id = $1 AND team_id = $2
    `;
    const result = await pool.query(query, [tournamentId, teamId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Validate participant data
  static validateParticipantData(data: CreateTournamentParticipantData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.tournament_id || typeof data.tournament_id !== 'string') {
      errors.push('Tournament ID is required');
    }

    if (!data.team_id || typeof data.team_id !== 'string') {
      errors.push('Team ID is required');
    }

    if (data.seed_position !== undefined && (data.seed_position < 1 || data.seed_position > 64)) {
      errors.push('Seed position must be between 1 and 64');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
