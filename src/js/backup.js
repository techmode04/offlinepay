/**
 * CSV Export & JSON Database Backup/Restore Module
 */

import { getAllTransactions, getAllCustomers, getMerchantProfile, restoreDatabaseSnapshot } from './db.js';

/**
 * Export Transactions as CSV File
 */
export async function exportTransactionsToCSV() {
  const transactions = await getAllTransactions();
  if (transactions.length === 0) {
    return { success: false, message: 'No transactions found to export.' };
  }

  const headers = ['Transaction ID', 'Date & Time', 'Payee Name', 'UPI ID', 'Amount (INR)', 'Method', 'Note', 'Status'];
  const rows = transactions.map(tx => [
    `"${tx.id}"`,
    `"${new Date(tx.date).toLocaleString('en-IN')}"`,
    `"${escapeQuotes(tx.payee)}"`,
    `"${escapeQuotes(tx.upi || '')}"`,
    tx.amount,
    `"${tx.method}"`,
    `"${escapeQuotes(tx.note || '')}"`,
    `"${tx.status}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `OfflinePay_Transactions_${getTimestampStr()}.csv`);

  return { success: true, message: `Exported ${transactions.length} transactions to CSV.` };
}

/**
 * Export Full Database JSON Backup
 */
export async function exportDatabaseBackupJSON() {
  const transactions = await getAllTransactions();
  const customers = await getAllCustomers();
  const profile = await getMerchantProfile();

  const backupPayload = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    profile,
    transactions,
    customers
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  triggerDownload(blob, `OfflinePay_Backup_${getTimestampStr()}.json`);

  return { success: true, message: 'Full database snapshot downloaded.' };
}

/**
 * Import & Restore Database from Backup JSON File
 */
export function importDatabaseBackupJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file selected'));
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        if (!payload.transactions || !Array.isArray(payload.transactions)) {
          throw new Error('Invalid backup file structure.');
        }

        await restoreDatabaseSnapshot(payload);
        resolve({ success: true, count: payload.transactions.length });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/"/g, '""');
}

function getTimestampStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}
