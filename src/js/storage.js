/**
 * Storage Module for Offline Pay
 * Manages persistent local transactions in localStorage
 */

const STORAGE_KEY = 'offline_pay_transactions_v1';

export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getInitialSeedTransactions();
  } catch (err) {
    console.error('Failed to read transactions from storage:', err);
    return [];
  }
}

export function saveTransaction(tx) {
  try {
    const transactions = getTransactions();
    transactions.unshift(tx); // Newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return tx;
  } catch (err) {
    console.error('Failed to save transaction:', err);
    return null;
  }
}

export function updateTransactionStatus(txId, status) {
  try {
    const transactions = getTransactions();
    const idx = transactions.findIndex(t => t.id === txId);
    if (idx !== -1) {
      transactions[idx].status = status;
      transactions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return transactions[idx];
    }
  } catch (err) {
    console.error('Failed to update transaction:', err);
  }
  return null;
}

export function clearTransactions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear storage:', err);
  }
}

export function generateTxId() {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `TXN-99-${randomNum}`;
}

function getInitialSeedTransactions() {
  return [
    {
      id: 'TXN-99-842109',
      date: new Date(Date.now() - 3600000 * 2).toISOString(),
      payee: 'Sharma General Store',
      upi: 'sharma@upi',
      amount: 350,
      method: 'USSD (*99#)',
      note: 'Groceries & Milk',
      status: 'PAID'
    },
    {
      id: 'TXN-99-721045',
      date: new Date(Date.now() - 3600000 * 24).toISOString(),
      payee: 'City Fuel Station',
      upi: 'fuel@okaxis',
      amount: 1200,
      method: 'USSD (*99#)',
      note: 'Petrol Fill',
      status: 'PAID'
    }
  ];
}
