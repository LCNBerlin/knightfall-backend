import { Router } from 'express';
import { TeamInvitationController } from '../controllers/teamInvitationController';
import { authenticateToken } from '../middleware/auth';
import { TeamPermissionMiddleware } from '../middleware/teamPermissions';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// Public routes (no authentication required)
router.get('/teams/:teamId/invitations', validateTeamId, TeamInvitationController.getTeamInvitations);
router.get('/teams/:teamId/invitations/stats', validateTeamId, TeamInvitationController.getInvitationStats);

// Protected routes (authentication required)
router.post('/teams/:teamId/invitations', 
  authenticateToken, 
  validateTeamId, 
  TeamPermissionMiddleware.requirePermission('team.invite'),
  TeamInvitationController.sendInvitation
);

router.get('/users/:userId/invitations', 
  authenticateToken, 
  TeamInvitationController.getUserInvitations
);

router.get('/invitations/pending', 
  authenticateToken, 
  TeamInvitationController.getPendingInvitations
);

router.put('/invitations/:invitationId/accept', 
  authenticateToken, 
  TeamInvitationController.acceptInvitation
);

router.put('/invitations/:invitationId/decline', 
  authenticateToken, 
  TeamInvitationController.declineInvitation
);

router.put('/invitations/:invitationId/cancel', 
  authenticateToken, 
  TeamInvitationController.cancelInvitation
);

router.put('/invitations/:invitationId', 
  authenticateToken, 
  TeamInvitationController.updateInvitation
);

router.post('/invitations/cleanup', 
  authenticateToken, 
  TeamInvitationController.cleanupExpiredInvitations
);

export default router;
