/**
 * Phone number utilities for normalization and synthetic email generation
 */

export const AUTH_CONFIG = {
    PHONE_EMAIL_DOMAIN: 'doorsteps.tech'
};

/**
 * Standardize phone number normalization
 * Removes all non-digit characters except leading '+'
 */
export const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    // Keep digits only
    return phone.replace(/\D/g, '');
};

/**
 * Generate synthetic email for phone-based authentication
 */
export const getSyntheticEmail = (phone: string): string => {
    const normalized = normalizePhone(phone);
    return `${normalized}@${AUTH_CONFIG.PHONE_EMAIL_DOMAIN}`;
};

/**
 * Check if an email is a synthetic phone-based email
 */
export const isSyntheticEmail = (email: string): boolean => {
    return email.endsWith(`@${AUTH_CONFIG.PHONE_EMAIL_DOMAIN}`);
};

/**
 * Extract phone number from synthetic email
 */
export const extractPhoneFromEmail = (email: string): string | null => {
    if (!isSyntheticEmail(email)) return null;
    return email.split('@')[0];
};
