import { Request, Response } from 'express';
import { TeamStatsModel } from '../models/TeamStats';
import { TeamAchievementModel } from '../models/TeamAchievement';
import { TeamModel } from '../models/Team';

export class TeamLeaderboardController {
  // Get team leaderboard by rating
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Validate pagination
      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const leaderboard = await TeamStatsModel.getLeaderboard(limit, offset);
      const totalCount = await TeamStatsModel.getTotalTeamCount();

      res.status(200).json({
        success: true,
        data: {
          leaderboard,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting team leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team leaderboard by win rate
  static async getLeaderboardByWinRate(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const leaderboard = await TeamStatsModel.getLeaderboardByWinRate(limit, offset);
      const totalCount = await TeamStatsModel.getTotalTeamCount();

      res.status(200).json({
        success: true,
        data: {
          leaderboard,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting win rate leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team leaderboard by total games
  static async getLeaderboardByGames(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const leaderboard = await TeamStatsModel.getLeaderboardByGames(limit, offset);
      const totalCount = await TeamStatsModel.getTotalTeamCount();

      res.status(200).json({
        success: true,
        data: {
          leaderboard,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting games leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team ranking
  static async getTeamRanking(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const ranking = await TeamStatsModel.getTeamRanking(teamId);
      if (!ranking) {
        res.status(404).json({
          success: false,
          message: 'Team not found in leaderboard'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: ranking
      });
    } catch (error) {
      console.error('Error getting team ranking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team performance summary
  static async getTeamPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const performance = await TeamStatsModel.getTeamPerformance(teamId);
      if (!performance) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error getting team performance:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get top performing teams
  static async getTopTeams(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      if (limit < 1 || limit > 50) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 50'
        });
        return;
      }

      const topTeams = await TeamStatsModel.getTopTeams(limit);

      res.status(200).json({
        success: true,
        data: {
          teams: topTeams,
          count: topTeams.length
        }
      });
    } catch (error) {
      console.error('Error getting top teams:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get most active teams
  static async getMostActiveTeams(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      if (limit < 1 || limit > 50) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 50'
        });
        return;
      }

      const activeTeams = await TeamStatsModel.getMostActiveTeams(limit);

      res.status(200).json({
        success: true,
        data: {
          teams: activeTeams,
          count: activeTeams.length
        }
      });
    } catch (error) {
      console.error('Error getting most active teams:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get teams by rating range
  static async getTeamsByRatingRange(req: Request, res: Response): Promise<void> {
    try {
      const minRating = parseInt(req.query.min_rating as string) || 0;
      const maxRating = parseInt(req.query.max_rating as string) || 2000;
      const limit = parseInt(req.query.limit as string) || 20;

      if (minRating < 0 || maxRating > 2000 || minRating > maxRating) {
        res.status(400).json({
          success: false,
          message: 'Invalid rating range. Min: 0-2000, Max: 0-2000, Min must be <= Max'
        });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const teams = await TeamStatsModel.getTeamsByRatingRange(minRating, maxRating, limit);

      res.status(200).json({
        success: true,
        data: {
          teams,
          count: teams.length,
          rating_range: {
            min: minRating,
            max: maxRating
          }
        }
      });
    } catch (error) {
      console.error('Error getting teams by rating range:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team achievements
  static async getTeamAchievements(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if team exists
      const team = await TeamModel.findById(teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      const achievements = await TeamAchievementModel.getTeamAchievements(teamId);
      const totalPoints = await TeamAchievementModel.getTeamAchievementPoints(teamId);

      res.status(200).json({
        success: true,
        data: {
          team_id: teamId,
          team_name: team.name,
          achievements,
          total_points: totalPoints,
          achievement_count: achievements.length
        }
      });
    } catch (error) {
      console.error('Error getting team achievements:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get achievement leaderboard
  static async getAchievementLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const leaderboard = await TeamAchievementModel.getAchievementLeaderboard(limit);

      res.status(200).json({
        success: true,
        data: {
          leaderboard,
          count: leaderboard.length
        }
      });
    } catch (error) {
      console.error('Error getting achievement leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get recent achievements
  static async getRecentAchievements(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const achievements = await TeamAchievementModel.getRecentAchievements(limit);

      res.status(200).json({
        success: true,
        data: {
          achievements,
          count: achievements.length
        }
      });
    } catch (error) {
      console.error('Error getting recent achievements:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get achievement statistics
  static async getAchievementStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await TeamAchievementModel.getAchievementStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting achievement stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update team stats (internal use)
  static async updateTeamStats(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { result } = req.body; // 'win', 'loss', or 'draw'

      if (!['win', 'loss', 'draw'].includes(result)) {
        res.status(400).json({
          success: false,
          message: 'Result must be win, loss, or draw'
        });
        return;
      }

      const updatedStats = await TeamStatsModel.addGameResult(teamId, result);
      if (!updatedStats) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Check and award achievements
      const newAchievements = await TeamAchievementModel.checkAndAwardAchievements(teamId, updatedStats);

      res.status(200).json({
        success: true,
        message: 'Team stats updated successfully',
        data: {
          stats: updatedStats,
          new_achievements: newAchievements
        }
      });
    } catch (error) {
      console.error('Error updating team stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Reset team stats (admin only)
  static async resetTeamStats(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const resetStats = await TeamStatsModel.resetTeamStats(teamId);
      if (!resetStats) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Team stats reset successfully',
        data: resetStats
      });
    } catch (error) {
      console.error('Error resetting team stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
