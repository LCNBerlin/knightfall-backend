import pool from '../config/database';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  tournament_type: TournamentType;
  status: TournamentStatus;
  max_teams: number;
  current_teams: number;
  entry_fee: number;
  prize_pool: number;
  time_control: string;
  created_by: string;
  start_date: Date;
  end_date: Date | null;
  registration_deadline: Date;
  created_at: Date;
  updated_at: Date;
}

export type TournamentType = 'elimination' | 'swiss' | 'round_robin' | 'custom';
export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';

// Helper function to convert database row to proper types
function convertDbRowToTournament(row: any): Tournament {
  return {
    ...row,
    max_teams: Number(row.max_teams),
    current_teams: Number(row.current_teams),
    entry_fee: Number(row.entry_fee),
    prize_pool: Number(row.prize_pool),
    start_date: new Date(row.start_date),
    end_date: row.end_date ? new Date(row.end_date) : null,
    registration_deadline: new Date(row.registration_deadline),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export interface CreateTournamentData {
  name: string;
  description: string;
  tournament_type: TournamentType;
  max_teams: number;
  entry_fee: number;
  time_control: string;
  created_by: string;
  start_date: Date;
  registration_deadline: Date;
}

export interface UpdateTournamentData {
  name?: string;
  description?: string;
  status?: TournamentStatus;
  max_teams?: number;
  entry_fee?: number;
  time_control?: string;
  start_date?: Date;
  end_date?: Date | null;
  registration_deadline?: Date;
}

export class TournamentModel {
  // Create a new tournament
  static async create(data: CreateTournamentData): Promise<Tournament> {
    const query = `
      INSERT INTO tournaments (
        name, description, tournament_type, status, max_teams, current_teams,
        entry_fee, prize_pool, time_control, created_by, start_date, 
        registration_deadline
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      data.name,
      data.description,
      data.tournament_type,
      'draft',
      data.max_teams,
      0, // current_teams starts at 0
      data.entry_fee,
      data.entry_fee * data.max_teams, // prize_pool = entry_fee * max_teams
      data.time_control,
      data.created_by,
      data.start_date,
      data.registration_deadline
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create tournament');
    }
    return convertDbRowToTournament(result.rows[0]);
  }

  // Get tournament by ID
  static async findById(id: string): Promise<Tournament | null> {
    const query = 'SELECT * FROM tournaments WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Update tournament
  static async update(id: string, data: UpdateTournamentData): Promise<Tournament | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE tournaments 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Get all tournaments with pagination
  static async getAllTournaments(
    page: number = 1, 
    limit: number = 20, 
    status?: TournamentStatus,
    tournament_type?: TournamentType
  ): Promise<{ tournaments: Tournament[], total: number }> {
    let whereClause = '';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (status) {
      whereClause += ` WHERE status = $${++paramCount}`;
      queryParams.push(status);
    }

    if (tournament_type) {
      whereClause += whereClause ? ` AND tournament_type = $${++paramCount}` : ` WHERE tournament_type = $${++paramCount}`;
      queryParams.push(tournament_type);
    }

    const offset = (page - 1) * limit;
    
    const tournamentsQuery = `
      SELECT * FROM tournaments 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count FROM tournaments 
      ${whereClause}
    `;

    const [tournamentsResult, countResult] = await Promise.all([
      pool.query(tournamentsQuery, [...queryParams, limit, offset]),
      pool.query(countQuery, queryParams)
    ]);

    return {
      tournaments: tournamentsResult.rows.map(convertDbRowToTournament),
      total: parseInt(countResult.rows[0].count)
    };
  }

  // Get open tournaments (available for registration)
  static async getOpenTournaments(limit: number = 20): Promise<Tournament[]> {
    const query = `
      SELECT * FROM tournaments 
      WHERE status = 'open' 
      AND registration_deadline > CURRENT_TIMESTAMP
      ORDER BY start_date ASC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(convertDbRowToTournament);
  }

  // Get tournaments by creator
  static async getTournamentsByCreator(createdBy: string, limit: number = 20): Promise<Tournament[]> {
    const query = `
      SELECT * FROM tournaments 
      WHERE created_by = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [createdBy, limit]);
    return result.rows.map(convertDbRowToTournament);
  }

  // Get tournaments by team participation
  static async getTournamentsByTeam(teamId: string, limit: number = 20): Promise<Tournament[]> {
    const query = `
      SELECT t.* FROM tournaments t
      JOIN tournament_participants tp ON t.id = tp.tournament_id
      WHERE tp.team_id = $1
      ORDER BY t.start_date DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [teamId, limit]);
    return result.rows.map(convertDbRowToTournament);
  }

  // Start tournament
  static async startTournament(id: string): Promise<Tournament | null> {
    const query = `
      UPDATE tournaments 
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'open'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Complete tournament
  static async completeTournament(id: string): Promise<Tournament | null> {
    const query = `
      UPDATE tournaments 
      SET status = 'completed', end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'in_progress'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Cancel tournament
  static async cancelTournament(id: string): Promise<Tournament | null> {
    const query = `
      UPDATE tournaments 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('draft', 'open')
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Open tournament for registration
  static async openTournament(id: string): Promise<Tournament | null> {
    const query = `
      UPDATE tournaments 
      SET status = 'open', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Update team count
  static async updateTeamCount(id: string, increment: boolean = true): Promise<Tournament | null> {
    const query = `
      UPDATE tournaments 
      SET current_teams = current_teams ${increment ? '+' : '-'} 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournament(result.rows[0]) : null;
  }

  // Check if team can register
  static async canTeamRegister(tournamentId: string, teamId: string): Promise<{
    canRegister: boolean;
    reason?: string;
  }> {
    const tournament = await this.findById(tournamentId);
    if (!tournament) {
      return { canRegister: false, reason: 'Tournament not found' };
    }

    if (tournament.status !== 'open') {
      return { canRegister: false, reason: 'Tournament is not open for registration' };
    }

    if (tournament.current_teams >= tournament.max_teams) {
      return { canRegister: false, reason: 'Tournament is full' };
    }

    if (new Date() > tournament.registration_deadline) {
      return { canRegister: false, reason: 'Registration deadline has passed' };
    }

    // Check if team is already registered
    const participantQuery = `
      SELECT id FROM tournament_participants 
      WHERE tournament_id = $1 AND team_id = $2
    `;
    const participantResult = await pool.query(participantQuery, [tournamentId, teamId]);
    
    if (participantResult.rows.length > 0) {
      return { canRegister: false, reason: 'Team is already registered' };
    }

    return { canRegister: true };
  }

  // Get tournament statistics
  static async getTournamentStats(id: string): Promise<{
    total_participants: number;
    total_matches: number;
    completed_matches: number;
    prize_distribution: any[];
  } | null> {
    const tournament = await this.findById(id);
    if (!tournament) return null;

    const participantsQuery = `
      SELECT COUNT(*) as count FROM tournament_participants 
      WHERE tournament_id = $1
    `;
    
    const matchesQuery = `
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = $1
    `;
    
    const completedMatchesQuery = `
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = $1 AND status = 'completed'
    `;

    const [participantsResult, matchesResult, completedMatchesResult] = await Promise.all([
      pool.query(participantsQuery, [id]),
      pool.query(matchesQuery, [id]),
      pool.query(completedMatchesQuery, [id])
    ]);

    return {
      total_participants: parseInt(participantsResult.rows[0].count),
      total_matches: parseInt(matchesResult.rows[0].count),
      completed_matches: parseInt(completedMatchesResult.rows[0].count),
      prize_distribution: [] // Would be calculated based on tournament type
    };
  }

  // Delete tournament
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM tournaments WHERE id = $1 AND status = $2';
    const result = await pool.query(query, [id, 'draft']);
    return (result.rowCount ?? 0) > 0;
  }

  // Validate tournament data
  static validateTournamentData(data: CreateTournamentData | UpdateTournamentData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if ('name' in data && (data.name === undefined || typeof data.name !== 'string' || data.name.trim().length < 3)) {
      errors.push('Tournament name must be at least 3 characters long');
    }

    if ('description' in data && (data.description === undefined || typeof data.description !== 'string' || data.description.trim().length < 10)) {
      errors.push('Tournament description must be at least 10 characters long');
    }

    if ('tournament_type' in data && (data.tournament_type === undefined || !['elimination', 'swiss', 'round_robin', 'custom'].includes(data.tournament_type))) {
      errors.push('Invalid tournament type');
    }

    if ('max_teams' in data && (data.max_teams === undefined || data.max_teams < 2 || data.max_teams > 64)) {
      errors.push('Maximum teams must be between 2 and 64');
    }

    if ('entry_fee' in data && (data.entry_fee === undefined || data.entry_fee < 0 || data.entry_fee > 10000)) {
      errors.push('Entry fee must be between 0 and 10000');
    }

    if ('time_control' in data && (data.time_control === undefined || typeof data.time_control !== 'string')) {
      errors.push('Time control is required');
    }

    if ('start_date' in data && (data.start_date === undefined || new Date(data.start_date) <= new Date())) {
      errors.push('Start date must be in the future');
    }

    if ('registration_deadline' in data && (data.registration_deadline === undefined || new Date(data.registration_deadline) <= new Date())) {
      errors.push('Registration deadline must be in the future');
    }

    if ('start_date' in data && 'registration_deadline' in data &&
        data.registration_deadline !== undefined && data.start_date !== undefined &&
        new Date(data.registration_deadline) >= new Date(data.start_date)) {
      errors.push('Registration deadline must be before start date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
