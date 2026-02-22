import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { EmailSettings, SettlementMessageTemplate } from '../../../src/shared/types';

export class EmailService {
    private db = admin.firestore();

    async sendSettlementEmail(
        to: string,
        txnData: any,
        customerName: string,
        eventType: 'APPROVED' | 'INITIATED',
        excelBuffer?: Buffer,
        breakdown?: any,
        approvalNote?: string
    ) {
        try {
            // 1. Fetch Email Settings
            const settingsSnap = await this.db.collection('settings').doc('general').get();
            const config = settingsSnap.data();
            const emailSettings: EmailSettings = config?.emailSettings;
            const templateConfig: SettlementMessageTemplate = config?.settlementTemplate;

            if (!emailSettings || !emailSettings.enabled || emailSettings.provider === 'none') {
                console.log('[EmailService] Email not enabled or configured.');
                return;
            }

            // 2. Check per-status activation
            const shouldSend = eventType === 'APPROVED' ? templateConfig?.approvedSendEmail : templateConfig?.initiatedSendEmail;
            if (shouldSend === false) {
                console.log(`[EmailService] Email for ${eventType} is explicitly disabled in template settings.`);
                return;
            }

            // 3. Prepare Transporter
            let transporter: nodemailer.Transporter;

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
            } else if (emailSettings.provider === 'gmail') {
                transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: emailSettings.smtpUser,
                        pass: emailSettings.smtpPass, // Use App Password
                    },
                });
            } else {
                console.log(`[EmailService] Provider ${emailSettings.provider} not implemented yet.`);
                return;
            }

            // 4. Format Message
            const subjectTemplate = eventType === 'APPROVED'
                ? (templateConfig?.emailSubjectApproved || 'Settlement Payout Approved')
                : (templateConfig?.emailSubjectInitiated || 'Settlement Payout Initiated');

            const bodyTemplate = eventType === 'APPROVED'
                ? (templateConfig?.emailBodyApproved || 'Dear {{customerName}}, your payout of {{netPayout}} has been approved.')
                : (templateConfig?.emailBodyInitiated || 'Dear {{customerName}}, your payout of {{netPayout}} is being processed.');

            const footer = templateConfig?.footer || '';

            const replacePlaceholders = (text: string) => {
                let formatted = text;
                formatted = formatted.replace(/{{customerName}}/g, customerName);
                formatted = formatted.replace(/{{txnId}}/g, txnData.id || '');
                formatted = formatted.replace(/{{netPayout}}/g, `${txnData.currency === 'KHR' ? '៛' : '$'}${txnData.amount?.toLocaleString() || '0'}`);
                formatted = formatted.replace(/{{totalCod}}/g, breakdown?.totalCOD?.toLocaleString() || '0');
                formatted = formatted.replace(/{{totalFeesUsd}}/g, breakdown?.deliveryFeeUSD?.toLocaleString() || '0');
                formatted = formatted.replace(/{{totalFeesKhr}}/g, breakdown?.deliveryFeeKHR?.toLocaleString() || '0');
                formatted = formatted.replace(/{{adminNote}}/g, approvalNote || '');
                return formatted;
            };

            const finalSubject = replacePlaceholders(subjectTemplate);
            const finalBody = replacePlaceholders(bodyTemplate) + '\n\n' + replacePlaceholders(footer);

            // 5. Build Email
            const mailOptions: nodemailer.SendMailOptions = {
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

        } catch (error) {
            console.error('[EmailService] Error sending email:', error);
            throw error;
        }
    }
}
