import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import economyRoutes from './routes/economy';
import teamRoutes from './routes/teams';
import teamMembershipRoutes from './routes/teamMemberships';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://192.168.12.207:3000', // Your computer's IP
    /^http:\/\/192\.168\.\d+\.\d+:3000$/, // Allow any local network IP
    /^http:\/\/10\.\d+\.\d+\.\d+:3000$/, // Allow 10.x.x.x networks
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:3000$/ // Allow 172.16-31.x.x networks
  ],
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Knightfall Backend',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api', teamMembershipRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware (should be last)
app.use(errorHandler);

export default app;