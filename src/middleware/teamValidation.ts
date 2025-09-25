import { Request, Response, NextFunction } from 'express';
import { TeamModel } from '../models/Team';

export interface TeamValidationRequest extends Request {
  body: {
    name?: string;
    description?: string;
    logo_url?: string;
    house_color?: string;
  };
}

// Middleware to validate team creation data
export const validateTeamCreation = (req: TeamValidationRequest, res: Response, next: NextFunction): void => {
  const { name, description, logo_url, house_color } = req.body;

  // Check required fields
  if (!name || typeof name !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Team name is required and must be a string'
    });
    return;
  }

  // Validate team data using the model's validation method
  const validation = TeamModel.validateTeamData({ name, description, logo_url, house_color });
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    });
    return;
  }

  next();
};

// Middleware to validate team update data
export const validateTeamUpdate = (req: TeamValidationRequest, res: Response, next: NextFunction): void => {
  const { name, description, logo_url, house_color } = req.body;

  // Check if at least one field is provided for update
  if (!name && !description && !logo_url && !house_color) {
    res.status(400).json({
      success: false,
      message: 'At least one field must be provided for update'
    });
    return;
  }

  // Validate team data using the model's validation method
  const validation = TeamModel.validateTeamData({ name, description, logo_url, house_color });
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    });
    return;
  }

  next();
};

// Middleware to validate pagination parameters
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string);
  const limit = parseInt(req.query.limit as string);

  if (req.query.page && (isNaN(page) || page < 1)) {
    res.status(400).json({
      success: false,
      message: 'Page must be a positive integer'
    });
    return;
  }

  if (req.query.limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    res.status(400).json({
      success: false,
      message: 'Limit must be a positive integer between 1 and 100'
    });
    return;
  }

  next();
};

// Middleware to validate search parameters
export const validateSearch = (req: Request, res: Response, next: NextFunction): void => {
  const { q } = req.query;
  const limit = parseInt(req.query.limit as string);

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Search query is required and must be a non-empty string'
    });
    return;
  }

  if (req.query.limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    res.status(400).json({
      success: false,
      message: 'Limit must be a positive integer between 1 and 100'
    });
    return;
  }

  next();
};

// Middleware to validate team ID parameter
export const validateTeamId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Team ID is required'
    });
    return;
  }

  // Basic UUID validation (simplified)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid team ID format'
    });
    return;
  }

  next();
};

// Middleware to validate team name parameter
export const validateTeamName = (req: Request, res: Response, next: NextFunction): void => {
  const { name } = req.params;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Team name is required and must be a non-empty string'
    });
    return;
  }

  next();
};
