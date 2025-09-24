import pool from '../config/database';

export interface Transaction {
  id: string;
  user_id: string;
  type: 'game_wager' | 'game_win' | 'game_loss' | 'purchase' | 'refund' | 'bonus' | 'penalty';
  amount: number;
  balance_before: number;
  balance_after: number;
  game_id?: string;
  description: string;
  created_at: Date;
}

export interface CreateTransactionData {
  userId: string;
  type: 'game_wager' | 'game_win' | 'game_loss' | 'purchase' | 'refund' | 'bonus' | 'penalty';
  amount: number;
  gameId?: string;
  description: string;
}

export class TransactionModel {
  // Create a new transaction
  static async create(data: CreateTransactionData): Promise<Transaction> {
    // Get current balance
    const userQuery = 'SELECT token_balance FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [data.userId]);
    
    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }
    
    const currentBalance = Number(userResult.rows[0].token_balance);
    const newBalance = currentBalance + data.amount;
    
    // Validate balance (can't go negative for wagers)
    if (data.type === 'game_wager' && newBalance < 0) {
      throw new Error('Insufficient token balance');
    }
    
    // Update user balance
    const updateQuery = 'UPDATE users SET token_balance = $1 WHERE id = $2';
    await pool.query(updateQuery, [newBalance, data.userId]);
    
    // Create transaction record
    const transactionQuery = `
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, game_id, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      data.userId,
      data.type,
      data.amount,
      currentBalance,
      newBalance,
      data.gameId || null,
      data.description
    ];
    
    const result = await pool.query(transactionQuery, values);
    return result.rows[0];
  }

  // Get user's transaction history
  static async getUserTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    const query = `
      SELECT * FROM transactions 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Get user's current balance
  static async getUserBalance(userId: string): Promise<number> {
    const query = 'SELECT token_balance FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    
    if (!result.rows[0]) {
      throw new Error('User not found');
    }
    
    return Number(result.rows[0].token_balance);
  }

  // Process game wager
  static async processWager(userId: string, amount: number, gameId: string): Promise<Transaction> {
    return await TransactionModel.create({
      userId,
      type: 'game_wager',
      amount: -amount, // Negative for wager
      gameId,
      description: `Wagered ${amount} tokens for game`
    });
  }

  // Process game win
  static async processWin(userId: string, amount: number, gameId: string): Promise<Transaction> {
    return await TransactionModel.create({
      userId,
      type: 'game_win',
      amount: amount,
      gameId,
      description: `Won ${amount} tokens from game`
    });
  }

  // Process game loss (no payout)
  static async processLoss(userId: string, gameId: string): Promise<Transaction> {
    return await TransactionModel.create({
      userId,
      type: 'game_loss',
      amount: 0,
      gameId,
      description: 'Lost game - no payout'
    });
  }

  // Get transaction statistics
  static async getTransactionStats(userId: string): Promise<{
    totalWagered: number;
    totalWon: number;
    totalLost: number;
    netProfit: number;
  }> {
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'game_wager' THEN ABS(amount) ELSE 0 END), 0) as total_wagered,
        COALESCE(SUM(CASE WHEN type = 'game_win' THEN amount ELSE 0 END), 0) as total_won,
        COALESCE(SUM(CASE WHEN type = 'game_loss' THEN 0 ELSE 0 END), 0) as total_lost
      FROM transactions 
      WHERE user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    const stats = result.rows[0];
    
    return {
      totalWagered: Number(stats.total_wagered),
      totalWon: Number(stats.total_won),
      totalLost: Number(stats.total_lost),
      netProfit: Number(stats.total_won) - Number(stats.total_wagered)
    };
  }
}
