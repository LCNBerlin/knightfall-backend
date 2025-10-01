import { Router } from 'express';
import { TeamPermissionController } from '../controllers/teamPermissionController';
import { authenticateToken } from '../middleware/auth';
import { TeamPermissionMiddleware } from '../middleware/teamPermissions';
import { validateTeamId } from '../middleware/teamValidation';

const router = Router();

// Public routes (no authentication required)
router.get('/permissions/available', TeamPermissionController.getAvailablePermissions);
router.get('/teams/:teamId/permissions', validateTeamId, TeamPermissionController.getTeamPermissions);
router.get('/teams/:teamId/roles/:role/permissions', validateTeamId, TeamPermissionController.getRolePermissions);
router.get('/teams/:teamId/check/:role/:permission', validateTeamId, TeamPermissionController.checkPermission);

// Protected routes (authentication required)
router.post('/teams/:teamId/permissions', 
  authenticateToken, 
  validateTeamId, 
  TeamPermissionMiddleware.requirePermission('team.manage'),
  TeamPermissionController.createPermission
);

router.put('/permissions/:permissionId', 
  authenticateToken, 
  TeamPermissionMiddleware.requirePermission('team.manage'),
  TeamPermissionController.updatePermission
);

router.delete('/permissions/:permissionId', 
  authenticateToken, 
  TeamPermissionMiddleware.requirePermission('team.manage'),
  TeamPermissionController.deletePermission
);

router.post('/teams/:teamId/permissions/initialize', 
  authenticateToken, 
  validateTeamId, 
  TeamPermissionMiddleware.requireTeamOwner(),
  TeamPermissionController.initializeDefaultPermissions
);

router.get('/teams/:teamId/users/:userId/permissions', 
  authenticateToken, 
  validateTeamId, 
  TeamPermissionMiddleware.requirePermission('team.members.view'),
  TeamPermissionController.getUserPermissions
);

router.put('/teams/:teamId/roles/:role/permissions', 
  authenticateToken, 
  validateTeamId, 
  TeamPermissionMiddleware.requirePermission('team.manage'),
  TeamPermissionController.updateRolePermissions
);

export default router;
