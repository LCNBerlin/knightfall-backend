import request from 'supertest';
import app from '../app';

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

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id', username: 'testuser' };
    next();
  }),
}));

// Mock teamValidation middlewares
jest.mock('../middleware/teamValidation', () => ({
  validateTeamId: (req: any, res: any, next: any) => next(),
  validateTeamName: (req: any, res: any, next: any) => next(),
  validateTeamCreation: (req: any, res: any, next: any) => next(),
  validateTeamUpdate: (req: any, res: any, next: any) => next(),
  validatePagination: (req: any, res: any, next: any) => next(),
  validateSearch: (req: any, res: any, next: any) => next(),
}));

// Mock teamPermissions middleware
jest.mock('../middleware/teamPermissions', () => ({
  TeamPermissionMiddleware: {
    requirePermission: jest.fn(() => (req: any, res: any, next: any) => next()),
    requireAnyPermission: jest.fn(() => (req: any, res: any, next: any) => next()),
    requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
    requireRoleManagement: jest.fn(() => (req: any, res: any, next: any) => next()),
    loadTeamPermissions: jest.fn(() => (req: any, res: any, next: any) => next()),
    requireTeamOwner: jest.fn(() => (req: any, res: any, next: any) => next()),
  }
}));

// Mock models
jest.mock('../models/TeamInvitation', () => ({
  TeamInvitationModel: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getTeamInvitations: jest.fn(),
    getUserInvitations: jest.fn(),
    getPendingInvitations: jest.fn(),
    hasPendingInvitation: jest.fn(),
    acceptInvitation: jest.fn(),
    declineInvitation: jest.fn(),
    cancelInvitation: jest.fn(),
    cleanupExpiredInvitations: jest.fn(),
    getTeamInvitationStats: jest.fn(),
    validateInvitationData: jest.fn(() => ({ isValid: true, errors: [] })),
    canInviteToTeam: jest.fn(() => ({ canInvite: true }))
  }
}));

jest.mock('../models/TeamMembership', () => ({
  TeamMembershipModel: {
    isMember: jest.fn(),
    create: jest.fn(),
    getUserRole: jest.fn()
  }
}));

jest.mock('../models/Team', () => ({
  TeamModel: {
    findById: jest.fn()
  }
}));

jest.mock('../models/User', () => ({
  UserModel: {
    findById: jest.fn()
  }
}));

jest.mock('../models/Notification', () => ({
  NotificationModel: {
    create: jest.fn()
  }
}));

jest.mock('../services/websocketService', () => ({
  WebSocketService: {
    sendTeamInvitationNotification: jest.fn(),
    sendInvitationAcceptedNotification: jest.fn(),
    sendInvitationDeclinedNotification: jest.fn(),
    sendTeamMemberJoinedNotification: jest.fn()
  }
}));

