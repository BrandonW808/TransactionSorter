import { Router } from 'express';
import * as categoryListController from '../controllers/categoryList.controller';

const router = Router();

/**
 * GET /api/category-lists
 * Get all category lists
 */
router.get('/', categoryListController.getAllCategoryLists);

/**
 * GET /api/category-lists/search?q=query
 * Search category lists by name
 */
router.get('/search', categoryListController.searchCategoryLists);

/**
 * GET /api/category-lists/default
 * Get the default category list
 */
router.get('/default', categoryListController.getDefaultCategoryList);

/**
 * GET /api/category-lists/:id
 * Get a category list by ID
 */
router.get('/:id', categoryListController.getCategoryListById);

/**
 * POST /api/category-lists
 * Create a new category list
 */
router.post('/', categoryListController.createCategoryList);

/**
 * PUT /api/category-lists/:id
 * Update a category list
 */
router.put('/:id', categoryListController.updateCategoryList);

/**
 * PUT /api/category-lists/:id/set-default
 * Set a category list as default
 */
router.put('/:id/set-default', categoryListController.setDefaultCategoryList);

/**
 * DELETE /api/category-lists/:id
 * Delete a category list
 */
router.delete('/:id', categoryListController.deleteCategoryList);

export default router;
