import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sendError } from '../utils/response';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';

export const getBalance = async (req: AuthRequest, res: Response): Promise<void> => {
    sendError(res, 'Not implemented yet', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
};

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
    sendError(res, 'Not implemented yet', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
};
