import { Router } from 'express';
import { TeamController } from '../controllers/teamController';
import { authenticateToken } from '../middleware/auth';
import { 
  validateTeamCreation, 
  validateTeamUpdate, 
  validatePagination, 
  validateSearch, 
  validateTeamId, 
  validateTeamName 
} from '../middleware/teamValidation';

const router = Router();

// Public routes (no authentication required)
router.get('/', validatePagination, TeamController.getAllTeams);
router.get('/search', validateSearch, TeamController.searchTeams);
router.get('/check-name', TeamController.checkTeamNameExists);
router.get('/name/:name', validateTeamName, TeamController.getTeamByName);
router.get('/:id/members', validateTeamId, TeamController.getTeamWithMemberCount);
router.get('/:id', validateTeamId, TeamController.getTeamById);

// Protected routes (authentication required)
router.post('/', authenticateToken, validateTeamCreation, TeamController.createTeam);
router.put('/:id', authenticateToken, validateTeamId, validateTeamUpdate, TeamController.updateTeam);
router.delete('/:id', authenticateToken, validateTeamId, TeamController.deleteTeam);

export default router;
