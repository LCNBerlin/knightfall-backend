import request from 'supertest';
import app from '../app';
import { FriendshipModel, CreateFriendshipData } from '../models/Friendship';
import { TeamChatMessageModel, CreateTeamChatMessageData } from '../models/TeamChatMessage';
import { NotificationModel, CreateNotificationData } from '../models/Notification';

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

// Mock the TeamMembership model
jest.mock('../models/TeamMembership', () => ({
  TeamMembershipModel: {
    isMember: jest.fn().mockResolvedValue(true),
    getUserRole: jest.fn().mockResolvedValue('member')
  }
}));

import pool from '../config/database';
const mockQuery = (pool as any).query;

describe('Social Features API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Friend System', () => {
    describe('POST /api/social/friends/request', () => {
      it('should send friend request successfully', async () => {
        const friendData = {
          friendId: 'friend-123'
        };

        const mockFriendship = {
          id: 'friendship-123',
          user_id: 'test-user-id',
          friend_id: 'friend-123',
          status: 'pending',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        };

        // Mock User.findById for friend
        const { UserModel } = require('../models/User');
        UserModel.findById.mockResolvedValueOnce({
          id: 'friend-123',
          username: 'frienduser'
        });

        // Mock FriendshipModel.findByUsers (no existing friendship)
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // Mock FriendshipModel.sendFriendRequest
        mockQuery.mockResolvedValueOnce({ rows: [mockFriendship] });
        // Mock NotificationModel.createFriendRequestNotification
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notification-123' }] });

        const response = await request(app)
          .post('/api/social/friends/request')
          .send(friendData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Friend request sent successfully');
      });

      it('should return 400 for self-friend request', async () => {
        const friendData = {
          friendId: 'test-user-id'
        };

        const response = await request(app)
          .post('/api/social/friends/request')
          .send(friendData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Cannot send friend request to yourself');
      });

      it('should return 404 for non-existent friend', async () => {
        const friendData = {
          friendId: 'non-existent-friend'
        };

        const { UserModel } = require('../models/User');
        UserModel.findById.mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/api/social/friends/request')
          .send(friendData);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('User not found');
      });
    });

    describe('POST /api/social/friends/:friendshipId/accept', () => {
      it('should accept friend request successfully', async () => {
        const friendshipId = 'friendship-123';
        const mockFriendship = {
          id: friendshipId,
          user_id: 'sender-123',
          friend_id: 'test-user-id',
          status: 'pending',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        };

        const acceptedFriendship = {
          ...mockFriendship,
          status: 'accepted'
        };

        // Mock FriendshipModel.findById
        mockQuery.mockResolvedValueOnce({ rows: [mockFriendship] });
        // Mock FriendshipModel.acceptFriendRequest
        mockQuery.mockResolvedValueOnce({ rows: [acceptedFriendship] });
        // Mock UserModel.findById for sender
        const { UserModel } = require('../models/User');
        UserModel.findById.mockResolvedValueOnce({
          id: 'sender-123',
          username: 'senderuser'
        });
        // Mock NotificationModel.createFriendAcceptedNotification
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notification-123' }] });

        const response = await request(app)
          .post(`/api/social/friends/${friendshipId}/accept`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Friend request accepted successfully');
      });

      it('should return 404 for non-existent friendship', async () => {
        const friendshipId = 'non-existent-friendship';

        mockQuery.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post(`/api/social/friends/${friendshipId}/accept`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Friend request not found');
      });
    });

    describe('GET /api/social/friends', () => {
      it('should get user friends successfully', async () => {
        const mockFriends = [
          {
            id: 'friendship-1',
            user_id: 'test-user-id',
            friend_id: 'friend-1',
            status: 'accepted',
            created_at: new Date('2023-01-01'),
            updated_at: new Date('2023-01-01'),
            username: 'friend1',
            elo_rating: 1800,
            rank: 'King'
          }
        ];

        mockQuery.mockResolvedValueOnce({ rows: mockFriends });

        const response = await request(app)
          .get('/api/social/friends');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.friends).toHaveLength(1);
        expect(response.body.data.count).toBe(1);
      });
    });
  });

  describe('Team Chat', () => {
    describe('POST /api/social/teams/:teamId/chat', () => {
      it('should send team message successfully', async () => {
        const teamId = '123e4567-e89b-12d3-a456-426614174000';
        const messageData = {
          message: 'Hello team!',
          messageType: 'text'
        };

        const mockMessage = {
          id: 'message-123',
          team_id: teamId,
          user_id: 'test-user-id',
          message: 'Hello team!',
          messageType: 'text',
          created_at: new Date('2023-01-01')
        };

        // Mock TeamMembershipModel.isMember
        const { TeamMembershipModel } = require('../models/TeamMembership');
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);

        // Mock TeamChatMessageModel.sendMessage
        mockQuery.mockResolvedValueOnce({ rows: [mockMessage] });

        const response = await request(app)
          .post(`/api/social/teams/${teamId}/chat`)
          .send(messageData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Message sent successfully');
      });

      it('should return 403 for non-team member', async () => {
        const teamId = '123e4567-e89b-12d3-a456-426614174000';
        const messageData = {
          message: 'Hello team!',
          messageType: 'text'
        };

        const { TeamMembershipModel } = require('../models/TeamMembership');
        TeamMembershipModel.isMember.mockResolvedValueOnce(false);

        const response = await request(app)
          .post(`/api/social/teams/${teamId}/chat`)
          .send(messageData);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('You must be a member of this team to send messages');
      });
    });

    describe('GET /api/social/teams/:teamId/chat', () => {
      it('should get team messages successfully', async () => {
        const teamId = '123e4567-e89b-12d3-a456-426614174000';
        const mockMessages = [
          {
            id: 'message-1',
            team_id: teamId,
            user_id: 'user-1',
            message: 'Hello team!',
            messageType: 'text',
            created_at: new Date('2023-01-01'),
            username: 'user1',
            rank: 'King'
          }
        ];

        const { TeamMembershipModel } = require('../models/TeamMembership');
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);

        mockQuery.mockResolvedValueOnce({ rows: mockMessages });

        const response = await request(app)
          .get(`/api/social/teams/${teamId}/chat?page=1&limit=50`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.messages).toHaveLength(1);
      });
    });
  });

  describe('Notifications', () => {
    describe('GET /api/social/notifications', () => {
      it('should get user notifications successfully', async () => {
        const mockNotifications = [
          {
            id: 'notification-1',
            user_id: 'test-user-id',
            type: 'friend_request',
            title: 'New Friend Request',
            message: 'testuser sent you a friend request',
            data: { from_username: 'testuser' },
            is_read: false,
            created_at: new Date('2023-01-01'),
            read_at: null
          }
        ];

        const mockCounts = {
          total: 1,
          unread: 1
        };

        // Mock getUserNotifications
        mockQuery.mockResolvedValueOnce({ rows: mockNotifications });
        // Mock getNotificationCount
        mockQuery.mockResolvedValueOnce({ rows: [{ total: 1, unread: 1 }] });

        const response = await request(app)
          .get('/api/social/notifications?page=1&limit=20');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.notifications).toHaveLength(1);
        expect(response.body.data.counts.total).toBe(1);
        expect(response.body.data.counts.unread).toBe(1);
      });
    });

    describe('PUT /api/social/notifications/:notificationId/read', () => {
      it('should mark notification as read successfully', async () => {
        const notificationId = 'notification-123';

        // Mock the update query
        mockQuery.mockResolvedValueOnce({ rowCount: 1 });

        const response = await request(app)
          .put(`/api/social/notifications/${notificationId}/read`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Notification marked as read');
      });

      it('should return 404 for non-existent notification', async () => {
        const notificationId = 'non-existent-notification';

        mockQuery.mockResolvedValueOnce({ rowCount: 0 });

        const response = await request(app)
          .put(`/api/social/notifications/${notificationId}/read`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Notification not found');
      });
    });

    describe('PUT /api/social/notifications/read-all', () => {
      it('should mark all notifications as read successfully', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 5 });

        const response = await request(app)
          .put('/api/social/notifications/read-all');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('5 notifications marked as read');
      });
    });

    describe('DELETE /api/social/notifications/:notificationId', () => {
      it('should delete notification successfully', async () => {
        const notificationId = 'notification-123';

        // Mock the delete query
        mockQuery.mockResolvedValueOnce({ rowCount: 1 });

        const response = await request(app)
          .delete(`/api/social/notifications/${notificationId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Notification deleted successfully');
      });
    });
  });
});
