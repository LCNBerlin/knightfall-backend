import { Request, Response } from 'express';
import { TeamModel, CreateTeamData, UpdateTeamData } from '../models/Team';
import { TeamValidationResult } from '../types/Team';

export class TeamController {
  // Create a new team
  static async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, logo_url, house_color } = req.body;

      // Validate input data
      const validation = TeamModel.validateTeamData({ name, description, logo_url, house_color });
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      // Check if team name already exists
      const nameExists = await TeamModel.nameExists(name);
      if (nameExists) {
        res.status(409).json({
          success: false,
          message: 'Team name already exists'
        });
        return;
      }

      // Create team data
      const teamData: CreateTeamData = {
        name,
        description,
        logo_url,
        house_color
      };

      const team = await TeamModel.create(teamData);

      res.status(201).json({
        success: true,
        message: 'Team created successfully',
        data: team
      });
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team by ID
  static async getTeamById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const team = await TeamModel.findById(id);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: team
      });
    } catch (error) {
      console.error('Error getting team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team by name
  static async getTeamByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      const team = await TeamModel.findByName(name);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: team
      });
    } catch (error) {
      console.error('Error getting team by name:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all teams with pagination
  static async getAllTeams(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
        return;
      }

      const teams = await TeamModel.findAll(limit, offset);
      const total = await TeamModel.getCount();

      res.status(200).json({
        success: true,
        data: {
          teams,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + limit < total
          }
        }
      });
    } catch (error) {
      console.error('Error getting teams:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Search teams by name
  static async searchTeams(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid limit parameter'
        });
        return;
      }

      const teams = await TeamModel.searchByName(q, limit);

      res.status(200).json({
        success: true,
        data: {
          teams,
          query: q,
          count: teams.length
        }
      });
    } catch (error) {
      console.error('Error searching teams:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update team
  static async updateTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, logo_url, house_color } = req.body;

      // Check if team exists
      const existingTeam = await TeamModel.findById(id);
      if (!existingTeam) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Validate input data
      const validation = TeamModel.validateTeamData({ name, description, logo_url, house_color });
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
        return;
      }

      // Check if new name conflicts with existing team (excluding current team)
      if (name && name !== existingTeam.name) {
        const nameExists = await TeamModel.nameExists(name, id);
        if (nameExists) {
          res.status(409).json({
            success: false,
            message: 'Team name already exists'
          });
          return;
        }
      }

      // Update team data
      const updateData: UpdateTeamData = {
        name,
        description,
        logo_url,
        house_color
      };

      const updatedTeam = await TeamModel.update(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Team updated successfully',
        data: updatedTeam
      });
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete team
  static async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if team exists
      const team = await TeamModel.findById(id);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      const deleted = await TeamModel.delete(id);
      if (!deleted) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete team'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Team deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get team with member count
  static async getTeamWithMemberCount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const team = await TeamModel.findByIdWithMemberCount(id);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: team
      });
    } catch (error) {
      console.error('Error getting team with member count:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check if team name exists
  static async checkTeamNameExists(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.query;
      const { excludeId } = req.query;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Team name is required'
        });
        return;
      }

      const exists = await TeamModel.nameExists(name, excludeId as string);

      res.status(200).json({
        success: true,
        data: {
          name,
          exists
        }
      });
    } catch (error) {
      console.error('Error checking team name:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
