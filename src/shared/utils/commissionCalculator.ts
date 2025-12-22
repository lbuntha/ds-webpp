import { DriverCommissionRule, Employee, ParcelBooking } from '../types';

/**
 * Rounded to 2 decimal places to ensure financial accuracy
 */
export function round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate driver commission based on rules, driver salary status, and action type
 * @param driver - The driver employee record
 * @param booking - The parcel booking
 * @param actionType - Whether this is for PICKUP or DELIVERY
 * @param commissionRules - All available commission rules
 * @returns Commission amount in the booking's currency (rounded to 2 decimals)
 */
export function calculateDriverCommission(
    driver: Employee | undefined,
    booking: ParcelBooking,
    actionType: 'PICKUP' | 'DELIVERY',
    commissionRules: DriverCommissionRule[],
    itemFeeShare?: number
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

    // 2. Try zone-specific rule with ALL salary types
    if (!applicableRule && driverZone) {
        applicableRule = commissionRules.find(r =>
            r.zoneName === driverZone &&
            r.commissionFor === actionType &&
            r.driverSalaryType === 'ALL'
        );
    }

    // 3. Try default rule with exact salary match
    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.isDefault &&
            r.commissionFor === actionType &&
            (r.driverSalaryType === (driverHasBaseSalary ? 'WITH_BASE_SALARY' : 'WITHOUT_BASE_SALARY'))
        );
    }

    // 4. Try default rule with ALL salary types
    if (!applicableRule) {
        applicableRule = commissionRules.find(r =>
            r.isDefault &&
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
        return round2(feeToCalculateOn * (applicableRule.value / 100));
    } else {
        // FIXED_AMOUNT
        // If rule currency matches booking currency, return as-is
        // Otherwise, convert (simplified - you may want more sophisticated conversion)
        const ruleCurrency = applicableRule.currency || 'USD';
        const bookingCurrency = booking.currency || 'USD';

        if (ruleCurrency === bookingCurrency) {
            return round2(applicableRule.value);
        } else {
            // Simple conversion (you may want to use actual exchange rates)
            const EXCHANGE_RATE = 4100; // USD to KHR
            if (ruleCurrency === 'USD' && bookingCurrency === 'KHR') {
                return round2(applicableRule.value * EXCHANGE_RATE);
            } else if (ruleCurrency === 'KHR' && bookingCurrency === 'USD') {
                return round2(applicableRule.value / EXCHANGE_RATE);
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
