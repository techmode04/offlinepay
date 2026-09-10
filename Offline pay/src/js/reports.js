/**
 * Analytics & Reports Module
 */

import { getAllTransactions, getAllCustomers } from './db.js';

export async function generateAnalyticsSummary() {
  const transactions = await getAllTransactions();
  const customers = await getAllCustomers();

  let totalRevenue = 0;
  let totalPending = 0;
  let totalFailed = 0;

  let paidCount = 0;
  let pendingCount = 0;

  const methodBreakdown = {
    'USSD (*99#)': { count: 0, amount: 0 },
    'UPI QR': { count: 0, amount: 0 },
    'SMS Banking': { count: 0, amount: 0 }
  };

  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount || 0);

    if (tx.status === 'PAID') {
      totalRevenue += amt;
      paidCount++;

      const mKey = tx.method || 'USSD (*99#)';
      if (!methodBreakdown[mKey]) {
        methodBreakdown[mKey] = { count: 0, amount: 0 };
      }
      methodBreakdown[mKey].count++;
      methodBreakdown[mKey].amount += amt;
    } else if (tx.status === 'PENDING') {
      totalPending += amt;
      pendingCount++;
    } else if (tx.status === 'FAILED') {
      totalFailed += amt;
    }
  });

  // Calculate customer dues
  let totalCustomerDues = 0;
  customers.forEach(c => {
    totalCustomerDues += parseFloat(c.dueBalance || 0);
  });

  return {
    totalRevenue,
    totalPending,
    totalFailed,
    paidCount,
    pendingCount,
    totalTransactions: transactions.length,
    customerCount: customers.length,
    totalCustomerDues,
    methodBreakdown
  };
}

export function renderReportsView(containerEl, summary) {
  if (!containerEl) return;

  const ussdShare = summary.totalRevenue > 0 
    ? Math.round(((summary.methodBreakdown['USSD (*99#)']?.amount || 0) / summary.totalRevenue) * 100) 
    : 0;

  containerEl.innerHTML = `
    <div class="reports-grid">
      <div class="stat-card stat-primary">
        <span class="stat-lbl">Total Sales (Paid)</span>
        <h3 class="stat-val">₹${summary.totalRevenue.toFixed(2)}</h3>
        <span class="stat-sub">${summary.paidCount} successful payments</span>
      </div>

      <div class="stat-card stat-warning">
        <span class="stat-lbl">Pending Dues</span>
        <h3 class="stat-val">₹${summary.totalPending.toFixed(2)}</h3>
        <span class="stat-sub">${summary.pendingCount} pending requests</span>
      </div>

      <div class="stat-card stat-accent">
        <span class="stat-lbl">Customer Ledger (Khata Dues)</span>
        <h3 class="stat-val">₹${summary.totalCustomerDues.toFixed(2)}</h3>
        <span class="stat-sub">Across ${summary.customerCount} customers</span>
      </div>
    </div>

    <div class="chart-card">
      <h4>Payment Method Distribution</h4>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${ussdShare}%"></div>
      </div>
      <div class="method-legend">
        <div class="legend-item">
          <span class="dot dot-primary"></span>
          <span>USSD (*99#): <strong>₹${(summary.methodBreakdown['USSD (*99#)']?.amount || 0).toFixed(2)}</strong> (${ussdShare}%)</span>
        </div>
        <div class="legend-item">
          <span class="dot dot-cyan"></span>
          <span>UPI QR / Token: <strong>₹${(summary.methodBreakdown['UPI QR']?.amount || 0).toFixed(2)}</strong></span>
        </div>
      </div>
    </div>
  `;
}
