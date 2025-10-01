import { Request, Response } from 'express';
import { TournamentModel, CreateTournamentData, UpdateTournamentData } from '../models/Tournament';
import { TournamentParticipantModel, CreateTournamentParticipantData } from '../models/TournamentParticipant';
import { TournamentMatchModel, CreateTournamentMatchData } from '../models/TournamentMatch';
import { TeamModel } from '../models/Team';
import { TeamMembershipModel } from '../models/TeamMembership';
import { WebSocketService } from '../services/websocketService';

export class TournamentController {
  // === TOURNAMENT MANAGEMENT ===

  // Create tournament
  static async createTournament(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const tournamentData: CreateTournamentData = {
        name: req.body.name,
        description: req.body.description,
        tournament_type: req.body.tournament_type,
        max_teams: req.body.max_teams,
        entry_fee: req.body.entry_fee || 0,
        time_control: req.body.time_control,
        created_by: userId,
        start_date: new Date(req.body.start_date),
        registration_deadline: new Date(req.body.registration_deadline)
      };

      // Validate tournament data
      const validation = TournamentModel.validateTournamentData(tournamentData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      const tournament = await TournamentModel.create(tournamentData);

      res.status(201).json({
        success: true,
        message: 'Tournament created successfully',
        data: tournament
      });
    } catch (error) {
      console.error('Error creating tournament:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tournament by ID
  static async getTournament(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const tournament = await TournamentModel.findById(id);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
        return;
      }

      // Get tournament statistics
      const stats = await TournamentModel.getTournamentStats(id);

      res.status(200).json({
        success: true,
        data: {
          tournament,
          stats
        }
      });
    } catch (error) {
      console.error('Error getting tournament:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all tournaments
  static async getAllTournaments(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as any;
      const tournament_type = req.query.tournament_type as any;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const result = await TournamentModel.getAllTournaments(page, limit, status, tournament_type);

      res.status(200).json({
        success: true,
        data: {
          tournaments: result.tournaments,
          pagination: {
            page,
            limit,
            total: result.total,
            pages: Math.ceil(result.total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting tournaments:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get open tournaments
  static async getOpenTournaments(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const tournaments = await TournamentModel.getOpenTournaments(limit);

      res.status(200).json({
        success: true,
        data: {
          tournaments,
          count: tournaments.length
        }
      });
    } catch (error) {
      console.error('Error getting open tournaments:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update tournament
  static async updateTournament(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if user is the creator
      const tournament = await TournamentModel.findById(id);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
        return;
      }

      if (tournament.created_by !== userId) {
        res.status(403).json({
          success: false,
          message: 'Only the tournament creator can update the tournament'
        });
        return;
      }

      const updateData: UpdateTournamentData = req.body;

      // Validate update data
      const validation = TournamentModel.validateTournamentData(updateData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      const updatedTournament = await TournamentModel.update(id, updateData);
      if (!updatedTournament) {
        res.status(400).json({
          success: false,
          message: 'Failed to update tournament'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Tournament updated successfully',
        data: updatedTournament
      });
    } catch (error) {
      console.error('Error updating tournament:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Open tournament for registration
  static async openTournament(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if user is the creator
      const tournament = await TournamentModel.findById(id);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
        return;
      }

      if (tournament.created_by !== userId) {
        res.status(403).json({
          success: false,
          message: 'Only the tournament creator can open the tournament'
        });
        return;
      }

      const openedTournament = await TournamentModel.openTournament(id);
      if (!openedTournament) {
        res.status(400).json({
          success: false,
          message: 'Failed to open tournament'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Tournament opened for registration',
        data: openedTournament
      });
    } catch (error) {
      console.error('Error opening tournament:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Start tournament
  static async startTournament(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if user is the creator
      const tournament = await TournamentModel.findById(id);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: 'Tournament not found'
        });
        return;
      }

      if (tournament.created_by !== userId) {
        res.status(403).json({
          success: false,
          message: 'Only the tournament creator can start the tournament'
        });
        return;
      }

      // Check if tournament has enough participants
      if (tournament.current_teams < 2) {
        res.status(400).json({
          success: false,
          message: 'Tournament needs at least 2 teams to start'
        });
        return;
      }

      const startedTournament = await TournamentModel.startTournament(id);
      if (!startedTournament) {
        res.status(400).json({
          success: false,
          message: 'Failed to start tournament'
        });
        return;
      }

      // Activate all participants
      await TournamentParticipantModel.activateAllParticipants(id);

      // Generate first round matches based on tournament type
      if (startedTournament.tournament_type === 'elimination') {
        const participants = await TournamentParticipantModel.getTournamentParticipants(id);
        const participantData = participants.map((p, index) => ({
          teamId: p.team_id,
          seed: p.seed_position || index + 1
        }));
        
        await TournamentMatchModel.generateEliminationBracket(id, participantData);
      }

      res.status(200).json({
        success: true,
        message: 'Tournament started successfully',
        data: startedTournament
      });
    } catch (error) {
      console.error('Error starting tournament:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // === TEAM PARTICIPATION ===

  // Register team for tournament
  static async registerTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { teamId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if team exists
      const team = await TeamModel.findById(teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Check if user is member of team
      const isMember = await TeamMembershipModel.isMember(teamId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          message: 'You must be a member of this team to register for tournaments'
        });
        return;
      }

      // Check if team can register
      const canRegister = await TournamentModel.canTeamRegister(id, teamId);
      if (!canRegister.canRegister) {
        res.status(400).json({
          success: false,
          message: canRegister.reason
        });
        return;
      }

      // Register team
      const participantData: CreateTournamentParticipantData = {
        tournament_id: id,
        team_id: teamId
      };

      const participant = await TournamentParticipantModel.registerTeam(participantData);

      // Update tournament team count
      await TournamentModel.updateTeamCount(id, true);

      // Send notification to team members
      await WebSocketService.sendTeamUpdate(teamId, {
        type: 'tournament_registration',
        message: `Team registered for tournament: ${team.name}`,
        data: { tournament_id: id, tournament_name: team.name },
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        message: 'Team registered successfully',
        data: participant
      });
    } catch (error) {
      console.error('Error registering team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tournament participants
  static async getTournamentParticipants(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const participants = await TournamentParticipantModel.getTournamentParticipants(id);

      res.status(200).json({
        success: true,
        data: {
          participants,
          count: participants.length
        }
      });
    } catch (error) {
      console.error('Error getting tournament participants:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tournament standings
  static async getTournamentStandings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const standings = await TournamentParticipantModel.getTournamentStandings(id);

      res.status(200).json({
        success: true,
        data: {
          standings,
          count: standings.length
        }
      });
    } catch (error) {
      console.error('Error getting tournament standings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Withdraw team from tournament
  static async withdrawTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { teamId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check if team exists
      const team = await TeamModel.findById(teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Check if user is member of team
      const isMember = await TeamMembershipModel.isMember(teamId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          message: 'You must be a member of this team to withdraw from tournaments'
        });
        return;
      }

      // Check if team is registered
      const isRegistered = await TournamentParticipantModel.isTeamRegistered(id, teamId);
      if (!isRegistered) {
        res.status(400).json({
          success: false,
          message: 'Team is not registered for this tournament'
        });
        return;
      }

      // Withdraw team
      await TournamentParticipantModel.withdrawParticipant(id, teamId);

      // Update tournament team count
      await TournamentModel.updateTeamCount(id, false);

      res.status(200).json({
        success: true,
        message: 'Team withdrawn successfully'
      });
    } catch (error) {
      console.error('Error withdrawing team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // === MATCH MANAGEMENT ===

  // Get tournament matches
  static async getTournamentMatches(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const round = req.query.round ? parseInt(req.query.round as string) : undefined;

      let matches;
      if (round) {
        matches = await TournamentMatchModel.getMatchesByRound(id, round);
      } else {
        matches = await TournamentMatchModel.getMatchesByTournament(id);
      }

      res.status(200).json({
        success: true,
        data: {
          matches,
          count: matches.length
        }
      });
    } catch (error) {
      console.error('Error getting tournament matches:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tournament bracket
  static async getTournamentBracket(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const bracket = await TournamentMatchModel.getTournamentBracket(id);

      res.status(200).json({
        success: true,
        data: {
          bracket,
          rounds: bracket.length
        }
      });
    } catch (error) {
      console.error('Error getting tournament bracket:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get match by ID
  static async getMatch(req: Request, res: Response): Promise<void> {
    try {
      const { matchId } = req.params;

      const match = await TournamentMatchModel.findById(matchId);
      if (!match) {
        res.status(404).json({
          success: false,
          message: 'Match not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: match
      });
    } catch (error) {
      console.error('Error getting match:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Start match
  static async startMatch(req: Request, res: Response): Promise<void> {
    try {
      const { matchId } = req.params;
      const { gameId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const match = await TournamentMatchModel.findById(matchId);
      if (!match) {
        res.status(404).json({
          success: false,
          message: 'Match not found'
        });
        return;
      }

      if (match.status !== 'scheduled') {
        res.status(400).json({
          success: false,
          message: 'Match is not scheduled'
        });
        return;
      }

      const startedMatch = await TournamentMatchModel.startMatch(matchId, gameId);
      if (!startedMatch) {
        res.status(400).json({
          success: false,
          message: 'Failed to start match'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Match started successfully',
        data: startedMatch
      });
    } catch (error) {
      console.error('Error starting match:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Complete match
  static async completeMatch(req: Request, res: Response): Promise<void> {
    try {
      const { matchId } = req.params;
      const { team1Score, team2Score } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const match = await TournamentMatchModel.findById(matchId);
      if (!match) {
        res.status(404).json({
          success: false,
          message: 'Match not found'
        });
        return;
      }

      if (match.status !== 'in_progress') {
        res.status(400).json({
          success: false,
          message: 'Match is not in progress'
        });
        return;
      }

      const completedMatch = await TournamentMatchModel.completeMatch(matchId, team1Score, team2Score);
      if (!completedMatch) {
        res.status(400).json({
          success: false,
          message: 'Failed to complete match'
        });
        return;
      }

      // Update participant stats
      const winner = team1Score > team2Score ? 'team1' : team2Score > team1Score ? 'team2' : 'draw';
      
      if (winner === 'team1') {
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team1_id, 'win');
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team2_id, 'loss');
      } else if (winner === 'team2') {
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team1_id, 'loss');
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team2_id, 'win');
      } else {
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team1_id, 'draw');
        await TournamentParticipantModel.updateStats(match.tournament_id, match.team2_id, 'draw');
      }

      res.status(200).json({
        success: true,
        message: 'Match completed successfully',
        data: completedMatch
      });
    } catch (error) {
      console.error('Error completing match:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
