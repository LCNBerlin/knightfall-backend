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
jest.mock('../models/TeamPermission', () => ({
  TeamPermissionModel: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getTeamPermissions: jest.fn(),
    getPermissionsForRole: jest.fn(),
    hasPermission: jest.fn(),
    initializeDefaultPermissions: jest.fn(),
    getDefaultPermissions: jest.fn(),
    getRoleHierarchy: jest.fn(),
    canManageRole: jest.fn(),
    validatePermissionData: jest.fn(() => ({ isValid: true, errors: [] }))
  }
}));

jest.mock('../models/TeamMembership', () => ({
  TeamMembershipModel: {
    getUserRole: jest.fn(),
    isMember: jest.fn()
  }
}));

jest.mock('../models/Team', () => ({
  TeamModel: {
    findById: jest.fn()
  }
}));

describe('Team Permissions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/permissions/permissions/available', () => {
    it('should return available permissions and roles', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.getRoleHierarchy.mockReturnValueOnce(['owner', 'admin', 'moderator', 'member', 'guest']);

      const response = await request(app).get('/api/permissions/permissions/available');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toBeDefined();
      expect(response.body.data.roles).toBeDefined();
      expect(response.body.data.role_hierarchy).toEqual(['owner', 'admin', 'moderator', 'member', 'guest']);
    });
  });

  describe('GET /api/permissions/teams/:teamId/permissions', () => {
    it('should return team permissions successfully', async () => {
      const mockPermissions = [
        { id: 'perm-1', team_id: 'team-123', role: 'admin', permission: 'team.manage', granted: true },
        { id: 'perm-2', team_id: 'team-123', role: 'member', permission: 'team.chat', granted: true }
      ];

      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.getTeamPermissions.mockResolvedValueOnce(mockPermissions);

      const response = await request(app).get('/api/permissions/teams/team-123/permissions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.permissions).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });
  });

  describe('GET /api/permissions/teams/:teamId/roles/:role/permissions', () => {
    it('should return role permissions successfully', async () => {
      const mockPermissions = [
        { id: 'perm-1', team_id: 'team-123', role: 'admin', permission: 'team.manage', granted: true },
        { id: 'perm-2', team_id: 'team-123', role: 'admin', permission: 'team.invite', granted: true }
      ];

      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.getPermissionsForRole.mockResolvedValueOnce(mockPermissions);

      const response = await request(app).get('/api/permissions/teams/team-123/roles/admin/permissions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
      expect(response.body.data.permissions).toHaveLength(2);
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app).get('/api/permissions/teams/team-123/roles/invalid/permissions');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid role');
    });
  });

  describe('POST /api/permissions/teams/:teamId/permissions', () => {
    it('should create permission successfully', async () => {
      const mockPermission = {
        id: 'perm-123',
        team_id: 'team-123',
        role: 'admin',
        permission: 'team.manage',
        granted: true,
        granted_by: 'test-user-id'
      };

      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.create.mockResolvedValueOnce(mockPermission);

      const response = await request(app)
        .post('/api/permissions/teams/team-123/permissions')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          role: 'admin',
          permission: 'team.manage',
          granted: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Permission created successfully');
      expect(response.body.data.id).toBe('perm-123');
    });

    it('should return 400 for validation error', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.validatePermissionData.mockReturnValueOnce({
        isValid: false,
        errors: ['Invalid role']
      });

      const response = await request(app)
        .post('/api/permissions/teams/team-123/permissions')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          role: 'invalid',
          permission: 'team.manage',
          granted: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toContain('Invalid role');
    });
  });

  describe('PUT /api/permissions/permissions/:permissionId', () => {
    it('should update permission successfully', async () => {
      const mockPermission = {
        id: 'perm-123',
        team_id: 'team-123',
        role: 'admin',
        permission: 'team.manage',
        granted: false,
        granted_by: 'test-user-id'
      };

      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.update.mockResolvedValueOnce(mockPermission);

      const response = await request(app)
        .put('/api/permissions/permissions/perm-123')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          granted: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Permission updated successfully');
      expect(response.body.data.granted).toBe(false);
    });

    it('should return 404 for non-existent permission', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.update.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/permissions/permissions/non-existent')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          granted: false
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission not found');
    });
  });

  describe('DELETE /api/permissions/permissions/:permissionId', () => {
    it('should delete permission successfully', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.delete.mockResolvedValueOnce(true);

      const response = await request(app)
        .delete('/api/permissions/permissions/perm-123')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Permission deleted successfully');
    });

    it('should return 404 for non-existent permission', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.delete.mockResolvedValueOnce(false);

      const response = await request(app)
        .delete('/api/permissions/permissions/non-existent')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission not found');
    });
  });

  describe('GET /api/permissions/teams/:teamId/check/:role/:permission', () => {
    it('should check permission successfully', async () => {
      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.hasPermission.mockResolvedValueOnce(true);

      const response = await request(app).get('/api/permissions/teams/team-123/check/admin/team.manage');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.has_permission).toBe(true);
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app).get('/api/permissions/teams/team-123/check/invalid/team.manage');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid role');
    });
  });

  describe('POST /api/permissions/teams/:teamId/permissions/initialize', () => {
    it('should initialize default permissions successfully', async () => {
      const mockTeam = { id: 'team-123', name: 'Test Team' };

      const { TeamModel } = require('../models/Team');
      const { TeamPermissionModel } = require('../models/TeamPermission');
      
      TeamModel.findById.mockResolvedValueOnce(mockTeam);
      TeamPermissionModel.initializeDefaultPermissions.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/permissions/teams/team-123/permissions/initialize')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Default permissions initialized successfully');
    });

    it('should return 404 for non-existent team', async () => {
      const { TeamModel } = require('../models/Team');
      TeamModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/permissions/teams/non-existent/permissions/initialize')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Team not found');
    });
  });

  describe('GET /api/permissions/teams/:teamId/users/:userId/permissions', () => {
    it('should return user permissions successfully', async () => {
      const mockPermissions = [
        { id: 'perm-1', team_id: 'team-123', role: 'admin', permission: 'team.manage', granted: true },
        { id: 'perm-2', team_id: 'team-123', role: 'admin', permission: 'team.invite', granted: true }
      ];

      const { TeamMembershipModel } = require('../models/TeamMembership');
      const { TeamPermissionModel } = require('../models/TeamPermission');
      
      TeamMembershipModel.getUserRole.mockResolvedValueOnce('admin');
      TeamPermissionModel.getPermissionsForRole.mockResolvedValueOnce(mockPermissions);

      const response = await request(app)
        .get('/api/permissions/teams/team-123/users/user-123/permissions')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
      expect(response.body.data.permissions).toHaveLength(2);
    });

    it('should return 404 for non-member user', async () => {
      const { TeamMembershipModel } = require('../models/TeamMembership');
      TeamMembershipModel.getUserRole.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/permissions/teams/team-123/users/non-member/permissions')
        .set('Authorization', 'Bearer dummy_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not a member of this team');
    });
  });

  describe('PUT /api/permissions/teams/:teamId/roles/:role/permissions', () => {
    it('should update role permissions successfully', async () => {
      const mockPermissions = [
        { id: 'perm-1', team_id: 'team-123', role: 'admin', permission: 'team.manage', granted: true },
        { id: 'perm-2', team_id: 'team-123', role: 'admin', permission: 'team.invite', granted: false }
      ];

      const { TeamPermissionModel } = require('../models/TeamPermission');
      TeamPermissionModel.getPermissionsForRole.mockResolvedValueOnce(mockPermissions);
      TeamPermissionModel.update.mockResolvedValueOnce(mockPermissions[0]);
      TeamPermissionModel.create.mockResolvedValueOnce(mockPermissions[1]);
      
      // Mock the second call to update for the second permission
      TeamPermissionModel.update.mockResolvedValueOnce(mockPermissions[1]);

      const response = await request(app)
        .put('/api/permissions/teams/team-123/roles/admin/permissions')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          permissions: [
            { permission: 'team.manage', granted: true },
            { permission: 'team.invite', granted: false }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Role permissions updated successfully');
      expect(response.body.data.permissions).toHaveLength(2);
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .put('/api/permissions/teams/team-123/roles/invalid/permissions')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          permissions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid role');
    });

    it('should return 400 for invalid permissions array', async () => {
      const response = await request(app)
        .put('/api/permissions/teams/team-123/roles/admin/permissions')
        .set('Authorization', 'Bearer dummy_token')
        .send({
          permissions: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permissions must be an array');
    });
  });
});
