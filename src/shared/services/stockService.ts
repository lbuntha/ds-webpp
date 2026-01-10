import { CustomerStock, CustomerStockItem, StockTransaction, StockTransactionType, CustomerProduct, StockRequest, StockRequestItem } from '../types';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, storage } from './firebaseInstance';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * StockService - Manages customer product stock at doorstep locations
 * 
 * Key Features:
 * - Multi-branch stock support (customers can have stock at multiple doorsteps)
 * - Reserve stock when booking is created
 * - Deduct stock when item status → DELIVERED
 * - Release reserved stock on booking cancellation
 */
class StockService {
    private stockCollection = 'customerStocks';
    private transactionCollection = 'stockTransactions';

    // Helper: Generate unique ID
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Helper: Upload image to storage
    async uploadImage(base64Data: string): Promise<string> {
        try {
            const path = `stock-images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const storageRef = ref(storage, path);
            await uploadString(storageRef, base64Data, 'data_url');
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error("Image upload failed", e);
            return base64Data; // Return original if upload fails
        }
    }

    // Helper: Remove undefined values from object (Firestore doesn't accept undefined)
    private cleanData<T extends object>(obj: T): T {
        const cleaned = {} as T;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        (cleaned as any)[key] = value.map(item =>
                            typeof item === 'object' && item !== null ? this.cleanData(item) : item
                        );
                    } else if (typeof value === 'object' && value !== null) {
                        (cleaned as any)[key] = this.cleanData(value as object);
                    } else {
                        (cleaned as any)[key] = value;
                    }
                }
            }
        }
        return cleaned;
    }

    // =====================
    // STOCK RETRIEVAL
    // =====================

    /**
     * Get customer stock for a specific branch or all branches
     */
    async getCustomerStock(customerId: string, branchId?: string): Promise<CustomerStock[]> {
        if (branchId) {
            // Get specific branch stock
            const stockId = `${customerId}_${branchId}`;
            const docRef = doc(db, this.stockCollection, stockId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return [{ id: snapshot.id, ...snapshot.data() } as CustomerStock];
            }
            return [];
        }

        // Get all branches for this customer
        const q = query(
            collection(db, this.stockCollection),
            where('customerId', '==', customerId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomerStock));
    }

    /**
     * Get all customer stocks at a specific branch (for warehouse view)
     */
    async getStocksByBranch(branchId: string): Promise<CustomerStock[]> {
        const q = query(
            collection(db, this.stockCollection),
            where('branchId', '==', branchId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomerStock));
    }

    /**
     * Get a specific stock item
     */
    async getStockItem(customerId: string, branchId: string, itemId: string): Promise<CustomerStockItem | null> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;

        const stock = snapshot.data() as CustomerStock;
        return stock.items.find(i => i.id === itemId) || null;
    }

    // =====================
    // STOCK DEPOSITS
    // =====================

    /**
     * Deposit stock when customer brings products to doorstep
     * Called by warehouse staff
     */
    async depositStock(
        customerId: string,
        customerName: string,
        branchId: string,
        branchName: string,
        items: Omit<CustomerStockItem, 'id' | 'createdAt' | 'updatedAt' | 'reservedQuantity'>[],
        createdBy: string,
        createdByName: string,
        notes?: string
    ): Promise<void> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);
        const now = Date.now();

        // Prepare new items with IDs (clean undefined values)
        const newItems: CustomerStockItem[] = items.map(item => this.cleanData({
            productName: item.productName,
            quantity: item.quantity,
            sku: item.sku,
            unitPrice: item.unitPrice,
            image: item.image,
            productId: item.productId, // Link to product catalog
            unitPriceCurrency: item.unitPriceCurrency,

            description: item.description,
            id: this.generateId(),
            reservedQuantity: 0,
            createdAt: now,
            updatedAt: now
        }));

        if (snapshot.exists()) {
            // Update existing stock
            const existingStock = snapshot.data() as CustomerStock;
            const updatedItems = [...existingStock.items, ...newItems];
            const totalItemCount = updatedItems.reduce((sum, i) => sum + i.quantity, 0);

            await updateDoc(docRef, {
                items: updatedItems,
                totalItemCount,
                lastUpdated: now
            });
        } else {
            // Create new stock document
            const totalItemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
            const newStock = this.cleanData({
                id: stockId,
                customerId,
                customerName,
                branchId,
                branchName,
                items: newItems,
                totalItemCount,
                lastUpdated: now
            });
            await setDoc(doc(db, this.stockCollection, stockId), newStock);
        }

        // Record transaction
        await this.recordTransaction({
            customerId,
            customerName,
            branchId,
            branchName,
            type: 'DEPOSIT',
            items: newItems.map(i => ({
                stockItemId: i.id,
                productName: i.productName,
                quantityChange: i.quantity
            })),
            notes,
            createdBy,
            createdByName
        });
    }

    // =====================
    // STOCK RESERVATION (Booking Flow)
    // =====================

    /**
     * Reserve stock when a booking is created
     * Locks the quantity so it can't be used by other bookings
     */
    async reserveStock(
        customerId: string,
        branchId: string,
        reservations: { stockItemId: string; quantity: number }[],
        bookingId: string,
        createdBy: string,
        createdByName: string
    ): Promise<{ success: boolean; error?: string }> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            return { success: false, error: 'Stock not found' };
        }

        const stock = snapshot.data() as CustomerStock;
        const updatedItems = [...stock.items];
        const transactionItems: { stockItemId: string; productName: string; quantityChange: number }[] = [];

        // Validate and update each reservation
        for (const res of reservations) {
            const itemIndex = updatedItems.findIndex(i => i.id === res.stockItemId);
            if (itemIndex === -1) {
                return { success: false, error: `Stock item ${res.stockItemId} not found` };
            }

            const item = updatedItems[itemIndex];
            const availableQty = item.quantity - item.reservedQuantity;

            if (res.quantity > availableQty) {
                return {
                    success: false,
                    error: `Insufficient stock for ${item.productName}. Available: ${availableQty}, Requested: ${res.quantity}`
                };
            }

            // Reserve the quantity
            updatedItems[itemIndex] = {
                ...item,
                reservedQuantity: item.reservedQuantity + res.quantity,
                updatedAt: Date.now()
            };

            transactionItems.push({
                stockItemId: item.id,
                productName: item.productName,
                quantityChange: -res.quantity // Negative because it's reserved
            });
        }

        // Update stock
        await updateDoc(docRef, {
            items: updatedItems,
            lastUpdated: Date.now()
        });

        // Record transaction
        await this.recordTransaction({
            customerId,
            customerName: stock.customerName,
            branchId,
            branchName: stock.branchName,
            type: 'BOOKING_RESERVE',
            items: transactionItems,
            relatedBookingId: bookingId,
            createdBy,
            createdByName
        });

        return { success: true };
    }

    /**
     * Confirm stock deduction when item is DELIVERED
     * Converts reserved quantity to actual deduction
     */
    async confirmDelivery(
        customerId: string,
        branchId: string,
        reservations: { stockItemId: string; quantity: number }[],
        bookingId: string,
        itemId: string,
        createdBy: string,
        createdByName: string
    ): Promise<{ success: boolean; error?: string }> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            return { success: false, error: 'Stock not found' };
        }

        const stock = snapshot.data() as CustomerStock;
        const updatedItems = [...stock.items];
        const transactionItems: { stockItemId: string; productName: string; quantityChange: number }[] = [];

        for (const res of reservations) {
            const itemIndex = updatedItems.findIndex(i => i.id === res.stockItemId);
            if (itemIndex === -1) continue;

            const item = updatedItems[itemIndex];

            // Deduct from both quantity and reserved
            updatedItems[itemIndex] = {
                ...item,
                quantity: item.quantity - res.quantity,
                reservedQuantity: Math.max(0, item.reservedQuantity - res.quantity),
                updatedAt: Date.now()
            };

            transactionItems.push({
                stockItemId: item.id,
                productName: item.productName,
                quantityChange: -res.quantity
            });
        }

        // Remove items with zero quantity
        const filteredItems = updatedItems.filter(i => i.quantity > 0);
        const totalItemCount = filteredItems.reduce((sum, i) => sum + i.quantity, 0);

        await updateDoc(docRef, {
            items: filteredItems,
            totalItemCount,
            lastUpdated: Date.now()
        });

        // Record transaction
        await this.recordTransaction({
            customerId,
            customerName: stock.customerName,
            branchId,
            branchName: stock.branchName,
            type: 'BOOKING_DELIVERED',
            items: transactionItems,
            relatedBookingId: bookingId,
            relatedItemId: itemId,
            createdBy,
            createdByName
        });

        return { success: true };
    }

    /**
     * Release reserved stock when booking is cancelled
     */
    async releaseReservation(
        customerId: string,
        branchId: string,
        reservations: { stockItemId: string; quantity: number }[],
        bookingId: string,
        createdBy: string,
        createdByName: string
    ): Promise<{ success: boolean; error?: string }> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            return { success: false, error: 'Stock not found' };
        }

        const stock = snapshot.data() as CustomerStock;
        const updatedItems = [...stock.items];
        const transactionItems: { stockItemId: string; productName: string; quantityChange: number }[] = [];

        for (const res of reservations) {
            const itemIndex = updatedItems.findIndex(i => i.id === res.stockItemId);
            if (itemIndex === -1) continue;

            const item = updatedItems[itemIndex];

            // Release reserved quantity
            updatedItems[itemIndex] = {
                ...item,
                reservedQuantity: Math.max(0, item.reservedQuantity - res.quantity),
                updatedAt: Date.now()
            };

            transactionItems.push({
                stockItemId: item.id,
                productName: item.productName,
                quantityChange: res.quantity // Positive because it's released
            });
        }

        await updateDoc(docRef, {
            items: updatedItems,
            lastUpdated: Date.now()
        });

        // Record transaction
        await this.recordTransaction({
            customerId,
            customerName: stock.customerName,
            branchId,
            branchName: stock.branchName,
            type: 'BOOKING_CANCELLED',
            items: transactionItems,
            relatedBookingId: bookingId,
            createdBy,
            createdByName
        });

        return { success: true };
    }

    // =====================
    // STOCK ADJUSTMENTS
    // =====================

    /**
     * Manual stock adjustment (for corrections, damages, etc.)
     */
    async adjustStock(
        customerId: string,
        branchId: string,
        itemId: string,
        adjustment: number, // Positive to add, negative to subtract
        reason: string,
        createdBy: string,
        createdByName: string
    ): Promise<{ success: boolean; error?: string }> {
        const stockId = `${customerId}_${branchId}`;
        const docRef = doc(db, this.stockCollection, stockId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            return { success: false, error: 'Stock not found' };
        }

        const stock = snapshot.data() as CustomerStock;
        const itemIndex = stock.items.findIndex(i => i.id === itemId);

        if (itemIndex === -1) {
            return { success: false, error: 'Item not found' };
        }

        const item = stock.items[itemIndex];
        const newQuantity = item.quantity + adjustment;

        if (newQuantity < 0) {
            return { success: false, error: 'Adjustment would result in negative stock' };
        }

        const updatedItems = [...stock.items];
        updatedItems[itemIndex] = {
            ...item,
            quantity: newQuantity,
            updatedAt: Date.now()
        };

        // Remove items with zero quantity
        const filteredItems = updatedItems.filter(i => i.quantity > 0);
        const totalItemCount = filteredItems.reduce((sum, i) => sum + i.quantity, 0);

        await updateDoc(docRef, {
            items: filteredItems,
            totalItemCount,
            lastUpdated: Date.now()
        });

        // Record transaction
        await this.recordTransaction({
            customerId,
            customerName: stock.customerName,
            branchId,
            branchName: stock.branchName,
            type: 'ADJUSTMENT',
            items: [{
                stockItemId: item.id,
                productName: item.productName,
                quantityChange: adjustment
            }],
            notes: reason,
            createdBy,
            createdByName
        });

        return { success: true };
    }

    // =====================
    // TRANSACTIONS / HISTORY
    // =====================

    /**
     * Get stock transactions for a customer or branch
     */
    async getStockTransactions(
        customerId?: string,
        branchId?: string,
        limitCount: number = 100
    ): Promise<StockTransaction[]> {
        let q;

        if (customerId && branchId) {
            q = query(
                collection(db, this.transactionCollection),
                where('customerId', '==', customerId),
                where('branchId', '==', branchId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        } else if (customerId) {
            q = query(
                collection(db, this.transactionCollection),
                where('customerId', '==', customerId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        } else if (branchId) {
            q = query(
                collection(db, this.transactionCollection),
                where('branchId', '==', branchId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        } else {
            q = query(
                collection(db, this.transactionCollection),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockTransaction));
    }

    // =====================
    // REPORTS
    // =====================

    /**
     * Get items with low stock (below threshold)
     */
    async getLowStockItems(branchId?: string, threshold: number = 10): Promise<{
        customerId: string;
        customerName: string;
        branchId: string;
        branchName: string;
        item: CustomerStockItem;
        availableQuantity: number;
    }[]> {
        const stocks = branchId
            ? await this.getStocksByBranch(branchId)
            : await this.getAllStocks();

        const lowStockItems: {
            customerId: string;
            customerName: string;
            branchId: string;
            branchName: string;
            item: CustomerStockItem;
            availableQuantity: number;
        }[] = [];

        for (const stock of stocks) {
            for (const item of stock.items) {
                const available = item.quantity - item.reservedQuantity;
                if (available <= threshold) {
                    lowStockItems.push({
                        customerId: stock.customerId,
                        customerName: stock.customerName,
                        branchId: stock.branchId,
                        branchName: stock.branchName,
                        item,
                        availableQuantity: available
                    });
                }
            }
        }

        return lowStockItems.sort((a, b) => a.availableQuantity - b.availableQuantity);
    }

    /**
     * Get all stocks (for admin reports)
     */
    private async getAllStocks(): Promise<CustomerStock[]> {
        const snapshot = await getDocs(collection(db, this.stockCollection));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomerStock));
    }

    // =====================
    // HELPERS
    // =====================

    private async recordTransaction(data: Omit<StockTransaction, 'id' | 'createdAt'>): Promise<void> {
        const transaction: StockTransaction = {
            ...data,
            id: this.generateId(),
            createdAt: Date.now()
        };
        await setDoc(doc(db, this.transactionCollection, transaction.id), transaction);
    }

    // =====================
    // PRODUCT CATALOG
    // =====================

    private productCollection = 'customerProducts';
    private requestCollection = 'stockRequests';
    private notificationCollection = 'notifications';

    // Helper to create notification
    private async createNotification(userId: string, title: string, message: string, type: string = 'INFO') {
        try {
            await addDoc(collection(db, this.notificationCollection), {
                userId,
                title,
                message,
                read: false,
                createdAt: Date.now(),
                type
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    /**
     * Get customer's product catalog
     */
    async getCustomerProducts(customerId: string): Promise<CustomerProduct[]> {
        const q = query(
            collection(db, this.productCollection),
            where('customerId', '==', customerId)
        );
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomerProduct));
        // Sort client-side to avoid needing Firestore composite index
        return products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    /**
     * Save a product to customer's catalog
     */
    async saveProduct(product: CustomerProduct): Promise<void> {
        const cleaned = this.cleanData(product);
        await setDoc(doc(db, this.productCollection, product.id), cleaned);
    }

    /**
     * Delete a product from catalog
     */
    async deleteProduct(productId: string): Promise<void> {
        const { deleteDoc, getDoc } = await import('firebase/firestore');

        // Find product first to check stock
        const prodRef = doc(db, this.productCollection, productId);
        const prodSnap = await getDoc(prodRef);

        if (prodSnap.exists()) {
            const product = prodSnap.data() as CustomerProduct;

            // Allow deletion only if NO stock exists
            const hasStock = await this.hasStockForProduct(product.customerId, productId, product.productName);
            if (hasStock) {
                throw new Error('Cannot delete product because it has active stock.');
            }
        }

        await deleteDoc(doc(db, this.productCollection, productId));
    }

    /**
     * Check if product has any positive stock
     */
    async hasStockForProduct(customerId: string, productId: string, productName: string): Promise<boolean> {
        // Query all stocks for this customer
        const q = query(
            collection(db, this.stockCollection),
            where('customerId', '==', customerId)
        );
        const snapshot = await getDocs(q);

        for (const doc of snapshot.docs) {
            const stock = doc.data() as CustomerStock;
            // Check if items contains this product with quantity > 0
            // Check by ID (preferred) or Name (fallback for legacy stock)
            const item = stock.items.find(i =>
                (i.productId === productId || i.productName === productName) &&
                i.quantity > 0
            );

            if (item) return true;
        }
        return false;
    }

    // =====================
    // STOCK REQUESTS
    // =====================

    /**
     * Create a new stock request
     */
    async createStockRequest(request: StockRequest): Promise<void> {
        const cleaned = this.cleanData(request);
        await setDoc(doc(db, this.requestCollection, request.id), cleaned);
    }

    /**
     * Get customer's stock requests
     */
    async getCustomerRequests(customerId: string): Promise<StockRequest[]> {
        const q = query(
            collection(db, this.requestCollection),
            where('customerId', '==', customerId)
        );
        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest));
        // Sort client-side to avoid needing Firestore composite index
        return requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    /**
     * Get pending requests for a branch (for warehouse)
     */
    async getPendingRequests(branchId?: string): Promise<StockRequest[]> {
        const q = query(
            collection(db, this.requestCollection),
            where('status', 'in', ['PENDING', 'APPROVED'])
        );
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest));

        // Filter by branch if specified
        if (branchId) {
            requests = requests.filter(r => r.branchId === branchId);
        }

        // Sort client-side to avoid needing Firestore composite index
        return requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    /**
     * Approve a stock request
     */
    async approveRequest(
        requestId: string,
        customerId: string,
        reviewedBy: string,
        reviewedByName: string,
        updatedItems?: StockRequestItem[]
    ): Promise<void> {
        const updates: any = {
            status: 'APPROVED',
            reviewedAt: Date.now(),
            reviewedBy,
            reviewedByName
        };

        if (updatedItems) {
            updates.items = updatedItems;

            // Check for discrepancies
            const hasDiscrepancy = updatedItems.some(item =>
                item.actualQuantity !== undefined && item.actualQuantity !== item.quantity
            );

            if (hasDiscrepancy) {
                await this.createNotification(
                    customerId,
                    'Stock Request Adjustment',
                    'Your stock request has been approved with quantity adjustments. Please check the details.',
                    'WARNING'
                );
            } else {
                await this.createNotification(
                    customerId,
                    'Stock Request Approved',
                    'Your stock request has been approved and is ready for delivery/drop-off.',
                    'SUCCESS'
                );
            }
        } else {
            await this.createNotification(
                customerId,
                'Stock Request Approved',
                'Your stock request has been approved and is ready for delivery/drop-off.',
                'SUCCESS'
            );
        }

        await updateDoc(doc(db, this.requestCollection, requestId), updates);
    }

    /**
     * Reject a stock request
     */
    async rejectRequest(
        requestId: string,
        rejectionReason: string,
        reviewedBy: string,
        reviewedByName: string
    ): Promise<void> {
        await updateDoc(doc(db, this.requestCollection, requestId), {
            status: 'REJECTED',
            rejectionReason,
            reviewedAt: Date.now(),
            reviewedBy,
            reviewedByName
        });
    }

    /**
     * Mark request as received and deposit stock
     */
    async receiveRequest(
        request: StockRequest,
        receivedBy: string,
        receivedByName: string
    ): Promise<void> {
        // Deposit the stock (use actualQuantity if verified, otherwise requested quantity)
        await this.depositStock(
            request.customerId,
            request.customerName,
            request.branchId,
            request.branchName,
            request.items.map(item => ({
                productName: item.productName,
                quantity: item.actualQuantity ?? item.quantity,
                sku: item.sku,
                unitPrice: item.unitPrice,
                image: item.image,
                productId: item.productId
            })),
            receivedBy,
            receivedByName,
            `Stock Request Deposit (${request.id})`
        );

        // Update request status
        await updateDoc(doc(db, this.requestCollection, request.id), {
            status: 'RECEIVED',
            receivedAt: Date.now(),
            receivedBy,
            receivedByName
        });
    }

    /**
     * Cancel a pending request (by customer)
     */
    async cancelRequest(requestId: string): Promise<void> {
        await updateDoc(doc(db, this.requestCollection, requestId), {
            status: 'CANCELLED'
        });
    }
}

export const stockService = new StockService();
