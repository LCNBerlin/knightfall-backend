-- Create teams table migration
-- This script creates the teams table with all necessary fields

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(255),
  house_color VARCHAR(7), -- hex color like #FF0000
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on team name for faster searches
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Insert some sample teams for testing
INSERT INTO teams (name, description, house_color) VALUES
  ('House of Kings', 'The royal house of chess masters', '#FFD700'),
  ('Pawn Masters', 'Masters of the pawn game', '#8B4513'),
  ('Rook Riders', 'Strategic castle defenders', '#696969'),
  ('Bishop Brigade', 'Diagonal attack specialists', '#9370DB'),
  ('Queen''s Guard', 'Elite defenders of the queen', '#FF69B4'),
  ('Knight''s Order', 'Chivalrous chess warriors', '#4169E1')
ON CONFLICT (name) DO NOTHING;

