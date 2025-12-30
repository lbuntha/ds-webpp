"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getProfile = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const getProfile = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=user.controller.js.map