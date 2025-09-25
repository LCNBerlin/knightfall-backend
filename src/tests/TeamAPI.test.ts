import request from 'supertest';
import app from '../app';
import { TeamModel } from '../models/Team';

// Mock the database pool for testing
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// Mock the authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    // Mock successful authentication
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

// Mock the User model
jest.mock('../models/User', () => ({
  UserModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      username: 'testuser',
      rank: 'King'
    })
  }
}));

import pool from '../config/database';
const mockQuery = (pool as any).query;

describe('Team API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/teams', () => {
    it('should create a new team successfully', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
        house_color: '#FF0000'
      };

      const mockResult = {
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Team',
          description: 'A test team',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        }]
      };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // nameExists check
      mockQuery.mockResolvedValueOnce(mockResult); // create team

      const response = await request(app)
        .post('/api/teams')
        .send(teamData)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Team');
    });

    it('should return 400 for invalid team data', async () => {
      const invalidData = {
        name: 'A', // Too short
        description: 'A'.repeat(501), // Too long
        house_color: 'invalid-color' // Invalid hex
      };

      const response = await request(app)
        .post('/api/teams')
        .send(invalidData)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 for duplicate team name', async () => {
      const teamData = {
        name: 'Existing Team',
        description: 'A test team'
      };

      mockQuery.mockResolvedValueOnce({ rows: [{ id: '123' }] }); // nameExists returns true

      const response = await request(app)
        .post('/api/teams')
        .send(teamData)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team name already exists');
    });
  });

  describe('GET /api/teams', () => {
    it('should get all teams with pagination', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Team 1',
          description: 'First team',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Team 2',
          description: 'Second team',
          logo_url: null,
          house_color: '#00FF00',
          created_at: new Date('2023-01-02'),
          updated_at: new Date('2023-01-02')
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTeams }); // findAll
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // getCount

      const response = await request(app)
        .get('/api/teams?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/teams?page=0&limit=200');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/teams/search', () => {
    it('should search teams by name', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Team 1',
          description: 'First test team',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTeams });

      const response = await request(app)
        .get('/api/teams/search?q=Test&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveLength(1);
      expect(response.body.data.query).toBe('Test');
    });

    it('should return 400 for missing search query', async () => {
      const response = await request(app)
        .get('/api/teams/search');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/teams/:id', () => {
    it('should get team by ID', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTeam = {
        id: teamId,
        name: 'Test Team',
        description: 'A test team',
        logo_url: null,
        house_color: '#FF0000',
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-01')
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTeam] });

      const response = await request(app)
        .get(`/api/teams/${teamId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(teamId);
    });

    it('should return 404 for non-existent team', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/teams/${teamId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid team ID format', async () => {
      const response = await request(app)
        .get('/api/teams/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update team successfully', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        name: 'Updated Team',
        description: 'Updated description'
      };

      const existingTeam = {
        id: teamId,
        name: 'Original Team',
        description: 'Original description',
        logo_url: null,
        house_color: '#FF0000',
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-01')
      };

      const updatedTeam = {
        ...existingTeam,
        name: 'Updated Team',
        description: 'Updated description'
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingTeam] }); // findById
      mockQuery.mockResolvedValueOnce({ rows: [] }); // nameExists check
      mockQuery.mockResolvedValueOnce({ rows: [updatedTeam] }); // update

      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .send(updateData)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Team');
    });

    it('should return 404 for non-existent team', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery.mockResolvedValueOnce({ rows: [] }); // findById returns empty

      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .send({ name: 'Updated Team' })
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete team successfully', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      const existingTeam = {
        id: teamId,
        name: 'Test Team',
        description: 'A test team',
        logo_url: null,
        house_color: '#FF0000',
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-01')
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingTeam] }); // findById
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // delete

      const response = await request(app)
        .delete(`/api/teams/${teamId}`)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent team', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery.mockResolvedValueOnce({ rows: [] }); // findById returns empty

      const response = await request(app)
        .delete(`/api/teams/${teamId}`)
        .set('Authorization', 'Bearer fake-jwt-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/teams/check-name', () => {
    it('should check if team name exists', async () => {
      const teamName = 'Existing Team';
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const response = await request(app)
        .get(`/api/teams/check-name?name=${teamName}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(true);
    });

    it('should return 400 for missing team name', async () => {
      const response = await request(app)
        .get('/api/teams/check-name');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
