import request from 'supertest';
import app from '../app';
import pool from '../config/database';

// Mock the database pool for testing
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  },
}));

const mockQuery = (pool as any).query;

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id', username: 'testuser' };
    next();
  }),
}));

// Mock models
jest.mock('../models/Tournament', () => ({
  TournamentModel: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    getAllTournaments: jest.fn(),
    getOpenTournaments: jest.fn(),
    openTournament: jest.fn(),
    startTournament: jest.fn(),
    canTeamRegister: jest.fn(),
    updateTeamCount: jest.fn(),
    getTournamentStats: jest.fn(),
    validateTournamentData: jest.fn(() => ({ isValid: true, errors: [] }))
  }
}));

jest.mock('../models/TournamentParticipant', () => ({
  TournamentParticipantModel: {
    registerTeam: jest.fn(),
    getTournamentParticipants: jest.fn(),
    getTournamentStandings: jest.fn(),
    withdrawParticipant: jest.fn(),
    isTeamRegistered: jest.fn(),
    activateAllParticipants: jest.fn(),
    updateStats: jest.fn()
  }
}));

jest.mock('../models/TournamentMatch', () => ({
  TournamentMatchModel: {
    getMatchesByTournament: jest.fn(),
    getMatchesByRound: jest.fn(),
    getTournamentBracket: jest.fn(),
    findById: jest.fn(),
    startMatch: jest.fn(),
    completeMatch: jest.fn(),
    generateEliminationBracket: jest.fn()
  }
}));

jest.mock('../models/Team', () => ({
  TeamModel: {
    findById: jest.fn()
  }
}));

jest.mock('../models/TeamMembership', () => ({
  TeamMembershipModel: {
    isMember: jest.fn()
  }
}));

jest.mock('../services/websocketService', () => ({
  WebSocketService: {
    sendTeamUpdate: jest.fn()
  }
}));

