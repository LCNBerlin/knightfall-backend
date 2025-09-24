import express from 'express';
import { EconomyService } from '../services/EconomyService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get user's economy stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const stats = await EconomyService.getUserEconomyStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting economy stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get economy stats' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await EconomyService.getLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

// Get user's transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const transactions = await EconomyService.getTokenHistory(userId, limit);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({ success: false, error: 'Failed to get transaction history' });
  }
});

// Add bonus tokens (admin only - for now, anyone can use it for testing)
router.post('/bonus', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    await EconomyService.addBonusTokens(
      userId, 
      amount, 
      description || `Bonus of ${amount} tokens`
    );

    res.json({ success: true, message: 'Bonus tokens added successfully' });
  } catch (error) {
    console.error('Error adding bonus tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to add bonus tokens' });
  }
});

export default router;
