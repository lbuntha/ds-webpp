import React, { useState } from 'react';
import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, where, getFirestore } from 'firebase/firestore';
import { db } from '../../shared/services/firebaseInstance'; // Default DB (Admin session)
import { env } from '../../config/env';
import { normalizePhone, getSyntheticEmail } from '../../shared/utils/phoneUtils';

// Types for Migration Data
interface MongoUser {
    _id: string;
    user_name?: string;
    phone?: string;
    phoneNumber?: string;
    full_name?: string;
    name?: string;
    type?: string;
    address_line?: string;
    referralCode?: string;
    joinedAt?: number;
    createdAt?: number;
    lastLogin?: number;
    isOnline?: boolean;
    photo?: string;
    lastLocation?: {
        latitude: number;
        longitude: number;
        timestamp?: number;
    };
    bank?: {
        account_number?: string;
        account_name?: string;
        bank_name?: string;
        qr_code?: string;
    };
}

interface MigrationStatus {
    phone: string;
    name: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXISTS' | 'SKIPPED';
    message?: string;
}

const DEFAULT_PIN = '123456';
const SECONDARY_APP_NAME = 'migrationApp';

const MigrationPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [sourceData, setSourceData] = useState<MongoUser[]>([]); // Full dataset
    const [users, setUsers] = useState<MongoUser[]>([]); // Displayed/Active dataset
    const [logs, setLogs] = useState<MigrationStatus[]>([]);
    const [isMigrating, setIsMigrating] = useState(false);
    const [progress, setProgress] = useState(0);

    // Filters
    const [limit, setLimit] = useState<number | ''>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Apply filters whenever sourceData, limit, or searchTerm changes
    React.useEffect(() => {
        if (sourceData.length === 0) return;

        let filtered = [...sourceData];

        // 1. Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
                (u.user_name || '').toLowerCase().includes(lowerTerm) ||
                (u.full_name || u.name || '').toLowerCase().includes(lowerTerm) ||
                (u.phone || u.phoneNumber || '').includes(searchTerm)
            );
        }

        // 2. Apply Limit (Top N)
        if (limit && typeof limit === 'number' && limit > 0) {
            filtered = filtered.slice(0, limit);
        }

        initializeMigrationState(filtered);

    }, [sourceData, limit, searchTerm]);

    const initializeMigrationState = (data: MongoUser[]) => {
        setUsers(data);
        setLogs(data.map(u => ({
            phone: u.user_name || u.phone || u.phoneNumber || 'Unknown',
            name: u.full_name || u.name || 'Unknown',
            status: 'PENDING'
        })));
        setProgress(0);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Reset everything
            setSourceData([]); // This triggers the effect to clear users/logs effectively
            setLimit('');
            setSearchTerm('');
            setUsers([]);
            setLogs([]);
            setProgress(0);
        }
    };

    const parseFile = async () => {
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                setSourceData(data); // This will trigger the useEffect to setUsers/logs
            } else {
                alert('Invalid JSON format. Expected an array of users.');
            }
        } catch (e) {
            alert('Error parsing JSON file.');
        }
    };

    const getSecondaryAuth = () => {
        let secondaryApp;
        const apps = getApps();
        const existingApp = apps.find(app => app.name === SECONDARY_APP_NAME);

        if (existingApp) {
            secondaryApp = existingApp;
        } else {
            secondaryApp = initializeApp(env.firebase, SECONDARY_APP_NAME);
        }

        return getAuth(secondaryApp);
    };

    const migrateUser = async (user: MongoUser, index: number) => {
        const phone = user.user_name || user.phone || user.phoneNumber || '';
        const name = user.full_name || user.name || 'Unknown User';
        const mongoId = user._id;

        if (!phone) {
            updateStatus(index, 'SKIPPED', 'Missing phone number');
            return;
        }

        const normalizedPhone = normalizePhone(phone);
        const email = getSyntheticEmail(normalizedPhone);

        try {
            const secondaryAuth = getSecondaryAuth();

            // 1. Create User in Auth (Secondary App)
            let uid;
            try {
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, DEFAULT_PIN);
                uid = userCredential.user.uid;
                await updateProfile(userCredential.user, { displayName: name });
            } catch (authErr: any) {
                if (authErr.code === 'auth/email-already-in-use') {
                    // Start: Handle existing user
                    updateStatus(index, 'EXISTS', 'User already exists in Auth. Attempting recovery...');

                    // Attempt 1: Try to Sign In with Default PIN to get UID
                    try {
                        const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, DEFAULT_PIN);
                        uid = signInCred.user.uid;
                        updateStatus(index, 'EXISTS', `Recovered UID via Sign In: ${uid}`);
                    } catch (signInErr) {
                        // If password changed or fails, fallback to Firestore lookup (admin)
                        console.warn('Sign In Recovery Failed:', signInErr);

                        // Attempt 2: Lookup by Phone in Firestore
                        const usersRef = collection(db, 'users');
                        // Try multiple variations
                        let q = query(usersRef, where('phone', '==', phone));
                        let snap = await getDocs(q);

                        // Local format
                        if (snap.empty && !phone.startsWith('0')) {
                            const localZero = '0' + phone;
                            q = query(usersRef, where('phone', '==', localZero));
                            snap = await getDocs(q);
                        }
                        // Global format
                        let phoneWithPrefix = phone;
                        if (phone.startsWith('0')) phoneWithPrefix = '+855' + phone.substring(1);
                        else if (!phone.startsWith('+')) phoneWithPrefix = '+855' + phone;

                        if (snap.empty) {
                            q = query(usersRef, where('phone', '==', phoneWithPrefix));
                            snap = await getDocs(q);
                        }

                        if (snap.empty) {
                            // Fallback to email lookup
                            q = query(usersRef, where('email', '==', email));
                            snap = await getDocs(q);
                        }

                        if (!snap.empty) {
                            uid = snap.docs[0].id;
                            updateStatus(index, 'EXISTS', `Found existing profile UID: ${uid}. Updating...`);
                        } else {
                            updateStatus(index, 'FAILED', 'Auth exists but Firestore profile not found. Cannot update.');
                            return;
                        }
                    }
                } else {
                    throw authErr;
                }
            }

            if (!uid) return;

            // 2. Create/Update Firestore Profile (Using Default Admin DB)
            const joinedAtVal = user.joinedAt || user.createdAt || Date.now();
            const lastLoginVal = user.lastLogin || Date.now();

            const userUpdates: any = {
                uid: uid,
                name: name,
                email: email,
                phone: normalizedPhone,
                role: 'customer',
                status: 'APPROVED',
                authMethod: 'phone',
                joinedAt: joinedAtVal,
                lastLogin: lastLoginVal,
                isOnline: !!user.isOnline,
                mongoId: mongoId,
                address: user.address_line || '',
                // Fields requested by user to match working template
                hasPin: true,
                created_date: new Date(joinedAtVal), // Store as Date/Timestamp
                updated_date: new Date(),
                // Ensure we don't overwrite critical fields if existing?
                // For migration, we might want to prioritize Mongo data or keep existing.
                // Let's use merge: true
            };

            if (user.photo) userUpdates.photo = user.photo;

            await setDoc(doc(db, 'users', uid), userUpdates, { merge: true });

            // 3. Create/Update Customer Profile
            let customerId;
            const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));

            if (!userSnap.empty) {
                customerId = userSnap.docs[0].data().linkedCustomerId;
            }

            if (!customerId) {
                const newCustomerRef = doc(collection(db, 'customers'));
                customerId = newCustomerRef.id;
                // Link it back to user immediately
                await setDoc(doc(db, 'users', uid), { linkedCustomerId: customerId }, { merge: true });
            }

            // Prepare Customer Data
            const customerUpdates: any = {
                id: customerId,
                name: name,
                email: email,
                phone: normalizedPhone,
                status: 'ACTIVE',
                linkedUserId: uid,
                createdAt: joinedAtVal,
                mongoId: mongoId,
                address: user.address_line || '',
                referralCode: user.referralCode || '',
            };

            if (user.photo) customerUpdates.photo = user.photo;

            if (user.lastLocation && user.lastLocation.latitude && user.lastLocation.longitude) {
                const loc = {
                    name: 'Last Known Location',
                    address: user.address_line || 'Unknown Address',
                    lat: user.lastLocation.latitude,
                    lng: user.lastLocation.longitude,
                    timestamp: user.lastLocation.timestamp || Date.now()
                };
                customerUpdates.savedLocations = [loc];
            }

            // Map Bank Account Info (Array format)
            if (user.bank) {
                customerUpdates.bankAccounts = [{
                    id: 'default',
                    bankName: user.bank.bank_name || '',
                    accountName: user.bank.account_name || '',
                    accountNumber: user.bank.account_number || '',
                    qrCode: user.bank.qr_code || ''
                }];
            }

            // Perform Update/Create
            // Note: If document doesn't exist, this counts as CREATE (allowed for authenticated).
            // If it exists, it counts as UPDATE (requires admin/finance role).
            // We use merge: true to be safe for re-runs.
            await setDoc(doc(db, 'customers', customerId), customerUpdates, { merge: true });

            updateStatus(index, 'SUCCESS', 'Migrated successfully');

        } catch (err: any) {
            console.error('Migration Error:', err);
            updateStatus(index, 'FAILED', err.message);
        }
    };

    const updateStatus = (index: number, status: MigrationStatus['status'], message?: string) => {
        setLogs(prev => {
            const newLogs = [...prev];
            newLogs[index] = { ...newLogs[index], status, message };
            return newLogs;
        });
    };

    const startMigration = async () => {
        if (users.length === 0) return;
        setIsMigrating(true);

        let processed = 0;

        // Process sequentially to avoid rate limits
        for (let i = 0; i < users.length; i++) {
            await migrateUser(users[i], i);
            processed++;
            setProgress(Math.round((processed / users.length) * 100));
        }

        setIsMigrating(false);
        alert('Migration Complete!');

        // Clean up secondary app
        const app = getApps().find(app => app.name === SECONDARY_APP_NAME);
        if (app) deleteApp(app);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Migration Dashboard (MongoDB to Firebase)</h1>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Select users.json</label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            className="block w-full border rounded p-2"
                        />
                    </div>
                </div>

                {/* Filters */}
                {sourceData.length > 0 && (
                    <div className="flex gap-4 items-end bg-gray-50 p-4 rounded border">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">Search (Name/Phone)</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                disabled={isMigrating}
                                placeholder="Filter by name or phone..."
                                className="block w-full border rounded p-2"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-sm font-medium mb-1">Limit (Top N)</label>
                            <input
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value) : '')}
                                disabled={isMigrating}
                                placeholder="All"
                                className="block w-full border rounded p-2"
                            />
                        </div>
                        <div className="flex-none pb-2 text-sm text-gray-600 font-medium">
                            Showing {users.length} of {sourceData.length} users
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        onClick={parseFile}
                        disabled={!file || isMigrating}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        Reload Data
                    </button>
                    <button
                        onClick={startMigration}
                        disabled={users.length === 0 || isMigrating}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                        {isMigrating ? 'Migrating...' : `Start Migration (${users.length})`}
                    </button>
                </div>

                {isMigrating && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>

            {users.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="max-h-[600px] overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Info</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined At</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mongo ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.map((log, idx) => {
                                    const user = users[idx]; // Access original user data
                                    return (
                                        <tr key={idx} className={
                                            log.status === 'SUCCESS' ? 'bg-green-50' :
                                                log.status === 'FAILED' ? 'bg-red-50' :
                                                    log.status === 'EXISTS' ? 'bg-yellow-50' : ''
                                        }>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                                                {user?.photo && <img src={user.photo} alt="" className="w-8 h-8 rounded-full object-cover" />}
                                                {log.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.phone}</td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user?.bank ? (
                                                    <div className="text-xs">
                                                        <div className="font-bold">{user.bank.bank_name}</div>
                                                        <div>{user.bank.account_number}</div>
                                                        <div className="text-gray-400">{user.bank.account_name}</div>
                                                    </div>
                                                ) : '-'}
                                            </td>

                                            {/* Details Columns */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]" title={user?.address_line}>
                                                {user?.address_line || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user?.referralCode || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(user?.joinedAt || user?.createdAt) ? new Date(user?.joinedAt || user?.createdAt!).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-xs">
                                                {user?.lastLocation ? `${user.lastLocation.latitude.toFixed(4)}, ${user.lastLocation.longitude.toFixed(4)}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono text-xs">
                                                {user?._id}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                                        log.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                                            log.status === 'EXISTS' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{log.message}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MigrationPage;
