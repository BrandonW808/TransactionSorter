import { Router, Request, Response } from 'express';
import userRoutes from './userRoutes';
import categoryListRoutes from './categoryListRoutes';
import transactionRoutes from './transactionRoutes';
import receiptRoutes from './receiptRoutes';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }
  });
});

// Mount sub-routers
router.use('/users', userRoutes);
router.use('/category-lists', categoryListRoutes);
router.use('/transactions', transactionRoutes);
router.use('/receipts', receiptRoutes);

// Legacy endpoints redirect (for backward compatibility)
router.get('/categories', (req: Request, res: Response) => {
  res.redirect(301, '/api/category-lists/default');
});

router.get('/categoriesList', (req: Request, res: Response) => {
  res.redirect(301, '/api/category-lists');
});

router.post('/categoriesList', (req: Request, res: Response) => {
  res.redirect(307, '/api/category-lists');
});

router.post('/categorize', (req: Request, res: Response) => {
  res.redirect(307, '/api/transactions/categorize');
});

router.post('/categorize-csv', (req: Request, res: Response) => {
  res.redirect(307, '/api/transactions/categorize-csv');
});

router.post('/parse-csv', (req: Request, res: Response) => {
  res.redirect(307, '/api/transactions/parse-csv');
});

router.post('/export-csv', (req: Request, res: Response) => {
  res.redirect(307, '/api/transactions/export-csv');
});

export default router;
