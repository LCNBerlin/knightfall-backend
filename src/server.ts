import app from './app';
import { testConnection, initializeDatabase } from './config/database';
import { SocketServer } from './socket/socketServer';
import { WebSocketService } from './services/websocketService';
import { Server as HTTPServer } from 'http';

const PORT = process.env.PORT || 3001;

// Create HTTP server
const httpServer = new HTTPServer(app);

// Initialize Socket.io server
const socketServer = new SocketServer(httpServer);

// Initialize WebSocket service
WebSocketService.initialize(socketServer);

const server = httpServer.listen(PORT, async () => {
  console.log(`🚀 Knightfall Backend Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket server initialized`);
  
  // Test database connection
  try {
    await testConnection();
    await initializeDatabase();
    console.log(`⚔️  Ready to serve chess battles!`);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.log('💡 Make sure PostgreSQL is running: docker-compose up -d');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🛑 Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('🛑 Process terminated');
    process.exit(0);
  });
});

export default server;