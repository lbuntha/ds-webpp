import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error('Error:', err);

    // Handle specific error types
    if (err.code === 'auth/user-not-found') {
        sendError(
            res,
            'User not found',
            ERROR_CODES.USER_NOT_FOUND,
            HTTP_STATUS.NOT_FOUND
        );
        return;
    }

    if (err.code === 'auth/wrong-password') {
        sendError(
            res,
            'Invalid credentials',
            ERROR_CODES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED
        );
        return;
    }

    // Default error response
    sendError(
        res,
        err.message || 'Internal server error',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_ERROR
    );
};
