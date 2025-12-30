"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDelivery = exports.acceptJob = exports.getJobs = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const getJobs = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.getJobs = getJobs;
const acceptJob = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.acceptJob = acceptJob;
const completeDelivery = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.completeDelivery = completeDelivery;
//# sourceMappingURL=driver.controller.js.map