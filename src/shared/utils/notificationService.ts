import { AppNotification } from '../types';

/**
 * Bilingual notification utility
 * Creates notifications with both English and Khmer text
 */

export interface BilingualNotification extends Omit<AppNotification, 'title' | 'message'> {
    title_en: string;
    title_km: string;
    message_en: string;
    message_km: string;
    // Legacy fields for backward compatibility
    title: string;
    message: string;
}

/**
 * Notification templates with English and Khmer translations
 */
export const NotificationTemplates = {
    // Booking notifications
    NEW_BOOKING: {
        title_en: 'New Parcel Booking',
        title_km: 'ការកក់បញ្ញើថ្មី',
    },
    BOOKING_CONFIRMED: {
        title_en: 'Booking Confirmed',
        title_km: 'ការកក់ត្រូវបានបញ្ជាក់',
        message_en: 'Your booking has been confirmed and is ready for pickup.',
        message_km: 'ការកក់របស់អ្នកត្រូវបានបញ្ជាក់ហើយ រង់ចាំទទួលយក។',
    },

    // Delivery notifications
    PARCEL_DELIVERED: {
        title_en: 'Parcel Delivered',
        title_km: 'បញ្ញើបានដឹកជូនហើយ',
    },
    PARCEL_RETURNED: {
        title_en: 'Parcel Returned',
        title_km: 'បញ្ញើត្រូវបានត្រឡប់',
    },

    // COD notifications
    COD_UPDATED_BY_DRIVER: {
        title_en: 'COD Amount Updated',
        title_km: 'ចំនួន COD ត្រូវបានកែប្រែ',
    },
    COD_UPDATED_BY_CUSTOMER: {
        title_en: 'COD Amount Updated',
        title_km: 'ចំនួន COD ត្រូវបានកែប្រែ',
    },

    // Wallet notifications
    WALLET_APPROVED: {
        title_en: 'Wallet Request Approved',
        title_km: 'សំណើកាបូបលុយត្រូវបានអនុម័ត',
        message_en: 'Your wallet request has been approved.',
        message_km: 'សំណើកាបូបលុយរបស់អ្នកត្រូវបានអនុម័ត។',
    },
    WALLET_REJECTED: {
        title_en: 'Wallet Request Rejected',
        title_km: 'សំណើកាបូបលុយត្រូវបានបដិសេធ',
        message_en: 'Your wallet request has been rejected.',
        message_km: 'សំណើកាបូបលុយរបស់អ្នកត្រូវបានបដិសេធ។',
    },

    // Warehouse notifications
    PARCEL_AT_WAREHOUSE: {
        title_en: 'Parcel at Warehouse',
        title_km: 'បញ្ញើនៅឃ្លាំង',
    },

    // Assignment notifications
    DELIVERY_ASSIGNED: {
        title_en: 'New Delivery Assignment',
        title_km: 'ការងារដឹកជញ្ជូនថ្មី',
        message_en: 'You have been assigned a new delivery.',
        message_km: 'អ្នកត្រូវបានចាត់តាំងឱ្យដឹកជញ្ជូនថ្មី។',
    },
    PICKUP_ASSIGNED: {
        title_en: 'New Pickup Assignment',
        title_km: 'ការងារទទួលថ្មី',
        message_en: 'You have been assigned a new pickup job.',
        message_km: 'អ្នកត្រូវបានចាត់តាំងឱ្យទទួលបញ្ញើថ្មី។',
    },

    // Chat notifications
    NEW_MESSAGE: {
        title_en: 'New Message',
        title_km: 'សារថ្មី',
        message_en: 'You have a new message about your parcel.',
        message_km: 'អ្នកមានសារថ្មីអំពីបញ្ញើរបស់អ្នក។',
    },
};

type NotificationType = keyof typeof NotificationTemplates;

/**
 * Create a bilingual notification object
 * @param type - Notification type from NotificationTemplates
 * @param targetAudience - User ID or role to send to
 * @param dynamicMessage - Optional dynamic message with {en, km} texts
 * @param metadata - Optional metadata
 */
export function createBilingualNotification(
    type: NotificationType,
    targetAudience: string,
    dynamicMessage?: { en: string; km: string },
    metadata?: Record<string, any>
): BilingualNotification {
    const template = NotificationTemplates[type];

    const notification: BilingualNotification = {
        id: `notif-${type.toLowerCase()}-${Date.now()}`,
        targetAudience,
        title_en: template.title_en,
        title_km: template.title_km,
        message_en: dynamicMessage?.en || (template as any).message_en || '',
        message_km: dynamicMessage?.km || (template as any).message_km || '',
        // Legacy fields (use English as default)
        title: template.title_en,
        message: dynamicMessage?.en || (template as any).message_en || '',
        type: 'INFO',
        read: false,
        createdAt: Date.now(),
        metadata,
    };

    return notification;
}

/**
 * Helper to create dynamic message with receiver name
 */
export function formatDeliveredMessage(receiverName: string): { en: string; km: string } {
    return {
        en: `Your parcel to ${receiverName} has been delivered.`,
        km: `បញ្ញើរបស់អ្នកទៅ ${receiverName} បានដឹកជូនដោយជោគជ័យ។`,
    };
}

export function formatReturnedMessage(receiverName: string): { en: string; km: string } {
    return {
        en: `Your parcel to ${receiverName} is being returned to you.`,
        km: `បញ្ញើរបស់អ្នកទៅ ${receiverName} កំពុងត្រូវបានត្រឡប់មកវិញ។`,
    };
}

export function formatCodUpdatedByDriverMessage(receiverName: string, amount: string): { en: string; km: string } {
    return {
        en: `COD for parcel to ${receiverName} updated to ${amount} by driver.`,
        km: `COD សម្រាប់បញ្ញើទៅ ${receiverName} កែប្រែទៅ ${amount} ដោយអ្នកដឹក។`,
    };
}

export function formatCodUpdatedByCustomerMessage(receiverName: string, amount: string): { en: string; km: string } {
    return {
        en: `COD for parcel to ${receiverName} updated to ${amount} by customer.`,
        km: `COD សម្រាប់បញ្ញើទៅ ${receiverName} កែប្រែទៅ ${amount} ដោយអតិថិជន។`,
    };
}

export function formatWarehouseMessage(receiverName: string): { en: string; km: string } {
    return {
        en: `Your parcel to ${receiverName} has arrived at the warehouse.`,
        km: `បញ្ញើរបស់អ្នកទៅ ${receiverName} បានមកដល់ឃ្លាំងហើយ។`,
    };
}

export function formatNewBookingMessage(senderName: string, itemCount: number): { en: string; km: string } {
    return {
        en: `New booking from ${senderName} - ${itemCount} item(s)`,
        km: `ការកក់ថ្មីពី ${senderName} - ${itemCount} កញ្ចប់`,
    };
}
