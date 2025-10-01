import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { TeamMembershipModel } from '../models/TeamMembership';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  userRole?: string;
}

export class SocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> Set of room names

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        const user = await UserModel.findById(decoded.userId);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.username = user.username;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.username} connected with socket ${socket.id}`);
      
      // Store user connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
        this.userRooms.set(socket.userId, new Set());
      }

      // Join user to their personal room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Handle team chat events
      this.setupTeamChatHandlers(socket);
      
      // Handle notification events
      this.setupNotificationHandlers(socket);
      
      // Handle team update events
      this.setupTeamUpdateHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.username} disconnected`);
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          this.userRooms.delete(socket.userId);
        }
      });
    });
  }

  private setupTeamChatHandlers(socket: AuthenticatedSocket): void {
    // Join team chat room
    socket.on('join_team_chat', async (data: { teamId: string }) => {
      try {
        if (!socket.userId) return;

        const isMember = await TeamMembershipModel.isMember(data.teamId, socket.userId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to join chat' });
          return;
        }

        const roomName = `team_chat:${data.teamId}`;
        await socket.join(roomName);
        
        if (socket.userId) {
          this.userRooms.get(socket.userId)?.add(roomName);
        }

        socket.emit('joined_team_chat', { teamId: data.teamId });
        socket.to(roomName).emit('user_joined_chat', { 
          username: socket.username,
          teamId: data.teamId 
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join team chat' });
      }
    });

    // Leave team chat room
    socket.on('leave_team_chat', (data: { teamId: string }) => {
      const roomName = `team_chat:${data.teamId}`;
      socket.leave(roomName);
      
      if (socket.userId) {
        this.userRooms.get(socket.userId)?.delete(roomName);
      }

      socket.emit('left_team_chat', { teamId: data.teamId });
      socket.to(roomName).emit('user_left_chat', { 
        username: socket.username,
        teamId: data.teamId 
      });
    });

    // Send team chat message
    socket.on('team_chat_message', async (data: { teamId: string; message: string; messageType?: string }) => {
      try {
        if (!socket.userId) return;

        const isMember = await TeamMembershipModel.isMember(data.teamId, socket.userId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to send messages' });
          return;
        }

        const roomName = `team_chat:${data.teamId}`;
        const messageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          teamId: data.teamId,
          userId: socket.userId,
          username: socket.username,
          message: data.message,
          messageType: data.messageType || 'text',
          timestamp: new Date().toISOString()
        };

        // Broadcast to all team members
        this.io.to(roomName).emit('team_chat_message', messageData);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
  }

  private setupNotificationHandlers(socket: AuthenticatedSocket): void {
    // Subscribe to notifications
    socket.on('subscribe_notifications', () => {
      if (socket.userId) {
        socket.join(`notifications:${socket.userId}`);
      }
    });

    // Unsubscribe from notifications
    socket.on('unsubscribe_notifications', () => {
      if (socket.userId) {
        socket.leave(`notifications:${socket.userId}`);
      }
    });
  }

  private setupTeamUpdateHandlers(socket: AuthenticatedSocket): void {
    // Join team updates room
    socket.on('join_team_updates', async (data: { teamId: string }) => {
      try {
        if (!socket.userId) return;

        const isMember = await TeamMembershipModel.isMember(data.teamId, socket.userId);
        if (!isMember) {
          socket.emit('error', { message: 'You must be a member of this team to receive updates' });
          return;
        }

        const roomName = `team_updates:${data.teamId}`;
        await socket.join(roomName);
        
        if (socket.userId) {
          this.userRooms.get(socket.userId)?.add(roomName);
        }

        socket.emit('joined_team_updates', { teamId: data.teamId });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join team updates' });
      }
    });

    // Leave team updates room
    socket.on('leave_team_updates', (data: { teamId: string }) => {
      const roomName = `team_updates:${data.teamId}`;
      socket.leave(roomName);
      
      if (socket.userId) {
        this.userRooms.get(socket.userId)?.delete(roomName);
      }

      socket.emit('left_team_updates', { teamId: data.teamId });
    });
  }

  // Public methods for sending events from other parts of the application

  // Send notification to user
  public sendNotification(userId: string, notification: any): void {
    this.io.to(`notifications:${userId}`).emit('notification', notification);
  }

  // Send notification to multiple users
  public sendNotificationToUsers(userIds: string[], notification: any): void {
    userIds.forEach(userId => {
      this.sendNotification(userId, notification);
    });
  }

  // Send team chat message
  public sendTeamChatMessage(teamId: string, message: any): void {
    this.io.to(`team_chat:${teamId}`).emit('team_chat_message', message);
  }

  // Send team update
  public sendTeamUpdate(teamId: string, update: any): void {
    this.io.to(`team_updates:${teamId}`).emit('team_update', update);
  }

  // Send friend request notification
  public sendFriendRequestNotification(userId: string, fromUsername: string): void {
    this.sendNotification(userId, {
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUsername} sent you a friend request`,
      data: { from_username: fromUsername }
    });
  }

  // Send friend accepted notification
  public sendFriendAcceptedNotification(userId: string, fromUsername: string): void {
    this.sendNotification(userId, {
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${fromUsername} accepted your friend request`,
      data: { from_username: fromUsername }
    });
  }

  // Send team join notification
  public sendTeamJoinNotification(teamId: string, username: string): void {
    this.sendTeamUpdate(teamId, {
      type: 'member_joined',
      message: `${username} joined the team`,
      data: { username, teamId }
    });
  }

  // Send team leave notification
  public sendTeamLeaveNotification(teamId: string, username: string): void {
    this.sendTeamUpdate(teamId, {
      type: 'member_left',
      message: `${username} left the team`,
      data: { username, teamId }
    });
  }

  // Send achievement notification
  public sendAchievementNotification(userId: string, achievement: any): void {
    this.sendNotification(userId, {
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: achievement.description,
      data: achievement
    });
  }

  // Send game invite notification
  public sendGameInviteNotification(userId: string, fromUsername: string, gameType: string): void {
    this.sendNotification(userId, {
      type: 'game_invite',
      title: 'Game Invitation',
      message: `${fromUsername} invited you to a ${gameType} game`,
      data: { from_username: fromUsername, game_type: gameType }
    });
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get users in team chat
  public getUsersInTeamChat(teamId: string): string[] {
    const roomName = `team_chat:${teamId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }

  // Check if user is online
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get user's socket ID
  public getUserSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }
}

export default SocketServer;