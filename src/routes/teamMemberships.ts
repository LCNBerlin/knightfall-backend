import { Router } from 'express';
import { TeamMembershipController } from '../controllers/teamMembershipController';
import { authenticateToken } from '../middleware/auth';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// Public routes (no authentication required)
router.get('/teams/:teamId/members', validateTeamId, TeamMembershipController.getTeamMembers);
router.get('/teams/:teamId/members/:userId/check', validateTeamId, TeamMembershipController.checkMembership);
router.get('/teams/:teamId/members/:userId/role', validateTeamId, TeamMembershipController.getUserRole);

// Protected routes (authentication required)
router.post('/teams/:teamId/join', authenticateToken, validateTeamId, TeamMembershipController.joinTeam);
router.delete('/teams/:teamId/leave', authenticateToken, validateTeamId, TeamMembershipController.leaveTeam);
router.get('/users/teams', authenticateToken, TeamMembershipController.getUserTeams);
router.put('/teams/:teamId/members/:userId/role', authenticateToken, validateTeamId, TeamMembershipController.updateMemberRole);
router.delete('/teams/:teamId/members/:userId', authenticateToken, validateTeamId, TeamMembershipController.removeMember);
router.post('/teams/:teamId/transfer-ownership', authenticateToken, validateTeamId, TeamMembershipController.transferOwnership);

export default router;

