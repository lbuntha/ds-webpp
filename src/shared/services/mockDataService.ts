import { IDataService } from '../types';

// DEPRECATED: This service is no longer used. The app is now strictly coupled to Firebase.
export class MockDataService implements IDataService {
  constructor() {
    throw new Error("MockDataService is deprecated. Use FirebaseService.");
  }
  // @ts-ignore
  getAccounts() { throw new Error("Deprecated"); }
  // @ts-ignore
  getBranches() { throw new Error("Deprecated"); }
  // @ts-ignore
  getTransactions() { throw new Error("Deprecated"); }
  // @ts-ignore
  addTransaction() { throw new Error("Deprecated"); }
}

export const mockDataService = new MockDataService();