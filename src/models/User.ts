import pool from '../config/database';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  elo_rating: number;
  token_balance: number;
  cash_balance: number;
  rank: string;
  games_played: number;
  games_won: number;
  created_at: Date;
  updated_at: Date;
}


// Helper function to convert database row to proper types
function convertDbRowToUser(row: any): User {
  return {
    ...row,
    elo_rating: row.elo_rating ? Number(row.elo_rating) : 1200,
    token_balance: row.token_balance ? Number(row.token_balance) : 0,
    cash_balance: row.cash_balance ? Number(row.cash_balance) : 0,
    games_played: row.games_played ? Number(row.games_played) : 0,
    games_won: row.games_won ? Number(row.games_won) : 0,
  };
}

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string;
}

export interface UpdateUserData {
  elo_rating?: number;
  token_balance?: number;
  cash_balance?: number;
  rank?: string;
  games_played?: number;
  games_won?: number;
}

export class UserModel {
  // Create a new user
  static async create(data: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [data.username, data.email, data.password_hash];
    const result = await pool.query(query, values);
    if (!result.rows[0]) {
      throw new Error('Failed to create user');
    }
    return convertDbRowToUser(result.rows[0]);
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Find user by username
  static async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Update user
  static async update(id: string, data: UpdateUserData): Promise<User | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    if (fields.length === 0) return null;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Get leaderboard
  static async getLeaderboard(limit: number = 10): Promise<User[]> {
    const query = `
      SELECT id, username, elo_rating, rank, games_played, games_won
      FROM users
      ORDER BY elo_rating DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(convertDbRowToUser);
  }

  // Get user statistics
  static async getStats(id: string): Promise<any> {
    const query = `
      SELECT 
        u.username,
        u.elo_rating,
        u.rank,
        u.games_played,
        u.games_won,
        u.token_balance,
        u.cash_balance,
        CASE 
          WHEN u.games_played > 0 
          THEN ROUND((u.games_won::float / u.games_played::float) * 100, 2)
          ELSE 0 
        END as win_rate
      FROM users u
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Update user rating (Elo system)
  static async updateRating(id: string, newRating: number): Promise<User | null> {
    const query = `
      UPDATE users 
      SET elo_rating = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, newRating]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Update token balance
  static async updateTokenBalance(id: string, amount: number): Promise<User | null> {
    const query = `
      UPDATE users 
      SET token_balance = token_balance + $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, amount]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }

  // Update cash balance
  static async updateCashBalance(id: string, amount: number): Promise<User | null> {
    const query = `
      UPDATE users 
      SET cash_balance = cash_balance + $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, amount]);
    return result.rows[0] ? convertDbRowToUser(result.rows[0]) : null;
  }
} 