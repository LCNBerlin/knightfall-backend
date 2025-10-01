import request from 'supertest';
import app from '../app';

// Mock DB
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn()
  },
}));

import pool from '../config/database';
const mockQuery = (pool as any).query;

// Mock teamValidation middlewares to no-ops
jest.mock('../middleware/teamValidation', () => ({
  validateTeamId: (req: any, res: any, next: any) => next(),
  validateTeamName: (req: any, res: any, next: any) => next(),
  validateTeamCreation: (req: any, res: any, next: any) => next(),
  validateTeamUpdate: (req: any, res: any, next: any) => next(),
  validatePagination: (req: any, res: any, next: any) => next(),
  validateSearch: (req: any, res: any, next: any) => next(),
}));

describe('Team Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/teams/:teamId/summary', () => {
    it('should return team summary successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total_games: 50, wins: 30, losses: 15, draws: 5, team_rating: 1400, updated_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ count: 12 }] })
        .mockResolvedValueOnce({ rows: [{ count: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'm1' }] })
        .mockResolvedValueOnce({ rows: [{ count: 42 }] });

      const res = await request(app).get('/api/analytics/teams/team-123/summary');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.members).toBe(12);
      expect(res.body.data.achievements).toBe(5);
      expect(res.body.data.recent_messages_7d).toBe(42);
    });
  });

  describe('GET /api/analytics/teams/:teamId/trends', () => {
    it('should return team trends successfully', async () => {
      // First call (rating trend) should reject to go down the catch path
      mockQuery
        .mockRejectedValueOnce(new Error('team_stats_history does not exist'))
        .mockResolvedValueOnce({ rows: [{ day: new Date(), messages: 3 }] })
        .mockResolvedValueOnce({ rows: [{ day: new Date(), matches: 1 }] });

      const res = await request(app).get('/api/analytics/teams/team-123/trends?window=30');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.window_days).toBe(30);
      expect(Array.isArray(res.body.data.activity_trend)).toBe(true);
      expect(Array.isArray(res.body.data.match_trend)).toBe(true);
    });
  });

  describe('GET /api/analytics/leaderboards/activity', () => {
    it('should return activity leaderboard', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ team_id: 't1', team_name: 'Team 1', messages_7d: 100 }] });
      const res = await request(app).get('/api/analytics/leaderboards/activity?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leaderboard).toHaveLength(1);
    });
  });

  describe('GET /api/analytics/leaderboards/achievements', () => {
    it('should return achievements leaderboard', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ team_id: 't1', team_name: 'Team 1', achievements: 7 }] });
      const res = await request(app).get('/api/analytics/leaderboards/achievements?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leaderboard).toHaveLength(1);
    });
  });

  describe('GET /api/analytics/teams/:teamId/export', () => {
    it('should export analytics in JSON', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ team_id: 'team-123', total_games: 10, members: 5, achievements: 2, updated_at: new Date(), team_rating: 1200, wins: 5, losses: 3, draws: 2 }] })
        .mockResolvedValueOnce({ rows: [{ day: new Date(), messages: 3 }] });

      const res = await request(app).get('/api/analytics/teams/team-123/export?format=json');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team_id).toBe('team-123');
    });

    it('should export analytics in CSV', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ team_id: 'team-123', total_games: 10, members: 5, achievements: 2, updated_at: new Date(), team_rating: 1200, wins: 5, losses: 3, draws: 2 }] })
        .mockResolvedValueOnce({ rows: [{ day: new Date(), messages: 3 }] });

      const res = await request(app).get('/api/analytics/teams/team-123/export?format=csv');
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/csv');
      expect(res.text.startsWith('day,messages')).toBe(true);
    });
  });
});
