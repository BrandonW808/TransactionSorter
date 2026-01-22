// src/controllers/savedReport.controller.ts
import { Request, Response } from 'express';
import * as savedReportService from '../services/savedReportService';
import { CreateSavedReportRequest, UpdateSavedReportRequest } from '../types';

export const getReportsByUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        if (req.query.page || req.query.limit) {
            const result = await savedReportService.getReportsByUserPaginated(userId, page, limit);
            res.json({ success: true, data: result });
        } else {
            const reports = await savedReportService.getAllReportsByUser(userId);
            res.json({ success: true, data: reports });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve reports',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const searchReports = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, q } = req.query;

        if (!userId || typeof userId !== 'string') {
            res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
            return;
        }

        if (!q || typeof q !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
            return;
        }

        const reports = await savedReportService.searchReportsByUser(userId, q);
        res.json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to search reports',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getReportById = async (req: Request, res: Response): Promise<void> => {
    try {
        const report = await savedReportService.getReportById(req.params.id);

        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const createReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const reportData: CreateSavedReportRequest = req.body;

        if (!reportData.userId) {
            res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
            return;
        }

        if (!reportData.name) {
            res.status(400).json({
                success: false,
                error: 'Report name is required'
            });
            return;
        }

        if (!reportData.data || !Array.isArray(reportData.data)) {
            res.status(400).json({
                success: false,
                error: 'Report data is required and must be an array'
            });
            return;
        }

        const report = await savedReportService.createReport(reportData);
        res.status(201).json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const updateReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const updateData: UpdateSavedReportRequest = req.body;
        const report = await savedReportService.updateReport(req.params.id, updateData);

        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const deleteReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const deleted = await savedReportService.deleteReport(req.params.id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        res.json({ success: true, data: { message: 'Report deleted successfully' } });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const duplicateReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { newName } = req.body;
        const report = await savedReportService.duplicateReport(req.params.id, newName);

        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        res.status(201).json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to duplicate report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const exportReportAsCsv = async (req: Request, res: Response): Promise<void> => {
    try {
        const report = await savedReportService.getReportById(req.params.id);

        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        // Convert to CSV format
        const csvContent = report.data
            .map(row =>
                row.map(cell =>
                    typeof cell === 'string' && cell.includes(',')
                        ? `"${cell.replace(/"/g, '""')}"`
                        : cell
                ).join(',')
            )
            .join('\n');

        const fileName = report.originalFileName
            ? `${report.originalFileName.replace('.csv', '')}_edited.csv`
            : `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(csvContent);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to export report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};