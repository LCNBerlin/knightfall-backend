import { Router } from 'express';
import { TeamLeaderboardController } from '../controllers/teamLeaderboardController';
import { authenticateToken } from '../middleware/auth';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// Public leaderboard routes (no authentication required)
router.get('/', TeamLeaderboardController.getLeaderboard);
router.get('/win-rate', TeamLeaderboardController.getLeaderboardByWinRate);
router.get('/games', TeamLeaderboardController.getLeaderboardByGames);
router.get('/top', TeamLeaderboardController.getTopTeams);
router.get('/active', TeamLeaderboardController.getMostActiveTeams);
router.get('/rating-range', TeamLeaderboardController.getTeamsByRatingRange);
router.get('/achievements', TeamLeaderboardController.getAchievementLeaderboard);
router.get('/achievements/recent', TeamLeaderboardController.getRecentAchievements);
router.get('/achievements/stats', TeamLeaderboardController.getAchievementStats);

// Team-specific routes (no authentication required for viewing)
router.get('/teams/:teamId/ranking', validateTeamId, TeamLeaderboardController.getTeamRanking);
router.get('/teams/:teamId/performance', validateTeamId, TeamLeaderboardController.getTeamPerformance);
router.get('/teams/:teamId/achievements', validateTeamId, TeamLeaderboardController.getTeamAchievements);

// Protected routes (authentication required)
router.post('/teams/:teamId/stats', authenticateToken, validateTeamId, TeamLeaderboardController.updateTeamStats);
router.delete('/teams/:teamId/stats', authenticateToken, validateTeamId, TeamLeaderboardController.resetTeamStats);

export default router;
