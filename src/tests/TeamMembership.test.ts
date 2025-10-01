import { TeamMembershipModel, CreateTeamMembershipData, TeamRole } from '../models/TeamMembership';

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

import pool from '../config/database';
const mockQuery = (pool as any).query;

describe('TeamMembershipModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new team membership successfully', async () => {
      const membershipData: CreateTeamMembershipData = {
        team_id: 'team-123',
        user_id: 'user-123',
        role: 'member'
      };

      const mockResult = {
        rows: [{
          id: 'membership-123',
          team_id: 'team-123',
          user_id: 'user-123',
          role: 'member',
          joined_at: new Date('2023-01-01')
        }]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamMembershipModel.create(membershipData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_memberships'),
        ['team-123', 'user-123', 'member']
      );
      expect(result.team_id).toBe('team-123');
      expect(result.user_id).toBe('user-123');
      expect(result.role).toBe('member');
    });

    it('should throw error when membership creation fails', async () => {
      const membershipData: CreateTeamMembershipData = {
        team_id: 'team-123',
        user_id: 'user-123'
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(TeamMembershipModel.create(membershipData)).rejects.toThrow('Failed to create team membership');
    });
  });

  describe('findByTeamAndUser', () => {
    it('should find membership by team and user', async () => {
      const teamId = 'team-123';
      const userId = 'user-123';
      const mockResult = {
        rows: [{
          id: 'membership-123',
          team_id: teamId,
          user_id: userId,
          role: 'member',
          joined_at: new Date('2023-01-01')
        }]
      };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamMembershipModel.findByTeamAndUser(teamId, userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      expect(result).not.toBeNull();
      expect(result?.team_id).toBe(teamId);
    });

    it('should return null when membership not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMembershipModel.findByTeamAndUser('team-123', 'user-123');
      expect(result).toBeNull();
    });
  });

  describe('getTeamMembers', () => {
    it('should get all members of a team', async () => {
      const teamId = 'team-123';
      const mockMembers = [
        {
          id: 'membership-1',
          team_id: teamId,
          user_id: 'user-1',
          role: 'owner',
          joined_at: new Date('2023-01-01'),
          username: 'user1',
          elo_rating: 1800,
          rank: 'King'
        },
        {
          id: 'membership-2',
          team_id: teamId,
          user_id: 'user-2',
          role: 'member',
          joined_at: new Date('2023-01-02'),
          username: 'user2',
          elo_rating: 1600,
          rank: 'Queen'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockMembers });

      const result = await TeamMembershipModel.getTeamMembers(teamId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT tm.*, u.username, u.elo_rating, u.rank'),
        [teamId]
      );
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('owner');
    });
  });

  describe('removeFromTeam', () => {
    it('should remove user from team successfully', async () => {
      const teamId = 'team-123';
      const userId = 'user-123';
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await TeamMembershipModel.removeFromTeam(teamId, userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      expect(result).toBe(true);
    });

    it('should return false when user not found in team', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await TeamMembershipModel.removeFromTeam('team-123', 'user-123');
      expect(result).toBe(false);
    });
  });

  describe('isMember', () => {
    it('should return true when user is member', async () => {
      const teamId = 'team-123';
      const userId = 'user-123';
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'membership-123' }] });

      const result = await TeamMembershipModel.isMember(teamId, userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      expect(result).toBe(true);
    });

    it('should return false when user is not member', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMembershipModel.isMember('team-123', 'user-123');
      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has specific role', async () => {
      const teamId = 'team-123';
      const userId = 'user-123';
      const role: TeamRole = 'admin';
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'membership-123' }] });

      const result = await TeamMembershipModel.hasRole(teamId, userId, role);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM team_memberships WHERE team_id = $1 AND user_id = $2 AND role = $3',
        [teamId, userId, role]
      );
      expect(result).toBe(true);
    });

    it('should return false when user does not have specific role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMembershipModel.hasRole('team-123', 'user-123', 'admin');
      expect(result).toBe(false);
    });
  });

  describe('getTeamMemberCount', () => {
    it('should return team member count', async () => {
      const teamId = 'team-123';
      const mockResult = { rows: [{ count: '5' }] };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamMembershipModel.getTeamMemberCount(teamId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM team_memberships WHERE team_id = $1',
        [teamId]
      );
      expect(result).toBe(5);
    });
  });

  describe('getUserRole', () => {
    it('should return user role in team', async () => {
      const teamId = 'team-123';
      const userId = 'user-123';
      const mockResult = { rows: [{ role: 'admin' }] };

      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await TeamMembershipModel.getUserRole(teamId, userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      expect(result).toBe('admin');
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await TeamMembershipModel.getUserRole('team-123', 'user-123');
      expect(result).toBeNull();
    });
  });

  describe('canPerformAction', () => {
    it('should return true when user role is higher than target role', () => {
      expect(TeamMembershipModel.canPerformAction('owner', 'member')).toBe(true);
      expect(TeamMembershipModel.canPerformAction('admin', 'member')).toBe(true);
      expect(TeamMembershipModel.canPerformAction('moderator', 'member')).toBe(true);
    });

    it('should return false when user role is lower than or equal to target role', () => {
      expect(TeamMembershipModel.canPerformAction('member', 'member')).toBe(false);
      expect(TeamMembershipModel.canPerformAction('member', 'moderator')).toBe(false);
      expect(TeamMembershipModel.canPerformAction('moderator', 'admin')).toBe(false);
    });
  });

  describe('transferOwnership', () => {
    it('should transfer ownership successfully', async () => {
      const teamId = 'team-123';
      const fromUserId = 'user-1';
      const toUserId = 'user-2';

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn()
      };
      (pool as any).connect.mockResolvedValueOnce(mockClient);

      const result = await TeamMembershipModel.transferOwnership(teamId, fromUserId, toUserId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE team_memberships SET role = $3 WHERE team_id = $1 AND user_id = $2 AND role = $4',
        [teamId, fromUserId, 'member', 'owner']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE team_memberships SET role = $3 WHERE team_id = $1 AND user_id = $2',
        [teamId, toUserId, 'owner']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should rollback on error', async () => {
      const teamId = 'team-123';
      const fromUserId = 'user-1';
      const toUserId = 'user-2';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')), // First UPDATE
        release: jest.fn()
      };
      (pool as any).connect.mockResolvedValueOnce(mockClient);

      await expect(TeamMembershipModel.transferOwnership(teamId, fromUserId, toUserId))
        .rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('validateMembershipData', () => {
    it('should validate membership data successfully', () => {
      const validData: CreateTeamMembershipData = {
        team_id: 'team-123',
        user_id: 'user-123',
        role: 'member'
      };

      const result = TeamMembershipModel.validateMembershipData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const invalidData: CreateTeamMembershipData = {
        team_id: '',
        user_id: '',
        role: 'invalid-role' as TeamRole
      };

      const result = TeamMembershipModel.validateMembershipData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Team ID is required');
      expect(result.errors).toContain('User ID is required');
      expect(result.errors).toContain('Invalid role. Must be owner, admin, moderator, or member');
    });
  });
});

