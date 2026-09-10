/**
 * IndexedDB Database Layer for Offline Pay
 * Store Name: OfflinePayDB_v2
 */

const DB_NAME = 'OfflinePayDB_v2';
const DB_VERSION = 1;

let dbInstance = null;

export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB Error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Transactions Store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('status', 'status', { unique: false });
        txStore.createIndex('customerId', 'customerId', { unique: false });
        txStore.createIndex('method', 'method', { unique: false });
      }

      // 2. Customers Store (Khata Ledger)
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('phone', 'phone', { unique: true });
        custStore.createIndex('name', 'name', { unique: false });
      }

      // 3. Merchant Profile Store
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'key' });
      }

      // 4. Settings Store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

/* --- TRANSACTIONS API --- */

export async function getAllTransactions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const req = store.getAll();

    req.onsuccess = () => {
      // Sort newest first
      const res = req.result || [];
      res.sort((a, b) => new Date(b.date) - new Date(a.date));
      resolve(res);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveTransactionDB(transaction) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'customers'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const custStore = tx.objectStore('customers');

    txStore.put(transaction);

    // If transaction linked to a customer, update customer total balance
    if (transaction.customerId && transaction.status === 'PAID') {
      const custReq = custStore.get(transaction.customerId);
      custReq.onsuccess = () => {
        const customer = custReq.result;
        if (customer) {
          customer.totalPaid = (customer.totalPaid || 0) + parseFloat(transaction.amount);
          customer.lastTransactionDate = transaction.date;
          custStore.put(customer);
        }
      };
    }

    tx.oncomplete = () => resolve(transaction);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllTransactionsDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/* --- CUSTOMERS API --- */

export async function getAllCustomers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomerDB(customer) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    const req = store.put(customer);
    req.onsuccess = () => resolve(customer);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCustomerDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/* --- PROFILE & SETTINGS API --- */

export async function getMerchantProfile() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('profile', 'readonly');
    const store = tx.objectStore('profile');
    const req = store.get('merchant');
    req.onsuccess = () => {
      resolve(req.result?.value || getDefaultProfile());
    };
    req.onerror = () => resolve(getDefaultProfile());
  });
}

export async function saveMerchantProfile(profileData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profile', 'readwrite');
    const store = tx.objectStore('profile');
    const req = store.put({ key: 'merchant', value: profileData });
    req.onsuccess = () => resolve(profileData);
    req.onerror = () => reject(req.error);
  });
}

export async function getSetting(key, defaultValue = null) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = () => resolve(defaultValue);
  });
}

export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

export function generateTxId() {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `TXN-99-${randomNum}`;
}


/* --- DATABASE RESTORE & SEED --- */

export async function restoreDatabaseSnapshot(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'customers', 'profile', 'settings'], 'readwrite');
    
    if (data.transactions && Array.isArray(data.transactions)) {
      const txStore = tx.objectStore('transactions');
      txStore.clear();
      data.transactions.forEach(item => txStore.put(item));
    }

    if (data.customers && Array.isArray(data.customers)) {
      const custStore = tx.objectStore('customers');
      custStore.clear();
      data.customers.forEach(item => custStore.put(item));
    }

    if (data.profile) {
      tx.objectStore('profile').put({ key: 'merchant', value: data.profile });
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function seedInitialDataIfEmpty() {
  const txs = await getAllTransactions();
  if (txs.length === 0) {
    const seedTxs = [
      {
        id: 'TXN-99-902184',
        date: new Date(Date.now() - 3600000 * 3).toISOString(),
        payee: 'Sharma General Store',
        upi: 'sharma@upi',
        amount: 450,
        method: 'USSD (*99#)',
        note: 'Monthly Supplies',
        status: 'PAID'
      },
      {
        id: 'TXN-99-410293',
        date: new Date(Date.now() - 3600000 * 26).toISOString(),
        payee: 'City Milk Depot',
        upi: 'milk@okicici',
        amount: 220,
        method: 'UPI QR',
        note: 'Fresh Milk',
        status: 'PAID'
      }
    ];

    for (const t of seedTxs) {
      await saveTransactionDB(t);
    }

    const seedCusts = [
      { id: 'CUST-101', name: 'Rahul Sharma', phone: '9876543210', totalPaid: 450, dueBalance: 0 },
      { id: 'CUST-102', name: 'Anik Gupta', phone: '9123456789', totalPaid: 0, dueBalance: 150 }
    ];

    for (const c of seedCusts) {
      await saveCustomerDB(c);
    }
  }
}

function getDefaultProfile() {
  return {
    businessName: 'My Retail Store',
    payeeUpi: 'merchant@upi',
    phone: '9876543210',
    gstin: '27AAAAA0000A1Z5',
    address: 'Shop 12, Main Market, Mumbai',
    simCarrier: 'Airtel' // 'Airtel' | 'VI' | 'BSNL' | 'Jio'
  };
}
