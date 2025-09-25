-- Knightfall Database Initialization Script
-- This script creates the initial database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    elo_rating INTEGER DEFAULT 1200,
    token_balance INTEGER DEFAULT 1000,
    cash_balance DECIMAL(10,2) DEFAULT 0.00,
    rank VARCHAR(20) DEFAULT 'Pawn',
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    white_player_id UUID REFERENCES users(id),
    black_player_id UUID REFERENCES users(id),
    game_type VARCHAR(20) NOT NULL DEFAULT 'ladder', -- ladder, tournament, puzzle
    wager_amount INTEGER DEFAULT 0,
    wager_type VARCHAR(10) DEFAULT 'tokens', -- tokens, cash
    game_state JSONB NOT NULL DEFAULT '{}',
    moves JSONB DEFAULT '[]',
    result VARCHAR(10), -- white_win, black_win, draw, abandoned
    winner_id UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- game_wager, game_win, game_loss, purchase, refund, bonus, penalty
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tournament_type VARCHAR(20) NOT NULL, -- knockout, swiss, round_robin
    prize_pool INTEGER DEFAULT 0,
    entry_fee INTEGER DEFAULT 0,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, active, completed, cancelled
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tournament_participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'registered', -- registered, active, eliminated, winner
    final_rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url VARCHAR(255),
    house_color VARCHAR(7), -- hex color like #FF0000
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- leader, admin, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Create puzzles table
CREATE TABLE IF NOT EXISTS puzzles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fen_position VARCHAR(100) NOT NULL,
    solution JSONB NOT NULL,
    difficulty INTEGER DEFAULT 1000,
    puzzle_type VARCHAR(20) DEFAULT 'tactics', -- tactics, endgame, opening
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_puzzle_attempts table
CREATE TABLE IF NOT EXISTS user_puzzle_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id UUID REFERENCES puzzles(id) ON DELETE CASCADE,
    solved BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    time_taken INTEGER, -- in seconds
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table for token/cash movements
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- game_wager, game_win, purchase, deposit, withdrawal
    amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL, -- tokens, cash
    description TEXT,
    related_game_id UUID REFERENCES games(id),
    related_tournament_id UUID REFERENCES tournaments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo_rating);
CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player_id, black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(result);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Insert some sample data for testing
INSERT INTO users (username, email, password_hash, elo_rating, token_balance, rank) VALUES
('ChessMaster', 'chessmaster@knightfall.com', 'hashed_password_here', 1850, 2450, 'King'),
('PawnSlayer', 'pawnslayer@knightfall.com', 'hashed_password_here', 1720, 1200, 'Queen'),
('RookRider', 'rookrider@knightfall.com', 'hashed_password_here', 1650, 800, 'Bishop')
ON CONFLICT (username) DO NOTHING;

-- Insert sample teams
INSERT INTO teams (name, description, house_color) VALUES
('House of Kings', 'Elite chess players', '#FFD700'),
('Pawn Masters', 'Rising stars', '#8B4513'),
('Rook Riders', 'Strategic players', '#696969'),
('Bishop Brigade', 'Diagonal attack specialists', '#9370DB'),
('Queen''s Guard', 'Elite defenders of the queen', '#FF69B4'),
('Knight''s Order', 'Chivalrous chess warriors', '#4169E1')
ON CONFLICT (name) DO NOTHING;

-- Insert sample tournaments
INSERT INTO tournaments (name, description, tournament_type, prize_pool, max_participants, status) VALUES
('Weekly Championship', 'Weekly competitive tournament', 'swiss', 5000, 128, 'upcoming'),
('Team Showdown', 'House vs House battle', 'knockout', 1000, 32, 'upcoming'),
('Puzzle Master Challenge', 'Tactical puzzle tournament', 'round_robin', 500, 64, 'upcoming')
ON CONFLICT DO NOTHING; 