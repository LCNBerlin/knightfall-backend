import { Chess } from 'chess.js';
import { GameModel } from '../models/Game';
import { UserModel } from '../models/User';
import { EconomyService } from '../services/EconomyService';

export interface MatchmakingPlayer {
  userId: string;
  username: string;
  eloRating: number;
  gameType: string;
  wagerAmount: number;
  wagerType: string;
  joinedAt: Date;
}

export interface GameRoom {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePlayer: any;
  blackPlayer: any;
  gameType: string;
  wagerAmount: number;
  wagerType: string;
  gameState: any;
  moves: string[];
  currentPlayer: 'white' | 'black';
  status: 'waiting' | 'active' | 'finished' | 'abandoned';
  createdAt: Date;
  lastMoveAt?: Date;
}

export class GameRoomManager {
  private matchmakingQueues: Map<string, MatchmakingPlayer[]> = new Map();
  private activeGames: Map<string, GameRoom> = new Map();

  constructor() {
    // Initialize matchmaking queues for different game types
    this.matchmakingQueues.set('ladder', []);
    this.matchmakingQueues.set('tournament', []);
    this.matchmakingQueues.set('puzzle', []);
  }

  async addToMatchmakingQueue(
    user: any,
    gameType: string,
    wagerAmount: number,
    wagerType: string
  ): Promise<{ matchFound: boolean; game?: GameRoom; position?: number; estimatedWaitTime?: number }> {
    const queue = this.matchmakingQueues.get(gameType) || [];
    
    // Check if user is already in queue
    const existingIndex = queue.findIndex(p => p.userId === user.userId);
    if (existingIndex !== -1) {
      return {
        matchFound: false,
        position: existingIndex + 1,
        estimatedWaitTime: this.calculateEstimatedWaitTime(queue.length)
      };
    }

    // Add user to queue
    const player: MatchmakingPlayer = {
      userId: user.userId,
      username: user.username,
      eloRating: user.eloRating || 1200,
      gameType,
      wagerAmount,
      wagerType,
      joinedAt: new Date()
    };

    queue.push(player);
    this.matchmakingQueues.set(gameType, queue);

    // Try to find a match
    const match = await this.findMatch(gameType, wagerAmount, wagerType);
    if (match) {
      return { matchFound: true, game: match };
    }

    return {
      matchFound: false,
      position: queue.length,
      estimatedWaitTime: this.calculateEstimatedWaitTime(queue.length)
    };
  }

  async removeFromMatchmakingQueue(userId: string): Promise<void> {
    for (const [gameType, queue] of this.matchmakingQueues.entries()) {
      const index = queue.findIndex(p => p.userId === userId);
      if (index !== -1) {
        queue.splice(index, 1);
        this.matchmakingQueues.set(gameType, queue);
        break;
      }
    }
  }

  private async findMatch(gameType: string, wagerAmount: number, wagerType: string): Promise<GameRoom | null> {
    const queue = this.matchmakingQueues.get(gameType) || [];
    
    if (queue.length < 2) {
      return null;
    }

    // Find a suitable opponent (simple matching for now)
    const player1 = queue[0];
    const player2 = queue.find(p => 
      p.userId !== player1.userId && 
      p.wagerAmount === wagerAmount && 
      p.wagerType === wagerType &&
      Math.abs(p.eloRating - player1.eloRating) <= 200 // Within 200 Elo points
    );

    if (!player2) {
      return null;
    }

    // Remove both players from queue
    const player1Index = queue.findIndex(p => p.userId === player1.userId);
    const player2Index = queue.findIndex(p => p.userId === player2.userId);
    queue.splice(Math.max(player1Index, player2Index), 1);
    queue.splice(Math.min(player1Index, player2Index), 1);
    this.matchmakingQueues.set(gameType, queue);

    // Create game
    const game = await this.createGame(player1, player2);
    return game;
  }

  private async createGame(player1: MatchmakingPlayer, player2: MatchmakingPlayer): Promise<GameRoom> {
    // Randomly assign colors
    const isPlayer1White = Math.random() < 0.5;
    const whitePlayer = isPlayer1White ? player1 : player2;
    const blackPlayer = isPlayer1White ? player2 : player1;

    // Get full user data
    const whiteUser = await UserModel.findById(whitePlayer.userId);
    const blackUser = await UserModel.findById(blackPlayer.userId);

    if (!whiteUser || !blackUser) {
      throw new Error('User not found');
    }

    // Validate both players can afford the wager
    const canWhiteAfford = await EconomyService.canAffordWager(whitePlayer.userId, whitePlayer.wagerAmount);
    const canBlackAfford = await EconomyService.canAffordWager(blackPlayer.userId, blackPlayer.wagerAmount);
    
    if (!canWhiteAfford || !canBlackAfford) {
      throw new Error('One or both players cannot afford the wager');
    }

    // Create game in database
    const gameData = await GameModel.create({
      whitePlayerId: whitePlayer.userId,
      blackPlayerId: blackPlayer.userId,
      gameType: whitePlayer.gameType,
      wagerAmount: whitePlayer.wagerAmount,
      wagerType: whitePlayer.wagerType,
      gameState: new Chess().fen(),
      moves: []
    });

    // Process wagers (deduct tokens from both players)
    await EconomyService.processGameWagers(gameData.id);

    const gameRoom: GameRoom = {
      id: gameData.id,
      whitePlayerId: whitePlayer.userId,
      blackPlayerId: blackPlayer.userId,
      whitePlayer: { id: whiteUser.id, username: whiteUser.username, eloRating: whiteUser.elo_rating },
      blackPlayer: { id: blackUser.id, username: blackUser.username, eloRating: blackUser.elo_rating },
      gameType: whitePlayer.gameType,
      wagerAmount: whitePlayer.wagerAmount,
      wagerType: whitePlayer.wagerType,
      gameState: new Chess().fen(),
      moves: [],
      currentPlayer: 'white',
      status: 'active',
      createdAt: new Date()
    };

    this.activeGames.set(gameData.id, gameRoom);
    return gameRoom;
  }

