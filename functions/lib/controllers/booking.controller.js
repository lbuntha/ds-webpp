"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookingDetails = exports.listBookings = exports.createBooking = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const createBooking = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.createBooking = createBooking;
const listBookings = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.listBookings = listBookings;
const getBookingDetails = async (req, res) => {
    (0, response_1.sendError)(res, 'Not implemented yet', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
};
exports.getBookingDetails = getBookingDetails;
//# sourceMappingURL=booking.controller.js.map