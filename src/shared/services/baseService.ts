
import { Firestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { FirebaseStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

export class BaseService {
    constructor(protected db: Firestore, protected storage: FirebaseStorage) { }

    protected cleanData(data: any): any {
        const seen = new WeakSet();

        const clone = (obj: any): any => {
            if (obj === null || obj === undefined) return null;

            const type = typeof obj;

            // Functions and Symbols cannot be saved to Firestore
            if (type === 'function' || type === 'symbol') return undefined;

            // Primitives
            if (type !== 'object') return obj;

            // Date -> String
            if (obj instanceof Date) return obj.toISOString();

            // Guard against DOM Nodes / React Synthetic Events / Window
            if (obj.nodeType || obj === window || obj instanceof window.HTMLElement || obj._reactName || (obj.nativeEvent && obj.target)) {
                return undefined;
            }

            // Guard against Leaflet objects (Maps, Layers, Icons often have this internal ID)
            if (obj._leaflet_id !== undefined) {
                return undefined;
            }

            // Circular reference check
            if (seen.has(obj)) return undefined;
            seen.add(obj);

            // Arrays
            if (Array.isArray(obj)) {
                return obj.map(v => clone(v)).filter(v => v !== undefined);
            }

            // Handle Complex Instances
            const proto = Object.getPrototypeOf(obj);
            if (proto && proto !== Object.prototype) {
                // If object has a toJSON method, use it (e.g. some libraries)
                if (typeof obj.toJSON === 'function') {
                    return obj.toJSON();
                }
                // Only allow plain objects. Discard class instances to avoid circular structures.
                return undefined;
            }

            // Objects
            const res: any = {};
            for (const key in obj) {
                // Guard against internal keys, unsafe keys, or prototype pollution
                if (key.startsWith('__') || key.startsWith('$') || key === 'constructor' || key === 'prototype') continue;

                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    try {
                        const val = clone(obj[key]);
                        if (val !== undefined) {
                            res[key] = val;
                        }
                    } catch (e) {
                        // ignore access errors
                    }
                }
            }

            return res;
        };

        return clone(data);
    }

    async uploadAttachment(base64Data: string): Promise<string> {
        try {
            const path = `uploads/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const storageRef = ref(this.storage, path);
            await uploadString(storageRef, base64Data, 'data_url');
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error("Upload failed", e);
            return base64Data;
        }
    }

    async saveDocument(collectionName: string, data: any, merge: boolean = false) {
        const cleaned = this.cleanData(data);
        // Ensure we have a valid object to save
        if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
            throw new Error("Invalid data format for saving. Must be an object.");
        }
        // Double check ID
        if (!cleaned.id) {
            throw new Error("Document must have an ID.");
        }

        await setDoc(doc(this.db, collectionName, cleaned.id), cleaned, { merge });
    }

    async getCollection<T>(collectionName: string): Promise<T[]> {
        const snap = await getDocs(collection(this.db, collectionName));
        return snap.docs.map(d => d.data() as T);
    }

    async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
        const snap = await getDoc(doc(this.db, collectionName, id));
        return snap.exists() ? snap.data() as T : null;
    }

    async deleteDocument(collectionName: string, id: string) {
        await deleteDoc(doc(this.db, collectionName, id));
    }
}
