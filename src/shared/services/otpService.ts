import { Firestore, collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, Timestamp } from 'firebase/firestore';

interface OTPRecord {
    id: string;              // phone number (normalized)
    code: string;            // 6-digit code
    phone: string;           // original phone
    createdAt: number;       // timestamp
    expiresAt: number;       // timestamp (5 min from creation)
    attempts: number;        // verification attempts
    verified: boolean;       // if code was used
    purpose: 'SIGNUP' | 'LOGIN';
    requestCount?: number;   // for rate limiting
}

export class OTPService {
    private readonly OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_ATTEMPTS = 3;
    private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    private readonly MAX_REQUESTS_PER_HOUR = 3;

    constructor(private db: Firestore) { }

    /**
     * Generate a random 6-digit OTP code
     */
    private generateCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Normalize phone number (remove spaces, dashes, etc.)
     */
    private normalizePhone(phone: string): string {
        return phone.replace(/[\s\-\(\)]/g, '');
    }

    /**
     * Check rate limiting for OTP requests
     */
    private async checkRateLimit(phone: string): Promise<boolean> {
        const normalizedPhone = this.normalizePhone(phone);
        const now = Date.now();
        const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

        // Query recent OTP requests
        const otpRef = collection(this.db, 'otp_codes');
        const q = query(
            otpRef,
            where('id', '==', normalizedPhone),
            where('createdAt', '>', windowStart)
        );

        const snapshot = await getDocs(q);

        // Count requests in the last hour
        return snapshot.size < this.MAX_REQUESTS_PER_HOUR;
    }

    /**
     * Request OTP - Generate and store code in Firebase
     */
    async requestOTP(phone: string, purpose: 'SIGNUP' | 'LOGIN' = 'LOGIN'): Promise<{ success: boolean; message: string }> {
        try {
            const normalizedPhone = this.normalizePhone(phone);

            // Check rate limiting
            const withinLimit = await this.checkRateLimit(normalizedPhone);
            if (!withinLimit) {
                return {
                    success: false,
                    message: 'Too many requests. Please try again later.'
                };
            }

            // Generate code
            const code = this.generateCode();
            const now = Date.now();
            const expiresAt = now + this.OTP_EXPIRY_MS;

            // Store in Firestore
            const otpRecord: OTPRecord = {
                id: normalizedPhone,
                code,
                phone,
                createdAt: now,
                expiresAt,
                attempts: 0,
                verified: false,
                purpose
            };

            await setDoc(doc(this.db, 'otp_codes', normalizedPhone), otpRecord);

            console.log(`[OTP] Generated code for ${phone}: ${code}`); // For development - remove in production

            return {
                success: true,
                message: 'OTP code generated successfully. Check Firebase Console or use getOTP() to retrieve it.'
            };
        } catch (error: any) {
            console.error('[OTP] Request error:', error);
            return {
                success: false,
                message: error.message || 'Failed to generate OTP'
            };
        }
    }

    /**
     * Verify OTP code
     */
    async verifyOTP(phone: string, code: string): Promise<{ success: boolean; message: string; purpose?: 'SIGNUP' | 'LOGIN' }> {
        try {
            const normalizedPhone = this.normalizePhone(phone);
            const otpDoc = await getDoc(doc(this.db, 'otp_codes', normalizedPhone));

            if (!otpDoc.exists()) {
                return {
                    success: false,
                    message: 'No OTP found for this phone number. Please request a new code.'
                };
            }

            const otpRecord = otpDoc.data() as OTPRecord;
            const now = Date.now();

            // Check if already verified
            if (otpRecord.verified) {
                return {
                    success: false,
                    message: 'This OTP has already been used. Please request a new code.'
                };
            }

            // Check expiry
            if (now > otpRecord.expiresAt) {
                await deleteDoc(doc(this.db, 'otp_codes', normalizedPhone));
                return {
                    success: false,
                    message: 'OTP has expired. Please request a new code.'
                };
            }

            // Check attempts
            if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
                await deleteDoc(doc(this.db, 'otp_codes', normalizedPhone));
                return {
                    success: false,
                    message: 'Too many failed attempts. Please request a new code.'
                };
            }

            // Verify code
            if (otpRecord.code !== code) {
                // Increment attempts
                await setDoc(
                    doc(this.db, 'otp_codes', normalizedPhone),
                    { attempts: otpRecord.attempts + 1 },
                    { merge: true }
                );

                return {
                    success: false,
                    message: `Invalid OTP code. ${this.MAX_ATTEMPTS - otpRecord.attempts - 1} attempts remaining.`
                };
            }

            // Success - mark as verified
            await setDoc(
                doc(this.db, 'otp_codes', normalizedPhone),
                { verified: true },
                { merge: true }
            );

            // Delete after successful verification (optional - can keep for audit)
            await deleteDoc(doc(this.db, 'otp_codes', normalizedPhone));

            return {
                success: true,
                message: 'OTP verified successfully',
                purpose: otpRecord.purpose
            };
        } catch (error: any) {
            console.error('[OTP] Verification error:', error);
            return {
                success: false,
                message: error.message || 'Failed to verify OTP'
            };
        }
    }

    /**
     * Get OTP code (for admin/testing purposes)
     * WARNING: Remove or restrict in production!
     */
    async getOTP(phone: string): Promise<{ code: string | null; expiresAt: number | null }> {
        try {
            const normalizedPhone = this.normalizePhone(phone);
            const otpDoc = await getDoc(doc(this.db, 'otp_codes', normalizedPhone));

            if (!otpDoc.exists()) {
                return { code: null, expiresAt: null };
            }

            const otpRecord = otpDoc.data() as OTPRecord;
            const now = Date.now();

            // Check if expired
            if (now > otpRecord.expiresAt) {
                return { code: null, expiresAt: null };
            }

            return {
                code: otpRecord.code,
                expiresAt: otpRecord.expiresAt
            };
        } catch (error) {
            console.error('[OTP] Get OTP error:', error);
            return { code: null, expiresAt: null };
        }
    }

    /**
     * Clean up expired OTP codes (run periodically)
     */
    async cleanupExpiredOTPs(): Promise<number> {
        try {
            const now = Date.now();
            const otpRef = collection(this.db, 'otp_codes');
            const snapshot = await getDocs(otpRef);

            let deletedCount = 0;

            for (const docSnap of snapshot.docs) {
                const otpRecord = docSnap.data() as OTPRecord;
                if (now > otpRecord.expiresAt) {
                    await deleteDoc(doc(this.db, 'otp_codes', docSnap.id));
                    deletedCount++;
                }
            }

            console.log(`[OTP] Cleaned up ${deletedCount} expired codes`);
            return deletedCount;
        } catch (error) {
            console.error('[OTP] Cleanup error:', error);
            return 0;
        }
    }
}
