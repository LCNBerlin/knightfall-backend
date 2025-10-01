import { Router } from 'express';
import { SocialController } from '../controllers/socialController';
import { authenticateToken } from '../middleware/auth';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// === FRIEND SYSTEM ROUTES ===
// All friend routes require authentication
router.post('/friends/request', authenticateToken, SocialController.sendFriendRequest);
router.post('/friends/:friendshipId/accept', authenticateToken, SocialController.acceptFriendRequest);
router.post('/friends/:friendshipId/decline', authenticateToken, SocialController.declineFriendRequest);
router.get('/friends', authenticateToken, SocialController.getFriends);
router.get('/friends/requests', authenticateToken, SocialController.getPendingRequests);
router.delete('/friends/:friendId', authenticateToken, SocialController.removeFriend);

// === TEAM CHAT ROUTES ===
// Send message requires authentication and team membership
router.post('/teams/:teamId/chat', authenticateToken, validateTeamId, SocialController.sendTeamMessage);
// Get messages requires team membership (but can be public for team members)
router.get('/teams/:teamId/chat', validateTeamId, SocialController.getTeamMessages);

// === NOTIFICATION ROUTES ===
// All notification routes require authentication
router.get('/notifications', authenticateToken, SocialController.getNotifications);
router.get('/notifications/unread', authenticateToken, SocialController.getUnreadNotifications);
router.put('/notifications/:notificationId/read', authenticateToken, SocialController.markNotificationAsRead);
router.put('/notifications/read-all', authenticateToken, SocialController.markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', authenticateToken, SocialController.deleteNotification);

export default router;
