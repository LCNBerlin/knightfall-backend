import { Socket } from 'socket.io';
import { AuthUtils, JWTPayload } from '../utils/auth';
import { UserModel } from '../models/User';

export const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    // Verify user still exists in database
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    // Add user data to socket
    socket.data.user = {
      userId: user.id,
      username: user.username,
      email: user.email
    };

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};
