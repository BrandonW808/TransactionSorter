// src/routes/savedReport.routes.ts
import { Router } from 'express';
import * as savedReportController from '../controllers/savedReport.controller';

const router = Router();

/**
 * GET /api/saved-reports
 * Get all reports for a user (requires userId query param)
 */
router.get('/', savedReportController.getReportsByUser);

/**
 * GET /api/saved-reports/search
 * Search reports for a user
 */
router.get('/search', savedReportController.searchReports);

/**
 * GET /api/saved-reports/:id
 * Get a specific report by ID
 */
router.get('/:id', savedReportController.getReportById);

/**
 * POST /api/saved-reports
 * Create a new saved report
 */
router.post('/', savedReportController.createReport);

/**
 * PUT /api/saved-reports/:id
 * Update an existing report
 */
router.put('/:id', savedReportController.updateReport);

/**
 * DELETE /api/saved-reports/:id
 * Delete a report
 */
router.delete('/:id', savedReportController.deleteReport);

/**
 * POST /api/saved-reports/:id/duplicate
 * Duplicate an existing report
 */
router.post('/:id/duplicate', savedReportController.duplicateReport);

/**
 * GET /api/saved-reports/:id/export
 * Export report as CSV download
 */
router.get('/:id/export', savedReportController.exportReportAsCsv);

export default router;