import { TeamModel, CreateTeamData, UpdateTeamData } from '../models/Team';

// Mock the database pool for testing
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../config/database';
const mockQuery = (pool as any).query;

describe('TeamModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new team successfully', async () => {
      const teamData: CreateTeamData = {
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

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamModel.create(teamData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO teams'),
        ['Test Team', 'A test team', null, '#FF0000']
      );
      expect(result.name).toBe('Test Team');
      expect(result.description).toBe('A test team');
      expect(result.house_color).toBe('#FF0000');
    });

    it('should throw error when team creation fails', async () => {
      const teamData: CreateTeamData = {
        name: 'Test Team'
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(TeamModel.create(teamData)).rejects.toThrow('Failed to create team');
    });
  });

  describe('findById', () => {
    it('should find team by ID', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        rows: [{
          id: teamId,
          name: 'Test Team',
          description: 'A test team',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        }]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamModel.findById(teamId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM teams WHERE id = $1',
        [teamId]
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe(teamId);
    });

    it('should return null when team not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamModel.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should find team by name', async () => {
      const teamName = 'Test Team';
      const mockResult = {
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: teamName,
          description: 'A test team',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        }]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamModel.findByName(teamName);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM teams WHERE name = $1',
        [teamName]
      );
      expect(result).not.toBeNull();
      expect(result?.name).toBe(teamName);
    });
  });

  describe('searchByName', () => {
    it('should search teams by name', async () => {
      const searchTerm = 'Test';
      const mockResult = {
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test Team 1',
            description: 'A test team',
            logo_url: null,
            house_color: '#FF0000',
            created_at: new Date('2023-01-01'),
            updated_at: new Date('2023-01-01')
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            name: 'Test Team 2',
            description: 'Another test team',
            logo_url: null,
            house_color: '#00FF00',
            created_at: new Date('2023-01-02'),
            updated_at: new Date('2023-01-02')
          }
        ]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamModel.searchByName(searchTerm);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name ILIKE'),
        [`%${searchTerm}%`, 20]
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Team 1');
    });
  });

  describe('update', () => {
    it('should update team successfully', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData: UpdateTeamData = {
        name: 'Updated Team',
        description: 'Updated description'
      };

      const mockResult = {
        rows: [{
          id: teamId,
          name: 'Updated Team',
          description: 'Updated description',
          logo_url: null,
          house_color: '#FF0000',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-02')
        }]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamModel.update(teamId, updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE teams'),
        [teamId, 'Updated Team', 'Updated description']
      );
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Team');
    });

    it('should return null when no fields to update', async () => {
      const result = await TeamModel.update('team-id', {});
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete team successfully', async () => {
      const teamId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await TeamModel.delete(teamId);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM teams WHERE id = $1',
        [teamId]
      );
      expect(result).toBe(true);
    });

    it('should return false when team not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await TeamModel.delete('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('nameExists', () => {
    it('should return true when name exists', async () => {
      const teamName = 'Existing Team';
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const result = await TeamModel.nameExists(teamName);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM teams WHERE name = $1',
        [teamName]
      );
      expect(result).toBe(true);
    });

    it('should return false when name does not exist', async () => {
      const teamName = 'Non-existing Team';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamModel.nameExists(teamName);
      expect(result).toBe(false);
    });

    it('should exclude specified ID when checking name', async () => {
      const teamName = 'Test Team';
      const excludeId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamModel.nameExists(teamName, excludeId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM teams WHERE name = $1 AND id != $2',
        [teamName, excludeId]
      );
      expect(result).toBe(false);
    });
  });

  describe('validateTeamData', () => {
    it('should validate team data successfully', () => {
      const validData: CreateTeamData = {
        name: 'Valid Team',
        description: 'A valid team description',
        house_color: '#FF0000'
      };

      const result = TeamModel.validateTeamData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const invalidData: CreateTeamData = {
        name: 'A', // Too short
        description: 'A'.repeat(501), // Too long
        house_color: 'invalid-color' // Invalid hex
      };

      const result = TeamModel.validateTeamData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Team name must be at least 3 characters long');
      expect(result.errors).toContain('Description must be less than 500 characters');
      expect(result.errors).toContain('House color must be a valid hex color (e.g., #FF0000)');
    });

    it('should validate team name characters', () => {
      const invalidData: CreateTeamData = {
        name: 'Team@#$%' // Invalid characters
      };

      const result = TeamModel.validateTeamData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Team name can only contain letters, numbers, spaces, hyphens, and underscores');
    });
  });
});
