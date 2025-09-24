import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameRoomManager } from './gameRoomManager';
import { authenticateSocket } from './socketAuth';

export class SocketServer {
  private io: SocketIOServer;
  private gameRoomManager: GameRoomManager;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          process.env.FRONTEND_URL || "http://localhost:3000",
          "http://192.168.12.207:3000", // Your computer's IP
          /^http:\/\/192\.168\.\d+\.\d+:3000$/, // Allow any local network IP
          /^http:\/\/10\.\d+\.\d+\.\d+:3000$/, // Allow 10.x.x.x networks
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:3000$/ // Allow 172.16-31.x.x networks
        ],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.gameRoomManager = new GameRoomManager();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.use(authenticateSocket);

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.user.username} connected with socket ${socket.id}`);

      // Join user to their personal room for notifications
      socket.join(`user:${socket.data.user.userId}`);

      // Handle joining matchmaking queue
      socket.on('join_matchmaking', (data) => {
        this.handleJoinMatchmaking(socket, data);
      });

      // Handle leaving matchmaking queue
      socket.on('leave_matchmaking', () => {
        this.handleLeaveMatchmaking(socket);
      });

      // Handle joining a game room
      socket.on('join_game', (data) => {
        this.handleJoinGame(socket, data);
      });

      // Handle making a move
      socket.on('make_move', (data) => {
        this.handleMakeMove(socket, data);
      });

      // Handle resigning
      socket.on('resign', (data) => {
        this.handleResign(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinMatchmaking(socket: any, data: { gameType: string; wagerAmount: number; wagerType: string }) {
    try {
      const result = await this.gameRoomManager.addToMatchmakingQueue(
        socket.data.user,
        data.gameType,
        data.wagerAmount,
        data.wagerType
      );

      if (result.matchFound && result.game) {
        // Notify both players about the match
        this.io.to(`user:${result.game.whitePlayerId}`).emit('match_found', {
          gameId: result.game.id,
          opponent: result.game.blackPlayerId === socket.data.user.userId ? result.game.whitePlayer : result.game.blackPlayer,
          gameType: result.game.gameType,
          wagerAmount: result.game.wagerAmount,
          wagerType: result.game.wagerType
        });

        this.io.to(`user:${result.game.blackPlayerId}`).emit('match_found', {
          gameId: result.game.id,
          opponent: result.game.whitePlayerId === socket.data.user.userId ? result.game.blackPlayer : result.game.whitePlayer,
          gameType: result.game.gameType,
          wagerAmount: result.game.wagerAmount,
          wagerType: result.game.wagerType
        });
      } else {
        socket.emit('matchmaking_joined', {
          position: result.position,
          estimatedWaitTime: result.estimatedWaitTime
        });
      }
    } catch (error) {
      console.error('Error joining matchmaking:', error);
      socket.emit('error', { message: 'Failed to join matchmaking queue' });
    }
  }

  private async handleLeaveMatchmaking(socket: any) {
    try {
      await this.gameRoomManager.removeFromMatchmakingQueue(socket.data.user.userId);
      socket.emit('matchmaking_left');
    } catch (error) {
      console.error('Error leaving matchmaking:', error);
      socket.emit('error', { message: 'Failed to leave matchmaking queue' });
    }
  }

  private async handleJoinGame(socket: any, data: { gameId: string }) {
    try {
      const game = await this.gameRoomManager.getGame(data.gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Check if user is part of this game
      if (game.whitePlayerId !== socket.data.user.userId && game.blackPlayerId !== socket.data.user.userId) {
        socket.emit('error', { message: 'You are not part of this game' });
        return;
      }

      // Join the game room
      socket.join(`game:${data.gameId}`);
      
      // Send current game state
      socket.emit('game_state', {
        gameId: game.id,
        gameState: game.gameState,
        moves: game.moves,
        currentPlayer: game.currentPlayer,
        status: game.status
      });

      // Notify opponent that player joined
      socket.to(`game:${data.gameId}`).emit('player_joined', {
        player: socket.data.user.username
      });

    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  }

  private async handleMakeMove(socket: any, data: { gameId: string; move: string }) {
    try {
      const result = await this.gameRoomManager.makeMove(
        data.gameId,
        socket.data.user.userId,
        data.move
      );

      if (result.success) {
        // Broadcast move to all players in the game room
        this.io.to(`game:${data.gameId}`).emit('move_made', {
          gameId: data.gameId,
          move: data.move,
          gameState: result.gameState,
          currentPlayer: result.currentPlayer,
          status: result.status,
          moves: result.moves
        });

        // If game is over, handle game end
        if (result.status === 'finished') {
          this.io.to(`game:${data.gameId}`).emit('game_ended', {
            gameId: data.gameId,
            result: result.result,
            winner: result.winner
          });
        }
      } else {
        socket.emit('move_error', { message: result.error });
      }
    } catch (error) {
      console.error('Error making move:', error);
      socket.emit('error', { message: 'Failed to make move' });
    }
  }

  private async handleResign(socket: any, data: { gameId: string }) {
    try {
      const result = await this.gameRoomManager.resignGame(
        data.gameId,
        socket.data.user.userId
      );

      if (result.success) {
        this.io.to(`game:${data.gameId}`).emit('game_ended', {
          gameId: data.gameId,
          result: 'resignation',
          winner: result.winner
        });
      } else {
        socket.emit('error', { message: result.error });
      }
    } catch (error) {
      console.error('Error resigning game:', error);
      socket.emit('error', { message: 'Failed to resign game' });
    }
  }

  private async handleDisconnect(socket: any) {
    try {
      // Remove from matchmaking queue
      await this.gameRoomManager.removeFromMatchmakingQueue(socket.data.user.userId);
      
      // Handle any active games
      const activeGames = await this.gameRoomManager.getUserActiveGames(socket.data.user.userId);
      for (const game of activeGames) {
        // Mark player as disconnected but don't end game immediately
        await this.gameRoomManager.handlePlayerDisconnect(game.id, socket.data.user.userId);
        
        // Notify opponent
        this.io.to(`game:${game.id}`).emit('player_disconnected', {
          player: socket.data.user.username,
          gameId: game.id
        });
      }

      console.log(`User ${socket.data.user.username} disconnected`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
