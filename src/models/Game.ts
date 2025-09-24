import pool from '../config/database';

export interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  game_type: string;
  wager_amount: number;
  wager_type: string;
  game_state: string;
  moves: string[];
  result: string | null;
  winner_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

export interface CreateGameData {
  whitePlayerId: string;
  blackPlayerId: string;
  gameType: string;
  wagerAmount: number;
  wagerType: string;
  gameState: string;
  moves: string[];
}

export class GameModel {
  // Create a new game
  static async create(data: CreateGameData): Promise<Game> {
    const query = `
      INSERT INTO games (white_player_id, black_player_id, game_type, wager_amount, wager_type, game_state, moves)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      data.whitePlayerId,
      data.blackPlayerId,
      data.gameType,
      data.wagerAmount,
      data.wagerType,
      JSON.stringify({ fen: data.gameState }), // Store as JSON object
      JSON.stringify(data.moves) // Store as JSON array
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Get game by ID
  static async findById(id: string): Promise<Game | null> {
    const query = 'SELECT * FROM games WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Update game state
  static async updateGameState(id: string, gameState: string, moves: string[]): Promise<void> {
    const query = `
      UPDATE games 
      SET game_state = $2, moves = $3, started_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(query, [id, JSON.stringify({ fen: gameState }), JSON.stringify(moves)]);
  }

  // Update game result
  static async updateGameResult(id: string, result: string, winnerId: string | null): Promise<void> {
    const query = `
      UPDATE games 
      SET result = $2, winner_id = $3, ended_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await pool.query(query, [id, result, winnerId]);
  }

  // Get user's games
  static async getUserGames(userId: string, limit: number = 50): Promise<Game[]> {
    const query = `
      SELECT * FROM games 
      WHERE white_player_id = $1 OR black_player_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Get active games for a user
  static async getUserActiveGames(userId: string): Promise<Game[]> {
    const query = `
      SELECT * FROM games 
      WHERE (white_player_id = $1 OR black_player_id = $1)
      AND result IS NULL
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Get recent games
  static async getRecentGames(limit: number = 20): Promise<Game[]> {
    const query = `
      SELECT g.*, 
             w.username as white_username,
             b.username as black_username
      FROM games g
      LEFT JOIN users w ON g.white_player_id = w.id
      LEFT JOIN users b ON g.black_player_id = b.id
      WHERE g.result IS NOT NULL
      ORDER BY g.ended_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get game statistics
  static async getGameStats(): Promise<{
    totalGames: number;
    activeGames: number;
    completedGames: number;
    averageGameLength: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN result IS NULL THEN 1 END) as active_games,
        COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as completed_games,
        AVG(CASE 
          WHEN ended_at IS NOT NULL AND started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 
        END) as avg_game_length_minutes
      FROM games
    `;
    
    const result = await pool.query(query);
    const stats = result.rows[0];
    
    return {
      totalGames: parseInt(stats.total_games) || 0,
      activeGames: parseInt(stats.active_games) || 0,
      completedGames: parseInt(stats.completed_games) || 0,
      averageGameLength: parseFloat(stats.avg_game_length_minutes) || 0
    };
  }
}
