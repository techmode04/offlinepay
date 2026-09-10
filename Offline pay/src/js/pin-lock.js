/**
 * PIN Lock Security Module
 */

import { getSetting, saveSetting } from './db.js';

export class PINLockManager {
  constructor(options = {}) {
    this.showToast = options.showToast || console.log;
    this.enteredPin = '';
    this.savedPin = null;
    this.isEnabled = false;

    this.initElements();
    this.loadState();
  }

  initElements() {
    this.pinOverlay = document.getElementById('pin-lock-overlay');
    this.pinDisplay = document.getElementById('pin-dots-display');
    this.pinErrorMsg = document.getElementById('pin-error-msg');
    this.pinKeypad = document.getElementById('pin-keypad');
  }

  async loadState() {
    this.isEnabled = await getSetting('pin_lock_enabled', false);
    this.savedPin = await getSetting('pin_lock_code', '1234');

    if (this.isEnabled) {
      this.lockApp();
    }
  }

  attachKeypadListeners() {
    if (!this.pinKeypad) return;

    this.pinKeypad.querySelectorAll('.pin-key').forEach(keyBtn => {
      keyBtn.onclick = (e) => {
        const key = keyBtn.getAttribute('data-key');
        if (key === 'clear') {
          this.enteredPin = '';
        } else if (key === 'back') {
          this.enteredPin = this.enteredPin.slice(0, -1);
        } else if (this.enteredPin.length < 4) {
          this.enteredPin += key;
        }

        this.updatePinDots();

        if (this.enteredPin.length === 4) {
          this.verifyPin();
        }
      };
    });
  }

  updatePinDots() {
    if (!this.pinDisplay) return;
    const dots = this.pinDisplay.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
      if (idx < this.enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  verifyPin() {
    if (this.enteredPin === this.savedPin) {
      this.unlockApp();
      this.showToast('Security PIN verified', 'success');
    } else {
      if (this.pinErrorMsg) {
        this.pinErrorMsg.textContent = 'Incorrect PIN code. Try again.';
        this.pinErrorMsg.classList.remove('hidden');
      }
      this.enteredPin = '';
      setTimeout(() => this.updatePinDots(), 400);
    }
  }

  lockApp() {
    if (this.pinOverlay) {
      this.enteredPin = '';
      this.updatePinDots();
      if (this.pinErrorMsg) this.pinErrorMsg.classList.add('hidden');
      this.pinOverlay.classList.remove('hidden');
      this.attachKeypadListeners();
    }
  }

  unlockApp() {
    if (this.pinOverlay) {
      this.pinOverlay.classList.add('hidden');
    }
  }

  async setPin(newPin) {
    if (/^\d{4}$/.test(newPin)) {
      this.savedPin = newPin;
      await saveSetting('pin_lock_code', newPin);
      await saveSetting('pin_lock_enabled', true);
      this.isEnabled = true;
      this.showToast('Security PIN set to ' + newPin, 'success');
      return true;
    } else {
      this.showToast('PIN must be exactly 4 digits', 'warning');
      return false;
    }
  }

  async disablePin() {
    await saveSetting('pin_lock_enabled', false);
    this.isEnabled = false;
    this.showToast('Security PIN lock disabled', 'info');
  }
}