describe('Tournament API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tournament Management', () => {
    describe('POST /api/tournaments', () => {
      it('should create tournament successfully', async () => {
        const tournamentData = {
          name: 'Test Tournament',
          description: 'A test tournament for teams',
          tournament_type: 'elimination',
          max_teams: 16,
          entry_fee: 100,
          time_control: '10+0',
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          registration_deadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString()
        };

        const mockTournament = {
          id: 'tournament-123',
          name: tournamentData.name,
          description: tournamentData.description,
          tournament_type: tournamentData.tournament_type,
          status: 'draft',
          max_teams: tournamentData.max_teams,
          current_teams: 0,
          entry_fee: tournamentData.entry_fee,
          prize_pool: tournamentData.entry_fee * tournamentData.max_teams,
          time_control: tournamentData.time_control,
          created_by: 'test-user-id',
          start_date: new Date(tournamentData.start_date),
          registration_deadline: new Date(tournamentData.registration_deadline),
          created_at: new Date(),
          updated_at: new Date()
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.create.mockResolvedValueOnce(mockTournament);

        const response = await request(app)
          .post('/api/tournaments')
          .set('Authorization', 'Bearer dummy_token')
          .send(tournamentData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Tournament created successfully');
        expect(response.body.data.id).toBe('tournament-123');
        expect(TournamentModel.create).toHaveBeenCalledWith({
          name: tournamentData.name,
          description: tournamentData.description,
          tournament_type: tournamentData.tournament_type,
          max_teams: tournamentData.max_teams,
          entry_fee: tournamentData.entry_fee,
          time_control: tournamentData.time_control,
          created_by: 'test-user-id',
          start_date: expect.any(Date),
          registration_deadline: expect.any(Date)
        });
      });

      it('should return 400 for invalid tournament data', async () => {
        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.validateTournamentData.mockReturnValueOnce({
          isValid: false,
          errors: ['Tournament name must be at least 3 characters long']
        });

        const response = await request(app)
          .post('/api/tournaments')
          .set('Authorization', 'Bearer dummy_token')
          .send({
            name: 'A', // Too short
            description: 'Test',
            tournament_type: 'elimination',
            max_teams: 16
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Validation failed');
        expect(response.body.errors).toContain('Tournament name must be at least 3 characters long');
      });

      // Note: Authentication test is covered by other tests
    });

    describe('GET /api/tournaments', () => {
      it('should get all tournaments successfully', async () => {
        const mockTournaments = [
          {
            id: 'tournament-1',
            name: 'Tournament 1',
            status: 'open',
            tournament_type: 'elimination'
          },
          {
            id: 'tournament-2',
            name: 'Tournament 2',
            status: 'completed',
            tournament_type: 'swiss'
          }
        ];

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.getAllTournaments.mockResolvedValueOnce({
          tournaments: mockTournaments,
          total: 2
        });

        const response = await request(app)
          .get('/api/tournaments?page=1&limit=20');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tournaments).toHaveLength(2);
        expect(response.body.data.pagination.total).toBe(2);
      });

      it('should return 400 for invalid limit', async () => {
        const response = await request(app)
          .get('/api/tournaments?limit=150');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Limit must be between 1 and 100');
      });
    });

    describe('GET /api/tournaments/open', () => {
      it('should get open tournaments successfully', async () => {
        const mockOpenTournaments = [
          {
            id: 'tournament-1',
            name: 'Open Tournament 1',
            status: 'open',
            tournament_type: 'elimination'
          }
        ];

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.getOpenTournaments.mockResolvedValueOnce(mockOpenTournaments);

        const response = await request(app)
          .get('/api/tournaments/open?limit=20');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tournaments).toHaveLength(1);
        expect(response.body.data.count).toBe(1);
      });
    });

    describe('GET /api/tournaments/:id', () => {
      it('should get tournament by ID successfully', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Test Tournament',
          status: 'open',
          tournament_type: 'elimination'
        };

        const mockStats = {
          total_participants: 8,
          total_matches: 7,
          completed_matches: 3,
          prize_distribution: []
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(mockTournament);
        TournamentModel.getTournamentStats.mockResolvedValueOnce(mockStats);

        const response = await request(app)
          .get('/api/tournaments/tournament-123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tournament.id).toBe('tournament-123');
        expect(response.body.data.stats.total_participants).toBe(8);
      });

      it('should return 404 for non-existent tournament', async () => {
        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(null);

        const response = await request(app)
          .get('/api/tournaments/non-existent');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Tournament not found');
      });
    });

    describe('PUT /api/tournaments/:id', () => {
      it('should update tournament successfully', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Updated Tournament',
          created_by: 'test-user-id'
        };

        const updatedTournament = {
          ...mockTournament,
          name: 'Updated Tournament Name'
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(mockTournament);
        TournamentModel.update.mockResolvedValueOnce(updatedTournament);

        const response = await request(app)
          .put('/api/tournaments/tournament-123')
          .set('Authorization', 'Bearer dummy_token')
          .send({ name: 'Updated Tournament Name' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Tournament updated successfully');
        expect(response.body.data.name).toBe('Updated Tournament Name');
      });

      it('should return 403 for non-creator', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Test Tournament',
          created_by: 'other-user-id'
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(mockTournament);

        const response = await request(app)
          .put('/api/tournaments/tournament-123')
          .set('Authorization', 'Bearer dummy_token')
          .send({ name: 'Updated Tournament Name' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Only the tournament creator can update the tournament');
      });
    });

    describe('POST /api/tournaments/:id/open', () => {
      it('should open tournament successfully', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Test Tournament',
          created_by: 'test-user-id',
          status: 'draft'
        };

        const openedTournament = {
          ...mockTournament,
          status: 'open'
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(mockTournament);
        TournamentModel.openTournament.mockResolvedValueOnce(openedTournament);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/open')
          .set('Authorization', 'Bearer dummy_token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Tournament opened for registration');
        expect(response.body.data.status).toBe('open');
      });
    });

    describe('POST /api/tournaments/:id/start', () => {
      it('should start tournament successfully', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Test Tournament',
          created_by: 'test-user-id',
          status: 'open',
          current_teams: 8,
          tournament_type: 'elimination'
        };

        const startedTournament = {
          ...mockTournament,
          status: 'in_progress'
        };

        const mockParticipants = [
          { team_id: 'team-1', seed_position: 1 },
          { team_id: 'team-2', seed_position: 2 }
        ];

        const { TournamentModel } = require('../models/Tournament');
        const { TournamentParticipantModel } = require('../models/TournamentParticipant');
        const { TournamentMatchModel } = require('../models/TournamentMatch');

        TournamentModel.findById.mockResolvedValueOnce(mockTournament);
        TournamentModel.startTournament.mockResolvedValueOnce(startedTournament);
        TournamentParticipantModel.getTournamentParticipants.mockResolvedValueOnce(mockParticipants);
        TournamentParticipantModel.activateAllParticipants.mockResolvedValueOnce(undefined);
        TournamentMatchModel.generateEliminationBracket.mockResolvedValueOnce([]);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/start')
          .set('Authorization', 'Bearer dummy_token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Tournament started successfully');
        expect(response.body.data.status).toBe('in_progress');
      });

      it('should return 400 for insufficient teams', async () => {
        const mockTournament = {
          id: 'tournament-123',
          name: 'Test Tournament',
          created_by: 'test-user-id',
          status: 'open',
          current_teams: 1,
          tournament_type: 'elimination'
        };

        const { TournamentModel } = require('../models/Tournament');
        TournamentModel.findById.mockResolvedValueOnce(mockTournament);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/start')
          .set('Authorization', 'Bearer dummy_token');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Tournament needs at least 2 teams to start');
      });
    });
  });

  describe('Team Participation', () => {
    describe('POST /api/tournaments/:id/register', () => {
      it('should register team successfully', async () => {
        const mockTeam = {
          id: 'team-123',
          name: 'Test Team'
        };

        const mockParticipant = {
          id: 'participant-123',
          tournament_id: 'tournament-123',
          team_id: 'team-123',
          status: 'registered'
        };

        const { TournamentModel } = require('../models/Tournament');
        const { TeamModel } = require('../models/Team');
        const { TeamMembershipModel } = require('../models/TeamMembership');
        const { TournamentParticipantModel } = require('../models/TournamentParticipant');

        TournamentModel.canTeamRegister.mockResolvedValueOnce({ canRegister: true });
        TeamModel.findById.mockResolvedValueOnce(mockTeam);
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);
        TournamentParticipantModel.registerTeam.mockResolvedValueOnce(mockParticipant);
        TournamentModel.updateTeamCount.mockResolvedValueOnce(undefined);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/register')
          .set('Authorization', 'Bearer dummy_token')
          .send({ teamId: 'team-123' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Team registered successfully');
        expect(response.body.data.id).toBe('participant-123');
      });

      it('should return 400 for team already registered', async () => {
        const mockTeam = {
          id: 'team-123',
          name: 'Test Team'
        };

        const { TournamentModel } = require('../models/Tournament');
        const { TeamModel } = require('../models/Team');
        const { TeamMembershipModel } = require('../models/TeamMembership');

        TeamModel.findById.mockResolvedValueOnce(mockTeam);
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);
        TournamentModel.canTeamRegister.mockResolvedValueOnce({
          canRegister: false,
          reason: 'Team is already registered'
        });

        const response = await request(app)
          .post('/api/tournaments/tournament-123/register')
          .set('Authorization', 'Bearer dummy_token')
          .send({ teamId: 'team-123' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Team is already registered');
      });

      it('should return 403 for non-team member', async () => {
        const mockTeam = {
          id: 'team-123',
          name: 'Test Team'
        };

        const { TeamModel } = require('../models/Team');
        const { TeamMembershipModel } = require('../models/TeamMembership');

        TeamModel.findById.mockResolvedValueOnce(mockTeam);
        TeamMembershipModel.isMember.mockResolvedValueOnce(false);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/register')
          .set('Authorization', 'Bearer dummy_token')
          .send({ teamId: 'team-123' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('You must be a member of this team to register for tournaments');
      });
    });

    describe('GET /api/tournaments/:id/participants', () => {
      it('should get tournament participants successfully', async () => {
        const mockParticipants = [
          {
            id: 'participant-1',
            team_id: 'team-1',
            team_name: 'Team 1',
            status: 'registered'
          },
          {
            id: 'participant-2',
            team_id: 'team-2',
            team_name: 'Team 2',
            status: 'registered'
          }
        ];

        const { TournamentParticipantModel } = require('../models/TournamentParticipant');
        TournamentParticipantModel.getTournamentParticipants.mockResolvedValueOnce(mockParticipants);

        const response = await request(app)
          .get('/api/tournaments/tournament-123/participants');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.participants).toHaveLength(2);
        expect(response.body.data.count).toBe(2);
      });
    });

    describe('GET /api/tournaments/:id/standings', () => {
      it('should get tournament standings successfully', async () => {
        const mockStandings = [
          {
            id: 'participant-1',
            team_id: 'team-1',
            team_name: 'Team 1',
            points: 9,
            wins: 3,
            losses: 0
          },
          {
            id: 'participant-2',
            team_id: 'team-2',
            team_name: 'Team 2',
            points: 6,
            wins: 2,
            losses: 1
          }
        ];

        const { TournamentParticipantModel } = require('../models/TournamentParticipant');
        TournamentParticipantModel.getTournamentStandings.mockResolvedValueOnce(mockStandings);

        const response = await request(app)
          .get('/api/tournaments/tournament-123/standings');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.standings).toHaveLength(2);
        expect(response.body.data.standings[0].points).toBe(9);
      });
    });

    describe('POST /api/tournaments/:id/withdraw', () => {
      it('should withdraw team successfully', async () => {
        const mockTeam = {
          id: 'team-123',
          name: 'Test Team'
        };

        const { TeamModel } = require('../models/Team');
        const { TeamMembershipModel } = require('../models/TeamMembership');
        const { TournamentParticipantModel } = require('../models/TournamentParticipant');
        const { TournamentModel } = require('../models/Tournament');

        TeamModel.findById.mockResolvedValueOnce(mockTeam);
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);
        TournamentParticipantModel.isTeamRegistered.mockResolvedValueOnce(true);
        TournamentParticipantModel.withdrawParticipant.mockResolvedValueOnce(undefined);
        TournamentModel.updateTeamCount.mockResolvedValueOnce(undefined);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/withdraw')
          .set('Authorization', 'Bearer dummy_token')
          .send({ teamId: 'team-123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Team withdrawn successfully');
      });

      it('should return 400 for team not registered', async () => {
        const mockTeam = {
          id: 'team-123',
          name: 'Test Team'
        };

        const { TeamModel } = require('../models/Team');
        const { TeamMembershipModel } = require('../models/TeamMembership');
        const { TournamentParticipantModel } = require('../models/TournamentParticipant');

        TeamModel.findById.mockResolvedValueOnce(mockTeam);
        TeamMembershipModel.isMember.mockResolvedValueOnce(true);
        TournamentParticipantModel.isTeamRegistered.mockResolvedValueOnce(false);

        const response = await request(app)
          .post('/api/tournaments/tournament-123/withdraw')
          .set('Authorization', 'Bearer dummy_token')
          .send({ teamId: 'team-123' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Team is not registered for this tournament');
      });
    });
  });

  describe('Match Management', () => {
    describe('GET /api/tournaments/:id/matches', () => {
      it('should get tournament matches successfully', async () => {
        const mockMatches = [
          {
            id: 'match-1',
            tournament_id: 'tournament-123',
            round: 1,
            match_number: 1,
            team1_id: 'team-1',
            team2_id: 'team-2',
            status: 'scheduled'
          }
        ];

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        TournamentMatchModel.getMatchesByTournament.mockResolvedValueOnce(mockMatches);

        const response = await request(app)
          .get('/api/tournaments/tournament-123/matches');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.matches).toHaveLength(1);
        expect(response.body.data.count).toBe(1);
      });
    });

    describe('GET /api/tournaments/:id/bracket', () => {
      it('should get tournament bracket successfully', async () => {
        const mockBracket = [
          {
            round: 1,
            matches: [
              {
                id: 'match-1',
                round: 1,
                match_number: 1,
                team1_id: 'team-1',
                team2_id: 'team-2'
              }
            ]
          }
        ];

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        TournamentMatchModel.getTournamentBracket.mockResolvedValueOnce(mockBracket);

        const response = await request(app)
          .get('/api/tournaments/tournament-123/bracket');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.bracket).toHaveLength(1);
        expect(response.body.data.rounds).toBe(1);
      });
    });

    describe('POST /api/tournaments/matches/:matchId/start', () => {
      it('should start match successfully', async () => {
        const mockMatch = {
          id: 'match-123',
          tournament_id: 'tournament-123',
          status: 'scheduled'
        };

        const startedMatch = {
          ...mockMatch,
          status: 'in_progress',
          started_at: new Date()
        };

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        TournamentMatchModel.findById.mockResolvedValueOnce(mockMatch);
        TournamentMatchModel.startMatch.mockResolvedValueOnce(startedMatch);

        const response = await request(app)
          .post('/api/tournaments/matches/match-123/start')
          .set('Authorization', 'Bearer dummy_token')
          .send({ gameId: 'game-123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Match started successfully');
        expect(response.body.data.status).toBe('in_progress');
      });

      it('should return 400 for match not scheduled', async () => {
        const mockMatch = {
          id: 'match-123',
          tournament_id: 'tournament-123',
          status: 'completed'
        };

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        TournamentMatchModel.findById.mockResolvedValueOnce(mockMatch);

        const response = await request(app)
          .post('/api/tournaments/matches/match-123/start')
          .set('Authorization', 'Bearer dummy_token')
          .send({ gameId: 'game-123' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Match is not scheduled');
      });
    });

    describe('POST /api/tournaments/matches/:matchId/complete', () => {
      it('should complete match successfully', async () => {
        const mockMatch = {
          id: 'match-123',
          tournament_id: 'tournament-123',
          team1_id: 'team-1',
          team2_id: 'team-2',
          status: 'in_progress'
        };

        const completedMatch = {
          ...mockMatch,
          status: 'completed',
          team1_score: 1,
          team2_score: 0,
          completed_at: new Date()
        };

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        const { TournamentParticipantModel } = require('../models/TournamentParticipant');

        TournamentMatchModel.findById.mockResolvedValueOnce(mockMatch);
        TournamentMatchModel.completeMatch.mockResolvedValueOnce(completedMatch);
        TournamentParticipantModel.updateStats.mockResolvedValueOnce(undefined);

        const response = await request(app)
          .post('/api/tournaments/matches/match-123/complete')
          .set('Authorization', 'Bearer dummy_token')
          .send({ team1Score: 1, team2Score: 0 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Match completed successfully');
        expect(response.body.data.status).toBe('completed');
      });

      it('should return 400 for match not in progress', async () => {
        const mockMatch = {
          id: 'match-123',
          tournament_id: 'tournament-123',
          status: 'scheduled'
        };

        const { TournamentMatchModel } = require('../models/TournamentMatch');
        TournamentMatchModel.findById.mockResolvedValueOnce(mockMatch);

        const response = await request(app)
          .post('/api/tournaments/matches/match-123/complete')
          .set('Authorization', 'Bearer dummy_token')
          .send({ team1Score: 1, team2Score: 0 });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Match is not in progress');
      });
    });
  });
});
