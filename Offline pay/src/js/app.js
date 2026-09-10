/**
 * OffPay Minimal Single-Page Mobile Controller
 */

import { USSDController } from './ussd.js';
import { QRScannerController } from './qr-scanner.js';
import { getSetting, saveSetting, openDB } from './db.js';

class OffPayApp {
  constructor() {
    this.currentTheme = 'dark';
    this.deferredInstallPrompt = null;

    this.ussdController = null;
    this.qrScannerController = null;

    this.init();
  }

  async init() {
    this.initToastContainer();

    try {
      await openDB();
    } catch (e) {
      console.log('Database init error:', e);
    }

    this.ussdController = new USSDController({
      showToast: (m, t) => this.showToast(m, t),
      refreshHistory: () => {},
      isSoundEnabled: () => true
    });

    this.qrScannerController = new QRScannerController({
      showToast: (m, t) => this.showToast(m, t),
      onScanSuccess: (data) => this.handleScanSuccess(data)
    });

    this.attachUIEvents();
    this.attachPWAEvents();
    this.loadThemePreference();
  }

  initToastContainer() {
    this.toastContainer = document.getElementById('toast-container');
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="12" x2="12.01" y2="12"></line></svg>`;
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  attachUIEvents() {
    // 1. Scan Now button
    const scanBtn = document.getElementById('scan-now-btn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        if (this.qrScannerController) this.qrScannerController.startScanner();
      });
    }

    // 2. Send to UPI ID card
    const sendModalBtn = document.getElementById('btn-open-send-modal');
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentModalBtn = document.getElementById('close-payment-modal-btn');

    if (sendModalBtn && paymentModal) {
      sendModalBtn.addEventListener('click', () => {
        paymentModal.classList.remove('hidden');
      });
    }
    if (closePaymentModalBtn && paymentModal) {
      closePaymentModalBtn.addEventListener('click', () => {
        paymentModal.classList.add('hidden');
      });
    }

    // 3. Check Balance card (Direct Dialer Redirection: *99*3#)
    const checkBalBtn = document.getElementById('btn-check-balance');
    if (checkBalBtn) {
      checkBalBtn.addEventListener('click', () => {
        this.showToast('Opening phone dialer for *99*3# Balance Check...', 'info');
        window.location.href = 'tel:*99*3%23';
      });
    }

    // 4. Help & FAQ Walkthrough modal
    const helpTopBtn = document.getElementById('help-top-btn');
    const helpBtn = document.getElementById('btn-open-help');
    const helpModal = document.getElementById('help-modal');
    const closeHelpBtn = document.getElementById('close-help-modal-btn');

    const openHelp = () => {
      if (helpModal) helpModal.classList.remove('hidden');
    };
    if (helpTopBtn) helpTopBtn.addEventListener('click', openHelp);
    if (helpBtn) helpBtn.addEventListener('click', openHelp);
    if (closeHelpBtn && helpModal) {
      closeHelpBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
    }

    // 5. Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  handleScanSuccess(parsedData) {
    const payeeUpiInput = document.getElementById('payee-upi');
    const payeeNameInput = document.getElementById('payee-name');
    const amtInput = document.getElementById('pay-amount');
    const paymentModal = document.getElementById('payment-modal');

    if (parsedData.upiId && payeeUpiInput) payeeUpiInput.value = parsedData.upiId;
    if (parsedData.payeeName && payeeNameInput) payeeNameInput.value = parsedData.payeeName;
    if (parsedData.amount && amtInput) amtInput.value = parsedData.amount;

    if (paymentModal) paymentModal.classList.remove('hidden');
  }

  attachPWAEvents() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
    });

    const triggerInstall = async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        const choice = await this.deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          this.showToast('OffPay App Installed!', 'success');
        }
        this.deferredInstallPrompt = null;
      } else {
        this.showToast('To install: open browser menu and select "Add to Home Screen"', 'info');
      }
    };

    const installTopBtn = document.getElementById('pwa-install-top-btn');
    const installBottomBtn = document.getElementById('pwa-install-bottom-btn');

    if (installTopBtn) installTopBtn.addEventListener('click', triggerInstall);
    if (installBottomBtn) installBottomBtn.addEventListener('click', triggerInstall);
  }

  async toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    await saveSetting('app_theme', this.currentTheme);
    this.showToast(`Switched to ${this.currentTheme.toUpperCase()} theme`, 'info');
  }

  async loadThemePreference() {
    const savedTheme = await getSetting('app_theme', 'dark');
    this.currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.offPayApp = new OffPayApp();
});
