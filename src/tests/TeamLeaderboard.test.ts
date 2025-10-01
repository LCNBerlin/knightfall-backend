import request from 'supertest';
import app from '../app';
import { TeamStatsModel, CreateTeamStatsData } from '../models/TeamStats';
import { TeamAchievementModel, CreateTeamAchievementData } from '../models/TeamAchievement';

// Mock the database pool for testing
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  },
}));

// Mock the authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', username: 'testuser' };
    next();
  },
  optionalAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', username: 'testuser' };
    next();
  },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', username: 'testuser' };
    next();
  }
}));

// Mock the Team model
jest.mock('../models/Team', () => ({
  TeamModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'team-123',
      name: 'Test Team',
      description: 'A test team'
    })
  }
}));

import pool from '../config/database';
const mockQuery = (pool as any).query;

describe('Team Leaderboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/leaderboard', () => {
    it('should get team leaderboard successfully', async () => {
      const mockLeaderboard = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 10,
          wins: 8,
          losses: 2,
          draws: 0,
          team_rating: 1400,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team'
        }
      ];

      const mockCount = { count: '1' };

      // Mock getLeaderboard
      mockQuery.mockResolvedValueOnce({ rows: mockLeaderboard });
      // Mock getTotalTeamCount
      mockQuery.mockResolvedValueOnce({ rows: [mockCount] });

      const response = await request(app)
        .get('/api/leaderboard?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(1);
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/leaderboard?limit=150');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Limit must be between 1 and 100');
    });
  });

  describe('GET /api/leaderboard/win-rate', () => {
    it('should get win rate leaderboard successfully', async () => {
      const mockLeaderboard = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 10,
          wins: 9,
          losses: 1,
          draws: 0,
          team_rating: 1500,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team',
          win_rate: 90.0
        }
      ];

      const mockCount = { count: '1' };

      mockQuery.mockResolvedValueOnce({ rows: mockLeaderboard });
      mockQuery.mockResolvedValueOnce({ rows: [mockCount] });

      const response = await request(app)
        .get('/api/leaderboard/win-rate?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(1);
    });
  });

  describe('GET /api/leaderboard/games', () => {
    it('should get games leaderboard successfully', async () => {
      const mockLeaderboard = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 50,
          wins: 30,
          losses: 15,
          draws: 5,
          team_rating: 1300,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team'
        }
      ];

      const mockCount = { count: '1' };

      mockQuery.mockResolvedValueOnce({ rows: mockLeaderboard });
      mockQuery.mockResolvedValueOnce({ rows: [mockCount] });

      const response = await request(app)
        .get('/api/leaderboard/games?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(1);
    });
  });

  describe('GET /api/leaderboard/top', () => {
    it('should get top teams successfully', async () => {
      const mockTopTeams = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 20,
          wins: 18,
          losses: 2,
          draws: 0,
          team_rating: 1600,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTopTeams });

      const response = await request(app)
        .get('/api/leaderboard/top?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('GET /api/leaderboard/active', () => {
    it('should get most active teams successfully', async () => {
      const mockActiveTeams = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 100,
          wins: 60,
          losses: 30,
          draws: 10,
          team_rating: 1350,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockActiveTeams });

      const response = await request(app)
        .get('/api/leaderboard/active?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveLength(1);
    });
  });

  describe('GET /api/leaderboard/rating-range', () => {
    it('should get teams by rating range successfully', async () => {
      const mockTeams = [
        {
          id: 'stats-1',
          team_id: 'team-1',
          total_games: 15,
          wins: 10,
          losses: 5,
          draws: 0,
          team_rating: 1300,
          updated_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          description: 'Alpha team'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTeams });

      const response = await request(app)
        .get('/api/leaderboard/rating-range?min_rating=1200&max_rating=1400&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveLength(1);
      expect(response.body.data.rating_range.min).toBe(1200);
      expect(response.body.data.rating_range.max).toBe(1400);
    });

    it('should return 400 for invalid rating range', async () => {
      const response = await request(app)
        .get('/api/leaderboard/rating-range?min_rating=1500&max_rating=1200');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid rating range');
    });
  });

  describe('GET /api/leaderboard/teams/:teamId/ranking', () => {
    it('should get team ranking successfully', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockRanking = { rank: 5, total: 100 };

      mockQuery.mockResolvedValueOnce({ rows: [mockRanking] });

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/ranking`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toBe(5);
      expect(response.body.data.total).toBe(100);
    });

    it('should return 404 for team not in leaderboard', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/ranking`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team not found in leaderboard');
    });
  });

  describe('GET /api/leaderboard/teams/:teamId/performance', () => {
    it('should get team performance successfully', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockStats = {
        id: 'stats-1',
        team_id: teamId,
        total_games: 20,
        wins: 15,
        losses: 5,
        draws: 0,
        team_rating: 1400,
        updated_at: new Date('2023-01-01')
      };
      const mockRanking = { rank: 3, total: 50 };

      // Mock findByTeamId
      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });
      // Mock getTeamRanking
      mockQuery.mockResolvedValueOnce({ rows: [mockRanking] });

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/performance`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.team_rating).toBe(1400);
      expect(response.body.data.ranking.rank).toBe(3);
      expect(response.body.data.win_rate).toBe(75);
    });

    it('should return 404 for team not found', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/performance`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team not found');
    });
  });

  describe('GET /api/leaderboard/teams/:teamId/achievements', () => {
    it('should get team achievements successfully', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockAchievements = [
        {
          id: 'achievement-1',
          team_id: teamId,
          achievement_type: 'first_win',
          description: 'Win your first team game',
          points: 10,
          earned_at: new Date('2023-01-01')
        }
      ];
      const mockTotalPoints = { total_points: '10' };

      // Mock Team.findById
      const { TeamModel } = require('../models/Team');
      TeamModel.findById.mockResolvedValueOnce({
        id: teamId,
        name: 'Test Team'
      });

      // Mock getTeamAchievements
      mockQuery.mockResolvedValueOnce({ rows: mockAchievements });
      // Mock getTeamAchievementPoints
      mockQuery.mockResolvedValueOnce({ rows: [mockTotalPoints] });

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/achievements`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.achievements).toHaveLength(1);
      expect(response.body.data.total_points).toBe(10);
      expect(response.body.data.achievement_count).toBe(1);
    });

    it('should return 404 for team not found', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      const { TeamModel } = require('../models/Team');
      TeamModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/api/leaderboard/teams/${teamId}/achievements`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team not found');
    });
  });

  describe('GET /api/leaderboard/achievements', () => {
    it('should get achievement leaderboard successfully', async () => {
      const mockLeaderboard = [
        {
          team_id: 'team-1',
          team_name: 'Team Alpha',
          house_color: '#FF0000',
          achievement_count: 5,
          total_points: 150
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockLeaderboard });

      const response = await request(app)
        .get('/api/leaderboard/achievements?limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('GET /api/leaderboard/achievements/recent', () => {
    it('should get recent achievements successfully', async () => {
      const mockAchievements = [
        {
          id: 'achievement-1',
          team_id: 'team-1',
          achievement_type: 'first_win',
          description: 'Win your first team game',
          points: 10,
          earned_at: new Date('2023-01-01'),
          team_name: 'Team Alpha',
          house_color: '#FF0000'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockAchievements });

      const response = await request(app)
        .get('/api/leaderboard/achievements/recent?limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.achievements).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('GET /api/leaderboard/achievements/stats', () => {
    it('should get achievement statistics successfully', async () => {
      const mockStats = {
        total_achievements: 50,
        most_common: [
          { type: 'first_win', count: 20 },
          { type: 'streak_5', count: 15 }
        ],
        rarest: [
          { type: 'perfect_season', count: 1 },
          { type: 'undefeated_month', count: 2 }
        ]
      };

      const mockTotal = { count: '50' };
      const mockCommon = [
        { achievement_type: 'first_win', count: '20' },
        { achievement_type: 'streak_5', count: '15' }
      ];
      const mockRare = [
        { achievement_type: 'perfect_season', count: '1' },
        { achievement_type: 'undefeated_month', count: '2' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: [mockTotal] });
      mockQuery.mockResolvedValueOnce({ rows: mockCommon });
      mockQuery.mockResolvedValueOnce({ rows: mockRare });

      const response = await request(app)
        .get('/api/leaderboard/achievements/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_achievements).toBe(50);
      expect(response.body.data.most_common).toHaveLength(2);
      expect(response.body.data.rarest).toHaveLength(2);
    });
  });

  describe('POST /api/leaderboard/teams/:teamId/stats', () => {
    it('should update team stats successfully', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockUpdatedStats = {
        id: 'stats-1',
        team_id: teamId,
        total_games: 11,
        wins: 9,
        losses: 2,
        draws: 0,
        team_rating: 1410,
        updated_at: new Date('2023-01-01')
      };

      // Mock addGameResult
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedStats] });
      // Mock checkAndAwardAchievements
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/leaderboard/teams/${teamId}/stats`)
        .send({ result: 'win' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Team stats updated successfully');
      expect(response.body.data.stats.team_rating).toBe(1410);
    });

    it('should return 400 for invalid result', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      const response = await request(app)
        .post(`/api/leaderboard/teams/${teamId}/stats`)
        .send({ result: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Result must be win, loss, or draw');
    });
  });

  describe('DELETE /api/leaderboard/teams/:teamId/stats', () => {
    it('should reset team stats successfully', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockResetStats = {
        id: 'stats-1',
        team_id: teamId,
        total_games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        team_rating: 1200,
        updated_at: new Date('2023-01-01')
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockResetStats] });

      const response = await request(app)
        .delete(`/api/leaderboard/teams/${teamId}/stats`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Team stats reset successfully');
      expect(response.body.data.team_rating).toBe(1200);
    });

    it('should return 404 for team not found', async () => {
      const teamId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete(`/api/leaderboard/teams/${teamId}/stats`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team not found');
    });
  });
});
