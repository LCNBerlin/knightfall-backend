import { TransactionModel } from '../models/Transaction';
import { GameModel } from '../models/Game';
import { UserModel } from '../models/User';

export interface GameResult {
  gameId: string;
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  wagerAmount: number;
  wagerType: 'tokens' | 'cash';
}

export class EconomyService {
  // Process game wagers before game starts
  static async processGameWagers(gameId: string): Promise<void> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Deduct wager from both players
    await TransactionModel.processWager(game.white_player_id, game.wager_amount, gameId);
    await TransactionModel.processWager(game.black_player_id, game.wager_amount, gameId);
  }

  // Process game results and payouts
  static async processGameResult(result: GameResult): Promise<void> {
    const { gameId, winnerId, loserId, isDraw, wagerAmount, wagerType } = result;

    if (wagerType === 'tokens') {
      if (isDraw) {
        // Refund both players their wager
        await TransactionModel.create({
          userId: result.winnerId || '', // Use winnerId as placeholder for white player
          type: 'refund',
          amount: wagerAmount,
          gameId,
          description: 'Draw - wager refunded'
        });
        
        await TransactionModel.create({
          userId: result.loserId || '', // Use loserId as placeholder for black player
          type: 'refund',
          amount: wagerAmount,
          gameId,
          description: 'Draw - wager refunded'
        });
      } else if (winnerId) {
        // Winner gets both wagers (2x wager amount)
        await TransactionModel.processWin(winnerId, wagerAmount * 2, gameId);
        
        // Loser gets nothing (already deducted)
        await TransactionModel.processLoss(loserId || '', gameId);
      }
    }
    // For cash wagers, we'll implement later with payment processing
  }

  // Get user's economic stats
  static async getUserEconomyStats(userId: string): Promise<{
    currentBalance: number;
    totalWagered: number;
    totalWon: number;
    netProfit: number;
    gamesPlayed: number;
    winRate: number;
  }> {
    const [balance, transactionStats, user] = await Promise.all([
      TransactionModel.getUserBalance(userId),
      TransactionModel.getTransactionStats(userId),
      UserModel.findById(userId)
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const gamesPlayed = Number(user.games_played || 0);
    const gamesWon = Number(user.games_won || 0);
    const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

    return {
      currentBalance: balance,
      totalWagered: transactionStats.totalWagered,
      totalWon: transactionStats.totalWon,
      netProfit: transactionStats.netProfit,
      gamesPlayed,
      winRate: Number(winRate.toFixed(2))
    };
  }

  // Get leaderboard data
  static async getLeaderboard(limit: number = 50): Promise<Array<{
    username: string;
    eloRating: number;
    tokenBalance: number;
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
  }>> {
    const query = `
      SELECT 
        username,
        elo_rating,
        token_balance,
        games_played,
        games_won,
        CASE 
          WHEN games_played > 0 THEN (games_won::float / games_played::float) * 100
          ELSE 0 
        END as win_rate
      FROM users 
      WHERE games_played > 0
      ORDER BY elo_rating DESC, token_balance DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      username: row.username,
      eloRating: Number(row.elo_rating),
      tokenBalance: Number(row.token_balance),
      gamesPlayed: Number(row.games_played),
      gamesWon: Number(row.games_won),
      winRate: Number(Number(row.win_rate).toFixed(2))
    }));
  }

  // Get token transaction history
  static async getTokenHistory(userId: string, limit: number = 20): Promise<Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: Date;
    gameId?: string;
  }>> {
    const transactions = await TransactionModel.getUserTransactions(userId, limit);
    
    return transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      description: tx.description,
      createdAt: tx.created_at,
      gameId: tx.game_id
    }));
  }

  // Add bonus tokens (for new users, promotions, etc.)
  static async addBonusTokens(userId: string, amount: number, description: string): Promise<void> {
    await TransactionModel.create({
      userId,
      type: 'bonus',
      amount,
      description
    });
  }

  // Validate user can afford wager
  static async canAffordWager(userId: string, amount: number): Promise<boolean> {
    const balance = await TransactionModel.getUserBalance(userId);
    return balance >= amount;
  }
}

// Import pool for the leaderboard query
import pool from '../config/database';
