import { Router } from 'express';
import * as userController from '../controllers/user.controller';

const router = Router();

/**
 * GET /api/users
 * Get all users
 */
router.get('/', userController.getAllUsers);

/**
 * GET /api/users/search?q=query
 * Search users by name
 */
router.get('/search', userController.searchUsers);

/**
 * GET /api/users/:id
 * Get a user by ID
 */
router.get('/:id', userController.getUserById);

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', userController.createUser);

/**
 * PUT /api/users/:id
 * Update a user
 */
router.put('/:id', userController.updateUser);

/**
 * DELETE /api/users/:id
 * Delete a user
 */
router.delete('/:id', userController.deleteUser);

export default router;
