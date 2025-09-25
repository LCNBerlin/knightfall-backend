// Team-related TypeScript types and interfaces

export interface Team {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  house_color: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  logo_url?: string;
  house_color?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  logo_url?: string;
  house_color?: string;
}

export interface TeamWithMemberCount extends Team {
  member_count: number;
}

export interface TeamSearchParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TeamValidationResult {
  isValid: boolean;
  errors: string[];
}

// Team role types for future team membership implementation
export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: Date;
}

// Team statistics for leaderboards
export interface TeamStats {
  team_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  team_rating: number;
  updated_at: Date;
}

// Team achievement types
export type TeamAchievementType = 
  | 'first_win'
  | 'streak_10'
  | 'tournament_champion'
  | 'team_level_10'
  | 'perfect_season';

export interface TeamAchievement {
  id: string;
  team_id: string;
  achievement_type: TeamAchievementType;
  earned_at: Date;
}

// API response types
export interface TeamListResponse {
  teams: Team[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TeamDetailResponse extends Team {
  member_count: number;
  stats?: TeamStats;
  achievements?: TeamAchievement[];
}
