import { DriverCommissionRule, Employee, ParcelBooking } from '../types';

/**
 * Rounded to 2 decimal places to ensure financial accuracy
 */
export function round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate driver commission for an action (pickup/delivery)
 * Finds the applicable rule based on driver zone, salary type, and action type
 * 
 * @param driver - Driver employee record
 * @param booking - The booking being processed
 * @param actionType - 'PICKUP' or 'DELIVERY'
 * @param commissionRules - All available commission rules
 * @param itemFeeShare - Optional per-item fee (for percentage calculations)
 * @param targetCurrency - Optional target currency (item's currency, for FIXED_AMOUNT conversion)
 * @param exchangeRate - Optional exchange rate for currency conversion (default: 4000)
 * @returns Commission amount in the target currency (rounded to 2 decimals)
 */
export function calculateDriverCommission(
    driver: Employee | undefined,
    booking: ParcelBooking,
    actionType: 'PICKUP' | 'DELIVERY',
    commissionRules: DriverCommissionRule[],
    itemFeeShare?: number,
    targetCurrency?: 'USD' | 'KHR',
    exchangeRate: number = 4000
): number {
    if (!driver || !driver.isDriver) return 0;

    // Find applicable rule
    const driverHasBaseSalary = driver.hasBaseSalary || false;
    const driverZone = driver.zone;

    // Priority: Zone + Action + Salary Type > Zone + Action + ALL > Default + Action + Salary Type > Default + Action + ALL
    let applicableRule: DriverCommissionRule | undefined;

    // 1. Try zone-specific rule with exact salary match
    if (driverZone) {
        applicableRule = commissionRules.find(r =>
            r.zoneName === driverZone &&
            r.commissionFor === actionType &&
            (r.driverSalaryType === (driverHasBaseSalary ? 'WITH_BASE_SALARY' : 'WITHOUT_BASE_SALARY'))
        );
    }

    // 2. Try zone-specific rule with ALL drivers
    if (!applicableRule && driverZone) {
        applicableRule = commissionRules.find(r =>
            r.zoneName === driverZone &&
            r.commissionFor === actionType &&
            r.driverSalaryType === 'ALL'
        );
    }

    // 3. Try default (no zone) rule with exact salary match
    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            !r.zoneName &&
            r.commissionFor === actionType &&
            (r.driverSalaryType === (driverHasBaseSalary ? 'WITH_BASE_SALARY' : 'WITHOUT_BASE_SALARY'))
        );
    }

    // 4. Try default rule with ALL drivers
    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            !r.zoneName &&
            r.commissionFor === actionType &&
            r.driverSalaryType === 'ALL'
        );
    }

    // 5. Fallback to any rule matching action type (for backward compatibility)
    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.commissionFor === actionType &&
            r.isDefault
        );
    }

    if (!applicableRule) return 0;

    // Calculate commission based on rule type
    const feeToCalculateOn = itemFeeShare !== undefined ? itemFeeShare : (booking.totalDeliveryFee || 0);

    if (applicableRule.type === 'PERCENTAGE') {
        // For percentage, the result is in the same currency as the fee
        return round2(feeToCalculateOn * (applicableRule.value / 100));
    } else {
        // FIXED_AMOUNT - Use dual currency values if available
        const outputCurrency = targetCurrency || booking.currency || 'USD';

        // Check for new dual-currency format first
        if (applicableRule.valueUSD !== undefined || applicableRule.valueKHR !== undefined) {
            // Use the amount matching the output currency
            if (outputCurrency === 'USD') {
                return round2(applicableRule.valueUSD || 0);
            } else {
                return round2(applicableRule.valueKHR || 0);
            }
        }

        // Fallback to legacy single-value format
        const ruleCurrency = applicableRule.currency || 'USD';

        if (ruleCurrency === outputCurrency) {
            return round2(applicableRule.value);
        } else {
            // Convert using provided exchange rate
            if (ruleCurrency === 'USD' && outputCurrency === 'KHR') {
                return round2(applicableRule.value * exchangeRate);
            } else if (ruleCurrency === 'KHR' && outputCurrency === 'USD') {
                return round2(applicableRule.value / exchangeRate);
            }
            return round2(applicableRule.value);
        }
    }
}

/**
 * Get the applicable commission rule for a driver
 * Useful for displaying what rule will be applied
 */
export function getApplicableCommissionRule(
    driver: Employee | undefined,
    actionType: 'PICKUP' | 'DELIVERY',
    commissionRules: DriverCommissionRule[]
): DriverCommissionRule | undefined {
    if (!driver || !driver.isDriver) return undefined;

    const driverHasBaseSalary = driver.hasBaseSalary || false;
    const driverZone = driver.zone;

    // Same priority logic as calculateDriverCommission
    let applicableRule: DriverCommissionRule | undefined;

    if (driverZone) {
        applicableRule = commissionRules.find(r =>
            r.zoneName === driverZone &&
            r.commissionFor === actionType &&
            (r.driverSalaryType === (driverHasBaseSalary ? 'WITH_BASE_SALARY' : 'WITHOUT_BASE_SALARY'))
        );
    }

    if (!applicableRule && driverZone) {
        applicableRule = commissionRules.find(r =>
            r.zoneName === driverZone &&
            r.commissionFor === actionType &&
            r.driverSalaryType === 'ALL'
        );
    }

    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.isDefault &&
            r.commissionFor === actionType &&
            (r.driverSalaryType === (driverHasBaseSalary ? 'WITH_BASE_SALARY' : 'WITHOUT_BASE_SALARY'))
        );
    }

    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.isDefault &&
            r.commissionFor === actionType &&
            r.driverSalaryType === 'ALL'
        );
    }

    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.commissionFor === actionType &&
            r.isDefault
        );
    }

    return applicableRule;
}
