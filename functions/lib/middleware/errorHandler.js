"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    // Handle specific error types
    if (err.code === 'auth/user-not-found') {
        (0, response_1.sendError)(res, 'User not found', constants_1.ERROR_CODES.USER_NOT_FOUND, constants_1.HTTP_STATUS.NOT_FOUND);
        return;
    }
    if (err.code === 'auth/wrong-password') {
        (0, response_1.sendError)(res, 'Invalid credentials', constants_1.ERROR_CODES.INVALID_CREDENTIALS, constants_1.HTTP_STATUS.UNAUTHORIZED);
        return;
    }
    // Default error response
    (0, response_1.sendError)(res, err.message || 'Internal server error', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map