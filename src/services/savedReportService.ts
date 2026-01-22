// src/services/savedReportService.ts
import { SavedReportModel } from '../models/SavedReport';
import { ISavedReportDocument, CreateSavedReportRequest, UpdateSavedReportRequest } from '../types';
import { Types } from 'mongoose';

export const getAllReportsByUser = async (userId: string): Promise<ISavedReportDocument[]> => {
    return SavedReportModel.find({ userId: new Types.ObjectId(userId) })
        .sort({ updatedAt: -1 })
        .populate('userId', 'name email')
        .populate('categoryListId', 'name');
};

export const getReportById = async (id: string): Promise<ISavedReportDocument | null> => {
    return SavedReportModel.findById(id)
        .populate('userId', 'name email')
        .populate('categoryListId', 'name');
};

export const getReportsByUserPaginated = async (
    userId: string,
    page: number = 1,
    limit: number = 10
): Promise<{
    reports: ISavedReportDocument[];
    total: number;
    page: number;
    totalPages: number;
}> => {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
        SavedReportModel.find({ userId: new Types.ObjectId(userId) })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email')
            .populate('categoryListId', 'name'),
        SavedReportModel.countDocuments({ userId: new Types.ObjectId(userId) })
    ]);

    return {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
};

export const searchReportsByUser = async (
    userId: string,
    query: string
): Promise<ISavedReportDocument[]> => {
    return SavedReportModel.find({
        userId: new Types.ObjectId(userId),
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { originalFileName: { $regex: query, $options: 'i' } }
        ]
    })
        .sort({ updatedAt: -1 })
        .populate('userId', 'name email')
        .populate('categoryListId', 'name');
};

export const createReport = async (
    reportData: CreateSavedReportRequest
): Promise<ISavedReportDocument> => {
    const report = new SavedReportModel({
        userId: new Types.ObjectId(reportData.userId),
        name: reportData.name,
        description: reportData.description,
        data: reportData.data,
        originalFileName: reportData.originalFileName,
        categoryListId: reportData.categoryListId
            ? new Types.ObjectId(reportData.categoryListId)
            : undefined,
        metadata: reportData.metadata
    });

    await report.save();
    return report.populate(['userId', 'categoryListId']);
};

export const updateReport = async (
    id: string,
    updateData: UpdateSavedReportRequest
): Promise<ISavedReportDocument | null> => {
    const report = await SavedReportModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
    )
        .populate('userId', 'name email')
        .populate('categoryListId', 'name');

    return report;
};

export const deleteReport = async (id: string): Promise<boolean> => {
    const result = await SavedReportModel.findByIdAndDelete(id);
    return result !== null;
};

export const deleteAllReportsByUser = async (userId: string): Promise<number> => {
    const result = await SavedReportModel.deleteMany({
        userId: new Types.ObjectId(userId)
    });
    return result.deletedCount;
};

export const duplicateReport = async (
    id: string,
    newName?: string
): Promise<ISavedReportDocument | null> => {
    const original = await SavedReportModel.findById(id);
    if (!original) return null;

    const duplicate = new SavedReportModel({
        userId: original.userId,
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        data: JSON.parse(JSON.stringify(original.data)), // Deep copy
        originalFileName: original.originalFileName,
        categoryListId: original.categoryListId,
        metadata: original.metadata
    });

    await duplicate.save();
    return duplicate.populate(['userId', 'categoryListId']);
};