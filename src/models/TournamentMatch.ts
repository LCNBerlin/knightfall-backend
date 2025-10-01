import pool from '../config/database';

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  team1_id: string;
  team2_id: string;
  team1_score: number;
  team2_score: number;
  status: MatchStatus;
  scheduled_time: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  game_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'bye';

// Helper function to convert database row to proper types
function convertDbRowToTournamentMatch(row: any): TournamentMatch {
  return {
    ...row,
    round: Number(row.round),
    match_number: Number(row.match_number),
    team1_score: Number(row.team1_score),
    team2_score: Number(row.team2_score),
    scheduled_time: row.scheduled_time ? new Date(row.scheduled_time) : null,
    started_at: row.started_at ? new Date(row.started_at) : null,
    completed_at: row.completed_at ? new Date(row.completed_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export interface CreateTournamentMatchData {
  tournament_id: string;
  round: number;
  match_number: number;
  team1_id: string;
  team2_id: string;
  scheduled_time?: Date;
  status?: MatchStatus;
}

export interface UpdateTournamentMatchData {
  team1_score?: number;
  team2_score?: number;
  status?: MatchStatus;
  scheduled_time?: Date | null;
  started_at?: Date | null;
  completed_at?: Date | null;
  game_id?: string | null;
}

export class TournamentMatchModel {
  // Create a new match
  static async create(data: CreateTournamentMatchData): Promise<TournamentMatch> {
    const query = `
      INSERT INTO tournament_matches (
        tournament_id, round, match_number, team1_id, team2_id,
        team1_score, team2_score, status, scheduled_time, started_at, completed_at, game_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      data.tournament_id,
      data.round,
      data.match_number,
      data.team1_id,
      data.team2_id,
      0, // team1_score
      0, // team2_score
      data.status || 'scheduled',
      data.scheduled_time || null,
      null, // started_at
      null, // completed_at
      null  // game_id
    ];
    
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create tournament match');
    }
    return convertDbRowToTournamentMatch(result.rows[0]);
  }

  // Get match by ID
  static async findById(id: string): Promise<TournamentMatch | null> {
    const query = 'SELECT * FROM tournament_matches WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToTournamentMatch(result.rows[0]) : null;
  }

  // Get matches by tournament
  static async getMatchesByTournament(tournamentId: string): Promise<TournamentMatch[]> {
    const query = `
      SELECT tm.*, 
             t1.name as team1_name, t1.house_color as team1_color,
             t2.name as team2_name, t2.house_color as team2_color
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON tm.team1_id = t1.id
      LEFT JOIN teams t2 ON tm.team2_id = t2.id
      WHERE tm.tournament_id = $1
      ORDER BY tm.round ASC, tm.match_number ASC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentMatch);
  }

  // Get matches by tournament and round
  static async getMatchesByRound(tournamentId: string, round: number): Promise<TournamentMatch[]> {
    const query = `
      SELECT tm.*, 
             t1.name as team1_name, t1.house_color as team1_color,
             t2.name as team2_name, t2.house_color as team2_color
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON tm.team1_id = t1.id
      LEFT JOIN teams t2 ON tm.team2_id = t2.id
      WHERE tm.tournament_id = $1 AND tm.round = $2
      ORDER BY tm.match_number ASC
    `;
    
    const result = await pool.query(query, [tournamentId, round]);
    return result.rows.map(convertDbRowToTournamentMatch);
  }

  // Get matches by team
  static async getMatchesByTeam(tournamentId: string, teamId: string): Promise<TournamentMatch[]> {
    const query = `
      SELECT tm.*, 
             t1.name as team1_name, t1.house_color as team1_color,
             t2.name as team2_name, t2.house_color as team2_color
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON tm.team1_id = t1.id
      LEFT JOIN teams t2 ON tm.team2_id = t2.id
      WHERE tm.tournament_id = $1 AND (tm.team1_id = $2 OR tm.team2_id = $2)
      ORDER BY tm.round ASC, tm.match_number ASC
    `;
    
    const result = await pool.query(query, [tournamentId, teamId]);
    return result.rows.map(convertDbRowToTournamentMatch);
  }

  // Update match
  static async update(id: string, data: UpdateTournamentMatchData): Promise<TournamentMatch | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE tournament_matches 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToTournamentMatch(result.rows[0]) : null;
  }

  // Start match
  static async startMatch(id: string, gameId?: string): Promise<TournamentMatch | null> {
    const updateData: UpdateTournamentMatchData = {
      status: 'in_progress',
      started_at: new Date(),
      game_id: gameId || null
    };

    return this.update(id, updateData);
  }

  // Complete match
  static async completeMatch(
    id: string, 
    team1Score: number, 
    team2Score: number
  ): Promise<TournamentMatch | null> {
    const updateData: UpdateTournamentMatchData = {
      status: 'completed',
      team1_score: team1Score,
      team2_score: team2Score,
      completed_at: new Date()
    };

    return this.update(id, updateData);
  }

  // Cancel match
  static async cancelMatch(id: string): Promise<TournamentMatch | null> {
    const updateData: UpdateTournamentMatchData = {
      status: 'cancelled',
      completed_at: new Date()
    };

    return this.update(id, updateData);
  }

  // Get next round matches
  static async getNextRoundMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const query = `
      SELECT tm.*, 
             t1.name as team1_name, t1.house_color as team1_color,
             t2.name as team2_name, t2.house_color as team2_color
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON tm.team1_id = t1.id
      LEFT JOIN teams t2 ON tm.team2_id = t2.id
      WHERE tm.tournament_id = $1 AND tm.status = 'scheduled'
      ORDER BY tm.round ASC, tm.match_number ASC
      LIMIT 10
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentMatch);
  }

  // Get completed matches
  static async getCompletedMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const query = `
      SELECT tm.*, 
             t1.name as team1_name, t1.house_color as team1_color,
             t2.name as team2_name, t2.house_color as team2_color
      FROM tournament_matches tm
      LEFT JOIN teams t1 ON tm.team1_id = t1.id
      LEFT JOIN teams t2 ON tm.team2_id = t2.id
      WHERE tm.tournament_id = $1 AND tm.status = 'completed'
      ORDER BY tm.completed_at DESC
    `;
    
    const result = await pool.query(query, [tournamentId]);
    return result.rows.map(convertDbRowToTournamentMatch);
  }

  // Get match statistics
  static async getMatchStats(tournamentId: string): Promise<{
    total_matches: number;
    completed_matches: number;
    in_progress_matches: number;
    scheduled_matches: number;
    cancelled_matches: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_matches,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_matches,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_matches,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_matches
      FROM tournament_matches 
      WHERE tournament_id = $1
    `;
    
    const result = await pool.query(query, [tournamentId]);
    const row = result.rows[0];
    
    return {
      total_matches: parseInt(row.total_matches),
      completed_matches: parseInt(row.completed_matches),
      in_progress_matches: parseInt(row.in_progress_matches),
      scheduled_matches: parseInt(row.scheduled_matches),
      cancelled_matches: parseInt(row.cancelled_matches)
    };
  }

  // Generate elimination bracket matches
  static async generateEliminationBracket(tournamentId: string, participants: Array<{ teamId: string; seed: number }>): Promise<TournamentMatch[]> {
    const matches: TournamentMatch[] = [];
    const numParticipants = participants.length;
    const numRounds = Math.ceil(Math.log2(numParticipants));
    
    // Sort participants by seed
    const sortedParticipants = participants.sort((a, b) => a.seed - b.seed);
    
    // Generate first round matches
    let matchNumber = 1;
    for (let i = 0; i < numParticipants; i += 2) {
      if (i + 1 < numParticipants) {
        const match = await this.create({
          tournament_id: tournamentId,
          round: 1,
          match_number: matchNumber++,
          team1_id: sortedParticipants[i].teamId,
          team2_id: sortedParticipants[i + 1].teamId,
          status: 'scheduled'
        });
        matches.push(match);
      } else {
        // Bye for odd number of participants
        const match = await this.create({
          tournament_id: tournamentId,
          round: 1,
          match_number: matchNumber++,
          team1_id: sortedParticipants[i].teamId,
          team2_id: sortedParticipants[i].teamId, // Same team for bye
          status: 'bye'
        });
        matches.push(match);
      }
    }
    
    return matches;
  }

  // Generate next round matches for elimination
  static async generateNextEliminationRound(tournamentId: string, currentRound: number): Promise<TournamentMatch[]> {
    // Get winners from current round
    const winnersQuery = `
      SELECT 
        CASE 
          WHEN team1_score > team2_score THEN team1_id
          WHEN team2_score > team1_score THEN team2_id
          ELSE NULL
        END as winner_id
      FROM tournament_matches 
      WHERE tournament_id = $1 AND round = $2 AND status = 'completed'
      ORDER BY match_number ASC
    `;
    
    const winnersResult = await pool.query(winnersQuery, [tournamentId, currentRound]);
    const winners = winnersResult.rows.map(row => row.winner_id).filter(id => id !== null);
    
    if (winners.length === 0) return [];
    
    // Generate next round matches
    const matches: TournamentMatch[] = [];
    let matchNumber = 1;
    
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        const match = await this.create({
          tournament_id: tournamentId,
          round: currentRound + 1,
          match_number: matchNumber++,
          team1_id: winners[i],
          team2_id: winners[i + 1],
          status: 'scheduled'
        });
        matches.push(match);
      } else {
        // Bye for odd number of winners
        const match = await this.create({
          tournament_id: tournamentId,
          round: currentRound + 1,
          match_number: matchNumber++,
          team1_id: winners[i],
          team2_id: winners[i], // Same team for bye
          status: 'bye'
        });
        matches.push(match);
      }
    }
    
    return matches;
  }

  // Get tournament bracket
  static async getTournamentBracket(tournamentId: string): Promise<Array<{
    round: number;
    matches: TournamentMatch[];
  }>> {
    const matches = await this.getMatchesByTournament(tournamentId);
    const rounds: { [key: number]: TournamentMatch[] } = {};
    
    matches.forEach(match => {
      if (!rounds[match.round]) {
        rounds[match.round] = [];
      }
      rounds[match.round].push(match);
    });
    
    return Object.keys(rounds)
      .map(round => parseInt(round))
      .sort((a, b) => a - b)
      .map(round => ({
        round,
        matches: rounds[round].sort((a, b) => a.match_number - b.match_number)
      }));
  }

  // Validate match data
  static validateMatchData(data: CreateTournamentMatchData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.tournament_id || typeof data.tournament_id !== 'string') {
      errors.push('Tournament ID is required');
    }

    if (data.round < 1) {
      errors.push('Round must be at least 1');
    }

    if (data.match_number < 1) {
      errors.push('Match number must be at least 1');
    }

    if (!data.team1_id || typeof data.team1_id !== 'string') {
      errors.push('Team 1 ID is required');
    }

    if (!data.team2_id || typeof data.team2_id !== 'string') {
      errors.push('Team 2 ID is required');
    }

    if (data.team1_id === data.team2_id && data.status !== 'bye') {
      errors.push('Team 1 and Team 2 cannot be the same (unless it\'s a bye)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
