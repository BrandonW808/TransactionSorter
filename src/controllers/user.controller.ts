import { Request, Response } from 'express';
import * as userService from '../services/userService';
import { CreateUserRequest, UpdateUserRequest } from '../types';

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
      return;
    }

    const users = await userService.searchUsers(query);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email }: CreateUserRequest = req.body;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
      return;
    }

    const user = await userService.createUser({ name, email });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData: UpdateUserRequest = req.body;
    const user = await userService.updateUser(req.params.id, updateData);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await userService.deleteUser(req.params.id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
