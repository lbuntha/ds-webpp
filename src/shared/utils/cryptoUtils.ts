/**
 * Crypto utilities for hashing and security
 */

/**
 * Generates a SHA-256 hash of a string in hex format.
 * This implementation is compatible with modern browsers (SubtleCrypto).
 */
export async function hashString(text: string): Promise<string> {
    if (!text) return '';

    // In some environments (like non-secure contexts), crypto.subtle might be undefined
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        // Fallback or handle error - for this app we expect a modern environment
        console.warn('SubtleCrypto not available, hashing may fail');
        throw new Error('Secure hashing is not supported in this environment');
    }

    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
