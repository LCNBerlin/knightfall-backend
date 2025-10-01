import { Router } from 'express';
import { UserModel } from '../models/User';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }

    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    const { password_hash, ...userData } = user;
    res.json({
      success: true,
      data: { user: userData }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get profile' }
    });
  }
});

// @route   GET /api/users/leaderboard
// @desc    Get leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await UserModel.getLeaderboard(limit);
    
    res.json({
      success: true,
      data: { leaderboard }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get leaderboard' }
    });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get user statistics
// @access  Public
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await UserModel.getStats(id);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get user statistics' }
    });
  }
});

export default router;