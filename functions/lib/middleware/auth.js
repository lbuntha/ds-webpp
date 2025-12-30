"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const firebase_1 = require("../config/firebase");
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            (0, response_1.sendError)(res, 'No authorization token provided', constants_1.ERROR_CODES.UNAUTHORIZED, constants_1.HTTP_STATUS.UNAUTHORIZED);
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        // Verify Firebase ID token
        const decodedToken = await firebase_1.auth.verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || '',
            role: decodedToken.role,
        };
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        (0, response_1.sendError)(res, 'Invalid or expired token', constants_1.ERROR_CODES.TOKEN_EXPIRED, constants_1.HTTP_STATUS.UNAUTHORIZED);
    }
};
exports.authenticate = authenticate;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Unauthorized', constants_1.ERROR_CODES.UNAUTHORIZED, constants_1.HTTP_STATUS.UNAUTHORIZED);
            return;
        }
        if (!req.user.role || !allowedRoles.includes(req.user.role)) {
            (0, response_1.sendError)(res, 'Insufficient permissions', constants_1.ERROR_CODES.FORBIDDEN, constants_1.HTTP_STATUS.FORBIDDEN);
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map