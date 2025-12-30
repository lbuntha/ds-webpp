import { Response } from 'express';
import { HTTP_STATUS } from '../config/constants';

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: {
        code: string;
        details?: any;
    };
}

export const sendSuccess = <T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = HTTP_STATUS.OK
): void => {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
    };
    res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    message: string,
    errorCode: string,
    statusCode: number = HTTP_STATUS.INTERNAL_ERROR,
    details?: any
): void => {
    const response: ApiResponse = {
        success: false,
        message,
        error: {
            code: errorCode,
            details,
        },
    };
    res.status(statusCode).json(response);
};
