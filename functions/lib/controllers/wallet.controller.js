"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactions = exports.getBalance = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const getBalance = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.getBalance = getBalance;
const getTransactions = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.getTransactions = getTransactions;
//# sourceMappingURL=wallet.controller.js.map