/**
 * USSD Payment Controller (*99#)
 * Enforces native dialer launching, Jio SIM restriction alert, fallback copy,
 * desktop handling, and post-return payment confirmation workflow.
 */

import { generateTxId, saveTransactionDB, getMerchantProfile } from './db.js';
import { playSoundboxNotification, renderReceiptModal } from './receipt.js';

export const USSD_CODE = '*99#';
export const USSD_TEL_URI = 'tel:*99%23';

export class USSDController {
  constructor(options = {}) {
    this.showToast = options.showToast || console.log;
    this.refreshHistory = options.refreshHistory || (() => {});
    this.isSoundEnabled = options.isSoundEnabled || (() => true);

    this.pendingTx = null;
    this.isDialerLaunched = false;

    this.initElements();
    this.attachEventListeners();
  }

  initElements() {
    this.payUssdBtn = document.getElementById('pay-ussd-btn');
    this.copyUssdBtn = document.getElementById('copy-ussd-btn');

    // Modals
    this.preDialerModal = document.getElementById('pre-dialer-modal');
    this.confirmLaunchBtn = document.getElementById('confirm-launch-btn');
    this.cancelLaunchBtn = document.getElementById('cancel-launch-btn');

    this.verifyModal = document.getElementById('payment-verification-modal');
    this.verifyPayeeName = document.getElementById('verify-payee-name');
    this.verifyAmount = document.getElementById('verify-amount');
    this.verifyCompletedBtn = document.getElementById('verify-completed-btn');
    this.verifyFailedBtn = document.getElementById('verify-failed-btn');

    // Form inputs
    this.amountInput = document.getElementById('pay-amount');
    this.payeeNameInput = document.getElementById('payee-name');
    this.payeeUpiInput = document.getElementById('payee-upi');
  }

  attachEventListeners() {
    if (this.payUssdBtn) {
      this.payUssdBtn.addEventListener('click', () => this.handlePayUssdClick());
    }

    if (this.copyUssdBtn) {
      this.copyUssdBtn.addEventListener('click', () => this.copyCodeToClipboard());
    }

    if (this.confirmLaunchBtn) {
      this.confirmLaunchBtn.addEventListener('click', () => this.executeDialerLaunch());
    }
    if (this.cancelLaunchBtn) {
      this.cancelLaunchBtn.addEventListener('click', () => this.closePreDialerModal());
    }

    if (this.verifyCompletedBtn) {
      this.verifyCompletedBtn.addEventListener('click', () => this.handlePaymentCompleted());
    }
    if (this.verifyFailedBtn) {
      this.verifyFailedBtn.addEventListener('click', () => this.handlePaymentFailed());
    }

    window.addEventListener('focus', () => this.handleReturnToApp());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleReturnToApp();
      }
    });
  }

  isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }

  async handlePayUssdClick() {
    const amount = parseFloat(this.amountInput?.value || '0');
    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid payment amount', 'warning');
      this.amountInput?.focus();
      return;
    }

    const upi = this.payeeUpiInput?.value?.trim();
    if (!upi) {
      this.showToast('Please enter recipient UPI ID or mobile number', 'warning');
      this.payeeUpiInput?.focus();
      return;
    }

    const payee = this.payeeNameInput?.value?.trim() || 'Merchant';

    this.pendingTx = {
      id: generateTxId(),
      date: new Date().toISOString(),
      payee,
      upi,
      amount,
      note: 'USSD Payment',
      method: 'USSD (*99#)',
      status: 'PENDING'
    };

    if (!this.isMobileDevice()) {
      this.showToast('USSD payments are available on mobile devices. Code copied to clipboard.', 'warning');
      this.copyCodeToClipboard();
      return;
    }

    this.openPreDialerModal();
  }

  openPreDialerModal() {
    if (this.preDialerModal) {
      this.preDialerModal.classList.remove('hidden');
    }
  }

  closePreDialerModal() {
    if (this.preDialerModal) {
      this.preDialerModal.classList.add('hidden');
    }
  }

  executeDialerLaunch() {
    this.closePreDialerModal();
    this.isDialerLaunched = true;

    try {
      window.location.href = USSD_TEL_URI;
    } catch (err) {
      console.error('Failed to launch tel: URI', err);
      this.showToast("USSD dialing isn't supported by this browser. Please dial *99# manually.", 'warning');
    }

    setTimeout(() => {
      if (this.isDialerLaunched && this.pendingTx) {
        this.promptPaymentVerification();
      }
    }, 1500);
  }

  async copyCodeToClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(USSD_CODE);
      } else {
        const input = document.createElement('input');
        input.value = USSD_CODE;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      this.showToast('*99# copied to clipboard.', 'success');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      this.showToast('Failed to copy code. Please dial *99# manually.', 'warning');
    }
  }

  handleReturnToApp() {
    if (this.isDialerLaunched && this.pendingTx) {
      this.promptPaymentVerification();
    }
  }

  promptPaymentVerification() {
    if (!this.pendingTx || !this.verifyModal) return;

    if (this.verifyPayeeName) this.verifyPayeeName.textContent = this.pendingTx.payee;
    if (this.verifyAmount) this.verifyAmount.textContent = `₹${parseFloat(this.pendingTx.amount).toFixed(2)}`;

    this.verifyModal.classList.remove('hidden');
  }

  closeVerificationModal() {
    if (this.verifyModal) {
      this.verifyModal.classList.add('hidden');
    }
  }

  async handlePaymentCompleted() {
    if (!this.pendingTx) return;

    this.pendingTx.status = 'PAID';
    await saveTransactionDB(this.pendingTx);

    playSoundboxNotification(this.pendingTx.amount, this.isSoundEnabled());
    this.showToast(`Payment of ₹${this.pendingTx.amount} confirmed & saved!`, 'success');

    const profile = await getMerchantProfile();
    renderReceiptModal(this.pendingTx, profile);

    this.pendingTx = null;
    this.isDialerLaunched = false;
    this.closeVerificationModal();
    this.refreshHistory();
  }

  async handlePaymentFailed() {
    if (!this.pendingTx) return;

    this.pendingTx.status = 'FAILED';
    await saveTransactionDB(this.pendingTx);

    this.showToast('Payment marked as Failed/Unpaid.', 'warning');

    this.pendingTx = null;
    this.isDialerLaunched = false;
    this.closeVerificationModal();
    this.refreshHistory();
  }
}
