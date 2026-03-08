"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
class EmailService {
    constructor() {
        this.db = admin.firestore();
    }
    async sendSettlementEmail(to, txnData, customerName, eventType, excelBuffer, breakdown, approvalNote) {
        try {
            // 1. Fetch Email Settings
            const settingsSnap = await this.db.collection('settings').doc('general').get();
            const config = settingsSnap.data();
            const emailSettings = config === null || config === void 0 ? void 0 : config.emailSettings;
            const templateConfig = config === null || config === void 0 ? void 0 : config.settlementTemplate;
            if (!emailSettings || !emailSettings.enabled || emailSettings.provider === 'none') {
                console.log('[EmailService] Email not enabled or configured.');
                return;
            }
            // 2. Check per-status activation
            const shouldSend = eventType === 'APPROVED' ? templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.approvedSendEmail : templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.initiatedSendEmail;
            if (shouldSend === false) {
                console.log(`[EmailService] Email for ${eventType} is explicitly disabled in template settings.`);
                return;
            }
            // 3. Prepare Transporter
            let transporter;
            if (emailSettings.provider === 'smtp') {
                transporter = nodemailer.createTransport({
                    host: emailSettings.smtpHost,
                    port: emailSettings.smtpPort,
                    secure: emailSettings.smtpPort === 465,
                    auth: {
                        user: emailSettings.smtpUser,
                        pass: emailSettings.smtpPass,
                    },
                });
            }
            else if (emailSettings.provider === 'gmail') {
                transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: emailSettings.smtpUser,
                        pass: emailSettings.smtpPass, // Use App Password
                    },
                });
            }
            else {
                console.log(`[EmailService] Provider ${emailSettings.provider} not implemented yet.`);
                return;
            }
            // 4. Format Message
            const subjectTemplate = eventType === 'APPROVED'
                ? ((templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.emailSubjectApproved) || 'Settlement Payout Approved')
                : ((templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.emailSubjectInitiated) || 'Settlement Payout Initiated');
            const bodyTemplate = eventType === 'APPROVED'
                ? ((templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.emailBodyApproved) || 'Dear {{customerName}}, your payout of {{netPayout}} has been approved.')
                : ((templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.emailBodyInitiated) || 'Dear {{customerName}}, your payout of {{netPayout}} is being processed.');
            const footer = (templateConfig === null || templateConfig === void 0 ? void 0 : templateConfig.footer) || '';
            const replacePlaceholders = (text) => {
                var _a, _b, _c, _d;
                let formatted = text;
                formatted = formatted.replace(/{{customerName}}/g, customerName);
                formatted = formatted.replace(/{{txnId}}/g, txnData.id || '');
                formatted = formatted.replace(/{{netPayout}}/g, `${txnData.currency === 'KHR' ? '៛' : '$'}${((_a = txnData.amount) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || '0'}`);
                formatted = formatted.replace(/{{totalCod}}/g, ((_b = breakdown === null || breakdown === void 0 ? void 0 : breakdown.totalCOD) === null || _b === void 0 ? void 0 : _b.toLocaleString()) || '0');
                formatted = formatted.replace(/{{totalFeesUsd}}/g, ((_c = breakdown === null || breakdown === void 0 ? void 0 : breakdown.deliveryFeeUSD) === null || _c === void 0 ? void 0 : _c.toLocaleString()) || '0');
                formatted = formatted.replace(/{{totalFeesKhr}}/g, ((_d = breakdown === null || breakdown === void 0 ? void 0 : breakdown.deliveryFeeKHR) === null || _d === void 0 ? void 0 : _d.toLocaleString()) || '0');
                formatted = formatted.replace(/{{adminNote}}/g, approvalNote || '');
                return formatted;
            };
            const finalSubject = replacePlaceholders(subjectTemplate);
            const finalBody = replacePlaceholders(bodyTemplate) + '\n\n' + replacePlaceholders(footer);
            // 5. Build Email
            const mailOptions = {
                from: `"${emailSettings.fromName || 'Doorstep Notifications'}" <${emailSettings.fromEmail || emailSettings.smtpUser}>`,
                to: to,
                subject: finalSubject,
                text: finalBody, // Fallback text
                html: finalBody.replace(/\n/g, '<br/>'), // Support basic line breaks
            };
            if (excelBuffer) {
                mailOptions.attachments = [
                    {
                        filename: `Settlement_Report_${txnData.id || 'export'}.xlsx`,
                        content: excelBuffer,
                    },
                ];
            }
            // 6. Send
            const info = await transporter.sendMail(mailOptions);
            console.log(`[EmailService] Email sent: ${info.messageId}`);
            return info;
        }
        catch (error) {
            console.error('[EmailService] Error sending email:', error);
            throw error;
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=emailService.js.map