describe('Team Invitations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/invitations/teams/:teamId/invitations', () => {
    it('should send invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        team_id: 'team-123',
        inviter_id: 'test-user-id',
        invitee_id: 'invitee-123',
        role: 'member',
        message: 'Join our team!',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
        responded_at: null
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      const { TeamMembershipModel } = require('../models/TeamMembership');
      const { UserModel } = require('../models/User');
      const { TeamModel } = require('../models/Team');

      TeamMembershipModel.isMember.mockResolvedValueOnce(false);
      UserModel.findById.mockResolvedValueOnce({ id: 'invitee-123', username: 'invitee' });
      TeamInvitationModel.hasPendingInvitation.mockResolvedValueOnce(false);
      TeamInvitationModel.create.mockResolvedValueOnce(mockInvitation);
      TeamModel.findById.mockResolvedValueOnce({ id: 'team-123', name: 'Test Team' });
      UserModel.findById.mockResolvedValueOnce({ id: 'test-user-id', username: 'testuser' });

      const response = await request(app)
        .post('/api/invitations/teams/team-123/invitations')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          invitee_id: 'invitee-123',
          role: 'member',
          message: 'Join our team!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation sent successfully');
      expect(response.body.data.id).toBe('invitation-123');
    });

    it('should return 404 if invitee not found', async () => {
      const { UserModel } = require('../models/User');
      UserModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/invitations/teams/team-123/invitations')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          invitee_id: 'non-existent',
          role: 'member'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 409 if user already a member', async () => {
      const { TeamMembershipModel } = require('../models/TeamMembership');
      const { UserModel } = require('../models/User');

      TeamMembershipModel.isMember.mockResolvedValueOnce(true);
      UserModel.findById.mockResolvedValueOnce({ id: 'invitee-123', username: 'invitee' });

      const response = await request(app)
        .post('/api/invitations/teams/team-123/invitations')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          invitee_id: 'invitee-123',
          role: 'member'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is already a member of this team');
    });

    it('should return 409 if pending invitation exists', async () => {
      const { TeamMembershipModel } = require('../models/TeamMembership');
      const { UserModel } = require('../models/User');
      const { TeamInvitationModel } = require('../models/TeamInvitation');

      TeamMembershipModel.isMember.mockResolvedValueOnce(false);
      UserModel.findById.mockResolvedValueOnce({ id: 'invitee-123', username: 'invitee' });
      TeamInvitationModel.hasPendingInvitation.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/invitations/teams/team-123/invitations')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          invitee_id: 'invitee-123',
          role: 'member'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already has a pending invitation to this team');
    });
  });

  describe('GET /api/invitations/teams/:teamId/invitations', () => {
    it('should return team invitations successfully', async () => {
      const mockInvitations = [
        { id: 'inv-1', team_id: 'team-123', status: 'pending' },
        { id: 'inv-2', team_id: 'team-123', status: 'accepted' }
      ];

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.getTeamInvitations.mockResolvedValueOnce(mockInvitations);

      const response = await request(app).get('/api/invitations/teams/team-123/invitations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitations).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });
  });

  describe('GET /api/invitations/users/:userId/invitations', () => {
    it('should return user invitations successfully', async () => {
      const mockInvitations = [
        { id: 'inv-1', invitee_id: 'user-123', status: 'pending' },
        { id: 'inv-2', invitee_id: 'user-123', status: 'accepted' }
      ];

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.getUserInvitations.mockResolvedValueOnce(mockInvitations);

      const response = await request(app)
        .get('/api/invitations/users/user-123/invitations?type=sent')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitations).toHaveLength(2);
    });

    it('should return 400 for invalid type', async () => {
      const response = await request(app)
        .get('/api/invitations/users/user-123/invitations?type=invalid')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Type must be "sent" or "received"');
    });
  });

  describe('GET /api/invitations/invitations/pending', () => {
    it('should return pending invitations successfully', async () => {
      const mockInvitations = [
        { id: 'inv-1', invitee_id: 'test-user-id', status: 'pending' },
        { id: 'inv-2', invitee_id: 'test-user-id', status: 'pending' }
      ];

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.getPendingInvitations.mockResolvedValueOnce(mockInvitations);

      const response = await request(app)
        .get('/api/invitations/invitations/pending')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitations).toHaveLength(2);
    });
  });

  describe('PUT /api/invitations/invitations/:invitationId/accept', () => {
    it('should accept invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        team_id: 'team-123',
        invitee_id: 'test-user-id',
        role: 'member',
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      const { TeamMembershipModel } = require('../models/TeamMembership');
      const { TeamModel } = require('../models/Team');
      const { UserModel } = require('../models/User');

      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);
      TeamInvitationModel.acceptInvitation.mockResolvedValueOnce({ ...mockInvitation, status: 'accepted' });
      TeamMembershipModel.create.mockResolvedValueOnce({});
      TeamModel.findById.mockResolvedValueOnce({ id: 'team-123', name: 'Test Team' });
      UserModel.findById.mockResolvedValueOnce({ id: 'test-user-id', username: 'testuser' });

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123/accept')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation accepted successfully');
    });

    it('should return 404 if invitation not found', async () => {
      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/invitations/invitations/non-existent/accept')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invitation not found');
    });

    it('should return 403 if user is not the invitee', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        invitee_id: 'other-user-id',
        status: 'pending'
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123/accept')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You can only accept invitations sent to you');
    });
  });

  describe('PUT /api/invitations/invitations/:invitationId/decline', () => {
    it('should decline invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        invitee_id: 'test-user-id',
        status: 'pending'
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      const { TeamModel } = require('../models/Team');
      const { UserModel } = require('../models/User');

      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);
      TeamInvitationModel.declineInvitation.mockResolvedValueOnce({ ...mockInvitation, status: 'declined' });
      TeamModel.findById.mockResolvedValueOnce({ id: 'team-123', name: 'Test Team' });
      UserModel.findById.mockResolvedValueOnce({ id: 'test-user-id', username: 'testuser' });

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123/decline')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation declined successfully');
    });
  });

  describe('PUT /api/invitations/invitations/:invitationId/cancel', () => {
    it('should cancel invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        inviter_id: 'test-user-id',
        status: 'pending'
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);
      TeamInvitationModel.cancelInvitation.mockResolvedValueOnce({ ...mockInvitation, status: 'cancelled' });

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123/cancel')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation cancelled successfully');
    });

    it('should return 403 if user is not the inviter', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        inviter_id: 'other-user-id',
        status: 'pending'
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123/cancel')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You can only cancel invitations you sent');
    });
  });

  describe('GET /api/invitations/teams/:teamId/invitations/stats', () => {
    it('should return invitation statistics successfully', async () => {
      const mockStats = {
        total: 10,
        pending: 3,
        accepted: 5,
        declined: 2,
        expired: 0,
        cancelled: 0
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.getTeamInvitationStats.mockResolvedValueOnce(mockStats);

      const response = await request(app).get('/api/invitations/teams/team-123/invitations/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(10);
      expect(response.body.data.pending).toBe(3);
    });
  });

  describe('POST /api/invitations/invitations/cleanup', () => {
    it('should cleanup expired invitations successfully', async () => {
      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.cleanupExpiredInvitations.mockResolvedValueOnce(5);

      const response = await request(app)
        .post('/api/invitations/invitations/cleanup')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Cleaned up 5 expired invitations');
      expect(response.body.data.cleaned_count).toBe(5);
    });
  });

  describe('PUT /api/invitations/invitations/:invitationId', () => {
    it('should update invitation successfully', async () => {
      const mockInvitation = {
        id: 'invitation-123',
        inviter_id: 'test-user-id',
        status: 'pending'
      };

      const { TeamInvitationModel } = require('../models/TeamInvitation');
      TeamInvitationModel.findById.mockResolvedValueOnce(mockInvitation);
      TeamInvitationModel.update.mockResolvedValueOnce({ ...mockInvitation, message: 'Updated message' });

      const response = await request(app)
        .put('/api/invitations/invitations/invitation-123')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          message: 'Updated message'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation updated successfully');
    });
  });
});
