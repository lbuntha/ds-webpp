
/**
 * Utility for currency rounding and formatting.
 */

/**
 * Rounds KHR amount to the nearest 100.
 * Rule: 50 rounds up to 100, 49 rounds down to 0.
 * 
 * @param amount - The raw KHR amount
 * @returns Rounded KHR amount
 */
export function roundKHR(amount: number): number {
    return Math.round(amount / 100) * 100;
}

/**
 * Formats a number as a currency string.
 * 
 * @param amount - The amount to format
 * @param currency - The currency code ('USD' | 'KHR')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: 'USD' | 'KHR' = 'USD'): string {
    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } else {
        // For KHR, we round to nearest 100 and show no decimals
        const rounded = roundKHR(amount);
        return `${rounded.toLocaleString()} ៛`;
    }
}
