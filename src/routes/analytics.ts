import { Router } from 'express';
import { TeamAnalyticsController } from '../controllers/teamAnalyticsController';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// Team analytics
router.get('/teams/:teamId/summary', validateTeamId, TeamAnalyticsController.getTeamSummary);
router.get('/teams/:teamId/trends', validateTeamId, TeamAnalyticsController.getTeamTrends);
router.get('/teams/:teamId/export', validateTeamId, TeamAnalyticsController.exportTeamAnalytics);

// Leaderboards
router.get('/leaderboards/activity', TeamAnalyticsController.getActivityLeaderboard);
router.get('/leaderboards/achievements', TeamAnalyticsController.getAchievementsLeaderboard);

export default router;
