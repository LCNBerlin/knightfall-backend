import { Router } from 'express';
import { TournamentController } from '../controllers/tournamentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// === TOURNAMENT MANAGEMENT ROUTES ===

// Public routes (no authentication required)
router.get('/', TournamentController.getAllTournaments);
router.get('/open', TournamentController.getOpenTournaments);
router.get('/:id', TournamentController.getTournament);
router.get('/:id/participants', TournamentController.getTournamentParticipants);
router.get('/:id/standings', TournamentController.getTournamentStandings);
router.get('/:id/matches', TournamentController.getTournamentMatches);
router.get('/:id/bracket', TournamentController.getTournamentBracket);
router.get('/matches/:matchId', TournamentController.getMatch);

// Protected routes (authentication required)
router.post('/', authenticateToken, TournamentController.createTournament);
router.put('/:id', authenticateToken, TournamentController.updateTournament);
router.post('/:id/open', authenticateToken, TournamentController.openTournament);
router.post('/:id/start', authenticateToken, TournamentController.startTournament);
router.post('/:id/register', authenticateToken, TournamentController.registerTeam);
router.post('/:id/withdraw', authenticateToken, TournamentController.withdrawTeam);
router.post('/matches/:matchId/start', authenticateToken, TournamentController.startMatch);
router.post('/matches/:matchId/complete', authenticateToken, TournamentController.completeMatch);

export default router;
