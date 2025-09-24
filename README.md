# Knightfall Backend

Initialized via GitHub CLI.
# 🏰 Knightfall Backend API

High-stakes chess wagering backend server built with Node.js, Express, TypeScript, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.18.0 or higher
- Docker Desktop (for database)

### One-time setup
```bash
# From repo root or this folder
cp -n env.example .env || true
npm install
```

### Install Docker (if not installed)
1. **macOS**: Download from [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. **Install**: Run the installer and follow the setup wizard
3. **Verify**: Open terminal and run `docker --version`

### Setup Database
```bash
# Start PostgreSQL and Redis containers
docker compose up -d

# Check if containers are running
docker ps

# View database logs
docker logs knightfall-postgres
```

### Start Backend Server
```bash
# Install dependencies
npm install

# Copy environment file
cp -n env.example .env || true

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Start the Full Stack
Run backend and frontend together locally:
```bash
# Backend (this folder)
cd /Users/berlin/Desktop/Chess/knightfall-backend
docker compose up -d
npm run dev

# Frontend (new terminal)
cd /Users/berlin/Desktop/Chess/knightfall
npm run dev
```

URLs:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

Set `FRONTEND_URL` in `.env` if you change ports.

## 🗄️ Database Schema

The database includes these tables:
- **users**: Player accounts, ratings, balances
- **games**: Chess matches and game states
- **tournaments**: Tournament information and brackets
- **teams**: Team/house system
- **puzzles**: Chess puzzles and solutions
- **transactions**: Token/cash movement tracking

## 📡 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (Coming in Week 2)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Users (Coming in Week 2)
- `GET /api/users/profile` - Get user profile
- `GET /api/users/leaderboard` - Get leaderboard

### Games (Coming in Week 3)
- `POST /api/games/create` - Create new game
- `GET /api/games/active` - Get active games
- `POST /api/games/:id/move` - Make a move

## 🛠 Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **Docker** - Containerization
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication

## 📁 Project Structure

```
src/
├── app.ts              # Express app configuration
├── server.ts           # Server entry point
├── controllers/        # Route controllers (coming next)
├── middleware/         # Custom middleware
├── models/            # Database models (coming next)
├── routes/            # API routes
├── utils/             # Utility functions (coming next)
└── config/            # Configuration files
    └── database.ts    # Database connection
```

## 🌍 Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=knightfall
DB_USER=knightfall_user
DB_PASSWORD=knightfall_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

## 🐳 Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs

# Reset database (removes all data)
docker compose down -v
docker compose up -d

# Access PostgreSQL directly
docker exec -it knightfall-postgres psql -U knightfall_user -d knightfall
```

## ✅ Task 2 Complete

✓ PostgreSQL database setup with Docker
✓ Redis cache setup
✓ Database schema with all tables
✓ Connection pooling and configuration
✓ Sample data insertion
✓ Database initialization scripts
✓ Environment configuration

## ✅ Task 3 Complete

✓ JWT-based authentication system
✓ User registration with validation
✓ User login with password verification
✓ Password hashing with bcrypt
✓ JWT token generation and verification
✓ Authentication middleware for protected routes
✓ User profile management
✓ Input validation (email, username, password)
✓ Role-based authorization system
✓ Complete auth controller with error handling

**Next:** Task 4 - Add WebSocket support for real-time multiplayer chess matches
>>>>>>> 8c05ffd (chore: initial backend import)