  async getGame(gameId: string): Promise<GameRoom | null> {
    return this.activeGames.get(gameId) || null;
  }

  async makeMove(gameId: string, userId: string, move: string): Promise<{
    success: boolean;
    gameState?: string;
    currentPlayer?: 'white' | 'black';
    status?: string;
    moves?: string[];
    result?: string;
    winner?: string;
    error?: string;
  }> {
    const game = this.activeGames.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // Check if it's the player's turn
    const isWhitePlayer = game.whitePlayerId === userId;
    const isBlackPlayer = game.blackPlayerId === userId;
    
    if (!isWhitePlayer && !isBlackPlayer) {
      return { success: false, error: 'You are not part of this game' };
    }

    if ((isWhitePlayer && game.currentPlayer !== 'white') || 
        (isBlackPlayer && game.currentPlayer !== 'black')) {
      return { success: false, error: 'Not your turn' };
    }

    try {
      // Create chess instance and load current position
      const chess = new Chess(game.gameState);
      
      // Make the move
      const result = chess.move(move);
      if (!result) {
        return { success: false, error: 'Invalid move' };
      }

      // Update game state
      game.gameState = chess.fen();
      game.moves.push(move);
      game.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';
      game.lastMoveAt = new Date();

      // Check for game end
      if (chess.isGameOver()) {
        game.status = 'finished';
        
        let gameResult = 'draw';
        let winner = null;
        let isDraw = false;
        
        if (chess.isCheckmate()) {
          gameResult = 'checkmate';
          winner = game.currentPlayer === 'white' ? game.blackPlayer : game.whitePlayer;
        } else if (chess.isDraw()) {
          gameResult = 'draw';
          isDraw = true;
        }

        // Update database
        await GameModel.updateGameResult(gameId, gameResult, winner?.id || null);
        
        // Process economic results
        await EconomyService.processGameResult({
          gameId,
          winnerId: winner?.id || null,
          loserId: winner?.id === game.whitePlayerId ? game.blackPlayerId : game.whitePlayerId,
          isDraw,
          wagerAmount: game.wagerAmount,
          wagerType: game.wagerType as 'tokens' | 'cash'
        });
      }

      // Update database with new game state
      await GameModel.updateGameState(gameId, game.gameState, game.moves);

      return {
        success: true,
        gameState: game.gameState,
        currentPlayer: game.currentPlayer,
        status: game.status,
        moves: game.moves,
        result: game.status === 'finished' ? (chess.isCheckmate() ? 'checkmate' : 'draw') : undefined,
        winner: game.status === 'finished' && chess.isCheckmate() ? 
          (game.currentPlayer === 'white' ? game.blackPlayer.username : game.whitePlayer.username) : undefined
      };

    } catch (error) {
      console.error('Error making move:', error);
      return { success: false, error: 'Invalid move format' };
    }
  }

  async resignGame(gameId: string, userId: string): Promise<{ success: boolean; winner?: string; error?: string }> {
    const game = this.activeGames.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    const isWhitePlayer = game.whitePlayerId === userId;
    const isBlackPlayer = game.blackPlayerId === userId;
    
    if (!isWhitePlayer && !isBlackPlayer) {
      return { success: false, error: 'You are not part of this game' };
    }

    // Determine winner
    const winner = isWhitePlayer ? game.blackPlayer : game.whitePlayer;
    
    // Update game status
    game.status = 'finished';
    
    // Update database
    await GameModel.updateGameResult(gameId, 'resignation', winner.id);

    return { success: true, winner: winner.username };
  }

  async getUserActiveGames(userId: string): Promise<GameRoom[]> {
    const activeGames: GameRoom[] = [];
    for (const game of this.activeGames.values()) {
      if ((game.whitePlayerId === userId || game.blackPlayerId === userId) && game.status === 'active') {
        activeGames.push(game);
      }
    }
    return activeGames;
  }

  async handlePlayerDisconnect(gameId: string, userId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Mark game as abandoned if it was active
    if (game.status === 'active') {
      game.status = 'abandoned';
      await GameModel.updateGameResult(gameId, 'abandoned', null);
    }
  }

  private calculateEstimatedWaitTime(queueLength: number): number {
    // Simple estimation: 30 seconds per person in queue
    return queueLength * 30;
  }
}
