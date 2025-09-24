import { Request, Response } from 'express';
import { AuthUtils } from '../utils/auth';
import { UserModel } from '../models/User';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body;

      // Validate input
      if (!username || !email || !password) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Username, email, and password are required'
          }
        });
        return;
      }

      // Validate email format
      if (!AuthUtils.validateEmail(email)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid email format'
          }
        });
        return;
      }

      // Validate username
      const usernameValidation = AuthUtils.validateUsername(username);
      if (!usernameValidation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid username',
            details: usernameValidation.errors
          }
        });
        return;
      }

      // Validate password strength
      const passwordValidation = AuthUtils.validatePassword(password);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Password does not meet requirements',
            details: passwordValidation.errors
          }
        });
        return;
      }

      // Check if user already exists
      const existingUser = await UserModel.findByUsername(username);
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            message: 'Username already exists'
          }
        });
        return;
      }

      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        res.status(409).json({
          success: false,
          error: {
            message: 'Email already registered'
          }
        });
        return;
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);

      // Create user
      const user = await UserModel.create({
        username,
        email,
        password_hash: passwordHash
      });

      // Generate JWT token
      const token = AuthUtils.generateToken({
        userId: user.id,
        username: user.username,
        email: user.email
      });

      // Return user data (without password)
      const { password_hash, ...userData } = user;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userData,
          token
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Registration failed'
        }
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Username and password are required'
          }
        });
        return;
      }

      // Find user by username or email
      let user = await UserModel.findByUsername(username);
      if (!user) {
        user = await UserModel.findByEmail(username);
      }

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Invalid credentials'
          }
        });
        return;
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Invalid credentials'
          }
        });
        return;
      }

      // Generate JWT token
      const token = AuthUtils.generateToken({
        userId: user.id,
        username: user.username,
        email: user.email
      });

      // Return user data (without password)
      const { password_hash, ...userData } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userData,
          token
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Login failed'
        }
      });
    }
  }

  // Logout user (client-side token removal)
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // In a stateless JWT system, logout is handled client-side
      // by removing the token. However, we can implement token blacklisting
      // or track logout events if needed in the future.
      
      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Logout failed'
        }
      });
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required'
          }
        });
        return;
      }

      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found'
          }
        });
        return;
      }

      // Return user data (without password)
      const { password_hash, ...userData } = user;

      res.json({
        success: true,
        data: {
          user: userData
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get profile'
        }
      });
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required'
          }
        });
        return;
      }

      const { username, email } = req.body;
      const updateData: any = {};

      // Validate and update username if provided
      if (username) {
        const usernameValidation = AuthUtils.validateUsername(username);
        if (!usernameValidation.isValid) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Invalid username',
              details: usernameValidation.errors
            }
          });
          return;
        }

        // Check if username is already taken
        const existingUser = await UserModel.findByUsername(username);
        if (existingUser && existingUser.id !== req.user.userId) {
          res.status(409).json({
            success: false,
            error: {
              message: 'Username already exists'
            }
          });
          return;
        }

        updateData.username = username;
      }

      // Validate and update email if provided
      if (email) {
        if (!AuthUtils.validateEmail(email)) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Invalid email format'
            }
          });
          return;
        }

        // Check if email is already taken
        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail && existingEmail.id !== req.user.userId) {
          res.status(409).json({
            success: false,
            error: {
              message: 'Email already registered'
            }
          });
          return;
        }

        updateData.email = email;
      }

      // Update user
      const updatedUser = await UserModel.update(req.user.userId, updateData);
      if (!updatedUser) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found'
          }
        });
        return;
      }

      // Return updated user data (without password)
      const { password_hash, ...userData } = updatedUser;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: userData
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update profile'
        }
      });
    }
  }
} 