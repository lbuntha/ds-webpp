import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { sendError } from '../utils/response';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';

export interface AuthRequest extends Request {
    user?: {
        uid: string;
        email: string;
        role?: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendError(
                res,
                'No authorization token provided',
                ERROR_CODES.UNAUTHORIZED,
                HTTP_STATUS.UNAUTHORIZED
            );
            return;
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify Firebase ID token
        const decodedToken = await auth.verifyIdToken(token);

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
            role: decodedToken.role,
        };

        next();
    } catch (error: any) {
        console.error('Authentication error:', error);
        sendError(
            res,
            'Invalid or expired token',
            ERROR_CODES.TOKEN_EXPIRED,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
};

export const requireRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendError(
                res,
                'Unauthorized',
                ERROR_CODES.UNAUTHORIZED,
                HTTP_STATUS.UNAUTHORIZED
            );
            return;
        }

        if (!req.user.role || !allowedRoles.includes(req.user.role)) {
            sendError(
                res,
                'Insufficient permissions',
                ERROR_CODES.FORBIDDEN,
                HTTP_STATUS.FORBIDDEN
            );
            return;
        }

        next();
    };
};
