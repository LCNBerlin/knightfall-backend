import { Request, Response } from 'express';
import pool from '../config/database';

export class TeamAnalyticsController {
  // GET /api/analytics/teams/:teamId/summary
  static async getTeamSummary(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      const queries = {
        stats: `SELECT total_games, wins, losses, draws, team_rating, updated_at FROM team_stats WHERE team_id = $1`,
        members: `SELECT COUNT(*)::int as count FROM team_memberships WHERE team_id = $1`,
        achievements: `SELECT COUNT(*)::int as count FROM team_achievements WHERE team_id = $1`,
        recentMatches: `SELECT tm.id, tm.round, tm.match_number, tm.team1_id, tm.team2_id, tm.team1_score, tm.team2_score, tm.status, tm.completed_at
                        FROM tournament_matches tm
                        WHERE (tm.team1_id = $1 OR tm.team2_id = $1)
                        ORDER BY tm.completed_at DESC NULLS LAST
                        LIMIT 10`,
        recentMessages: `SELECT COUNT(*)::int as count
                         FROM team_chat_messages
                         WHERE team_id = $1 AND created_at > NOW() - INTERVAL '7 days'`
      };

      const [statsRes, membersRes, achievementsRes, recentMatchesRes, recentMessagesRes] = await Promise.all([
        pool.query(queries.stats, [teamId]),
        pool.query(queries.members, [teamId]),
        pool.query(queries.achievements, [teamId]),
        pool.query(queries.recentMatches, [teamId]),
        pool.query(queries.recentMessages, [teamId])
      ]);

      res.status(200).json({
        success: true,
        data: {
          stats: statsRes.rows[0] || null,
          members: membersRes.rows[0]?.count ?? 0,
          achievements: achievementsRes.rows[0]?.count ?? 0,
          recent_matches: recentMatchesRes.rows,
          recent_messages_7d: recentMessagesRes.rows[0]?.count ?? 0,
        }
      });
    } catch (error) {
      console.error('Error fetching team summary:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // GET /api/analytics/teams/:teamId/trends?window=30
  static async getTeamTrends(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const windowDays = Math.min(Math.max(parseInt(String(req.query.window || '30')), 1), 180);

      const queries = {
        ratingTrend: `SELECT date_trunc('day', updated_at) as day, MAX(team_rating) as team_rating
                      FROM team_stats_history
                      WHERE team_id = $1 AND updated_at > NOW() - ($2 || ' days')::interval
                      GROUP BY day ORDER BY day ASC`,
        activityTrend: `SELECT date_trunc('day', created_at) as day, COUNT(*)::int as messages
                        FROM team_chat_messages
                        WHERE team_id = $1 AND created_at > NOW() - ($2 || ' days')::interval
                        GROUP BY day ORDER BY day ASC`,
        matchTrend: `SELECT date_trunc('day', completed_at) as day, COUNT(*)::int as matches
                     FROM tournament_matches
                     WHERE (team1_id = $1 OR team2_id = $1) AND completed_at IS NOT NULL AND completed_at > NOW() - ($2 || ' days')::interval
                     GROUP BY day ORDER BY day ASC`
      };

      // Some installs may not have team_stats_history; tolerate missing table
      let ratingTrendRows: any[] = [];
      try {
        const ratingRes = await pool.query(queries.ratingTrend, [teamId, windowDays]);
        ratingTrendRows = ratingRes.rows;
      } catch (_) {
        ratingTrendRows = [];
      }

      const [activityRes, matchRes] = await Promise.all([
        pool.query(queries.activityTrend, [teamId, windowDays]),
        pool.query(queries.matchTrend, [teamId, windowDays])
      ]);

      res.status(200).json({
        success: true,
        data: {
          window_days: windowDays,
          rating_trend: ratingTrendRows,
          activity_trend: activityRes.rows,
          match_trend: matchRes.rows,
        }
      });
    } catch (error) {
      console.error('Error fetching team trends:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // GET /api/analytics/leaderboards/activity?limit=20
  static async getActivityLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20')), 1), 100);
      const query = `SELECT t.id as team_id, t.name as team_name, COUNT(m.id)::int as messages_7d
                     FROM teams t
                     LEFT JOIN team_chat_messages m ON m.team_id = t.id AND m.created_at > NOW() - INTERVAL '7 days'
                     GROUP BY t.id
                     ORDER BY messages_7d DESC, t.name ASC
                     LIMIT $1`;
      const result = await pool.query(query, [limit]);
      res.status(200).json({ success: true, data: { leaderboard: result.rows } });
    } catch (error) {
      console.error('Error fetching activity leaderboard:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // GET /api/analytics/leaderboards/achievements?limit=20
  static async getAchievementsLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20')), 1), 100);
      const query = `SELECT t.id as team_id, t.name as team_name, COUNT(a.id)::int as achievements
                     FROM teams t
                     LEFT JOIN team_achievements a ON a.team_id = t.id
                     GROUP BY t.id
                     ORDER BY achievements DESC, t.name ASC
                     LIMIT $1`;
      const result = await pool.query(query, [limit]);
      res.status(200).json({ success: true, data: { leaderboard: result.rows } });
    } catch (error) {
      console.error('Error fetching achievements leaderboard:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // GET /api/analytics/teams/:teamId/export?format=json
  static async exportTeamAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const format = String(req.query.format || 'json').toLowerCase();

      const [summaryRes, trendsActivityRes] = await Promise.all([
        pool.query(`SELECT ts.*, (
                      SELECT COUNT(*) FROM team_memberships tm WHERE tm.team_id = ts.team_id
                    )::int as members,
                    (
                      SELECT COUNT(*) FROM team_achievements ta WHERE ta.team_id = ts.team_id
                    )::int as achievements
                    FROM team_stats ts WHERE team_id = $1`, [teamId]),
        pool.query(`SELECT date_trunc('day', created_at) as day, COUNT(*)::int as messages
                    FROM team_chat_messages WHERE team_id = $1
                    GROUP BY day ORDER BY day ASC`, [teamId])
      ]);

      const payload = {
        team_id: teamId,
        summary: summaryRes.rows[0] || null,
        activity_trend: trendsActivityRes.rows,
        exported_at: new Date().toISOString()
      };

      if (format === 'json') {
        res.status(200).json({ success: true, data: payload });
        return;
      }

      // Fallback: CSV for activity_trend only
      if (format === 'csv') {
        const header = 'day,messages\n';
        const rows = trendsActivityRes.rows.map(r => `${new Date(r.day).toISOString().slice(0,10)},${r.messages}`).join('\n');
        const csv = header + rows + (rows ? '\n' : '');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=team_${teamId}_activity.csv`);
        res.status(200).send(csv);
        return;
      }

      res.status(400).json({ success: false, message: 'Unsupported export format' });
    } catch (error) {
      console.error('Error exporting team analytics:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
