import { ParcelServiceType, CustomerSpecialRate, ParcelBooking } from '../types';
import { logisticsService } from '../services/logisticsService';

export interface FeeCalculationResult {
    fee: number;
    currency: 'USD' | 'KHR';
    isSpecialRate: boolean;
    pricePerItem: number;
}

export interface FeeCalculationInput {
    serviceTypeId: string;
    customerId: string;
    itemCount: number;
    codCurrency: 'USD' | 'KHR';
    exchangeRate?: number;
    services: ParcelServiceType[];
    specialRates?: CustomerSpecialRate[]; // Optional - will be fetched if not provided
}

/**
 * Calculate delivery fee based on service, special rates, and COD currency.
 * This is the single source of truth for fee calculation across the app.
 * 
 * @param input - Fee calculation parameters
 * @returns Promise<FeeCalculationResult>
 */
export async function calculateDeliveryFee(input: FeeCalculationInput): Promise<FeeCalculationResult> {
    const {
        serviceTypeId,
        customerId,
        itemCount,
        codCurrency,
        exchangeRate = 4100,
        services,
        specialRates: providedRates
    } = input;

    const isKHR = codCurrency === 'KHR';

    // Find the service
    const service = services.find(s => s.id === serviceTypeId);
    if (!service) {
        console.warn('Service not found for fee calculation:', serviceTypeId);
        return { fee: 0, currency: codCurrency, isSpecialRate: false, pricePerItem: 0 };
    }

    // Get special rates (use provided or fetch)
    let specialRates = providedRates;
    if (!specialRates && customerId) {
        try {
            specialRates = await logisticsService.getCustomerSpecialRates(customerId);
        } catch (e) {
            console.error('Failed to fetch special rates:', e);
            specialRates = [];
        }
    }

    // Start with service default price based on currency
    let pricePerItem = isKHR
        ? (service.defaultPriceKHR || 0)
        : (service.defaultPrice || 0);
    let isSpecialRate = false;

    // Check for active special rate
    if (specialRates && specialRates.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const activeSpecial = specialRates.find(r =>
            r.serviceTypeId === serviceTypeId &&
            r.startDate.split('T')[0] <= today &&
            r.endDate.split('T')[0] >= today
        );

        if (activeSpecial) {
            // Apply special rate based on COD currency
            if (isKHR) {
                // Use KHR special rate if available, otherwise convert USD rate
                if (activeSpecial.priceKHR) {
                    pricePerItem = activeSpecial.priceKHR;
                } else {
                    pricePerItem = activeSpecial.price * exchangeRate;
                }
            } else {
                pricePerItem = activeSpecial.price;
            }
            isSpecialRate = true;
        }
    }

    const totalFee = pricePerItem * Math.max(itemCount, 1);

    console.log('💰 Fee calculated:', {
        isKHR,
        pricePerItem,
        itemCount,
        totalFee,
        isSpecialRate,
        serviceName: service.name
    });

    return {
        fee: totalFee,
        currency: codCurrency,
        isSpecialRate,
        pricePerItem
    };
}

/**
 * Recalculate fee for an existing booking based on updated COD currency
 * Updates the booking object in place and returns the calculated fee info
 * 
 * @param booking - The booking to update
 * @param newCodCurrency - The new COD currency
 * @param services - Available services
 * @param specialRates - Optional pre-fetched special rates
 * @returns Promise<ParcelBooking> - The updated booking with recalculated fee
 */
export async function recalculateBookingFee(
    booking: ParcelBooking,
    newCodCurrency: 'USD' | 'KHR',
    services: ParcelServiceType[],
    specialRates?: CustomerSpecialRate[]
): Promise<ParcelBooking> {
    const result = await calculateDeliveryFee({
        serviceTypeId: booking.serviceTypeId,
        customerId: booking.senderId || '',
        itemCount: booking.items?.length || 1,
        codCurrency: newCodCurrency,
        exchangeRate: booking.exchangeRateForCOD || 4100,
        services,
        specialRates
    });

    return {
        ...booking,
        totalDeliveryFee: result.fee,
        currency: result.currency
    };
}
