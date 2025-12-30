"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const constants_1 = require("../config/constants");
const sendSuccess = (res, message, data, statusCode = constants_1.HTTP_STATUS.OK) => {
    const response = {
        success: true,
        message,
        data,
    };
    res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message, errorCode, statusCode = constants_1.HTTP_STATUS.INTERNAL_ERROR, details) => {
    const response = {
        success: false,
        message,
        error: {
            code: errorCode,
            details,
        },
    };
    res.status(statusCode).json(response);
};
exports.sendError = sendError;
//# sourceMappingURL=response.js.map