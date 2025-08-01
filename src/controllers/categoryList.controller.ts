import { Request, Response } from 'express';
import * as categoryListService from '../services/categoryListService';
import { CreateCategoryListRequest, UpdateCategoryListRequest } from '../types';

export const getAllCategoryLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryLists = await categoryListService.getAllCategoryLists();
    res.json({ success: true, data: categoryLists });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve category lists',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const searchCategoryLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
      return;
    }

    const categoryLists = await categoryListService.searchCategoryLists(query);
    res.json({ success: true, data: categoryLists });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search category lists',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getDefaultCategoryList = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryList = await categoryListService.getDefaultCategoryList();
    if (!categoryList) {
      res.status(404).json({
        success: false,
        error: 'No default category list found'
      });
      return;
    }
    res.json({ success: true, data: categoryList });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve default category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getCategoryListById = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryList = await categoryListService.getCategoryListById(req.params.id);
    if (!categoryList) {
      res.status(404).json({
        success: false,
        error: 'Category list not found'
      });
      return;
    }
    res.json({ success: true, data: categoryList });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createCategoryList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, categories, isDefault }: CreateCategoryListRequest = req.body;

    if (!name || !categories) {
      res.status(400).json({
        success: false,
        error: 'Name and categories are required'
      });
      return;
    }

    const categoryList = await categoryListService.createCategoryList({ name, categories, isDefault });
    res.status(201).json({ success: true, data: categoryList });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to create category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateCategoryList = async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData: UpdateCategoryListRequest = req.body;

    const categoryList = await categoryListService.updateCategoryList(req.params.id, updateData);

    if (!categoryList) {
      res.status(404).json({
        success: false,
        error: 'Category list not found'
      });
      return;
    }

    res.json({ success: true, data: categoryList });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to update category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const setDefaultCategoryList = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryList = await categoryListService.setDefaultCategoryList(req.params.id);

    if (!categoryList) {
      res.status(404).json({
        success: false,
        error: 'Category list not found'
      });
      return;
    }

    res.json({ success: true, data: categoryList });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to set default category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteCategoryList = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await categoryListService.deleteCategoryList(req.params.id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Category list not found'
      });
      return;
    }

    res.json({ success: true, data: { message: 'Category list deleted successfully' } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete category list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
