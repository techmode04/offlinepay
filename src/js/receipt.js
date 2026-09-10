/**
 * Receipt & Soundbox Module
 */

export function playSoundboxNotification(amount, soundEnabled = true) {
  if (!soundEnabled) return;
  
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Pleasant 2-step chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);

    // Web Speech API Announcement
    if ('speechSynthesis' in window) {
      setTimeout(() => {
        const text = `Payment of ${amount} rupees received via USSD`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
      }, 500);
    }
  } catch (err) {
    console.log('Audio playback policy restricted:', err);
  }
}

export function renderReceiptModal(tx, profile = {}) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  const titleEl = document.getElementById('receipt-status-title');
  const amtEl = document.getElementById('receipt-amount');
  const txIdEl = document.getElementById('rcpt-txid');
  const dateEl = document.getElementById('rcpt-date');
  const payeeEl = document.getElementById('rcpt-payee');
  const upiEl = document.getElementById('rcpt-upi');
  const noteEl = document.getElementById('rcpt-note');
  const statusEl = document.getElementById('rcpt-status');
  const storeNameEl = document.getElementById('rcpt-store-name');

  if (titleEl) titleEl.textContent = tx.status === 'PAID' ? 'Payment Successful' : 'Payment Failed / Unpaid';
  if (amtEl) amtEl.textContent = `₹${parseFloat(tx.amount).toFixed(2)}`;
  if (txIdEl) txIdEl.textContent = tx.id;
  if (dateEl) dateEl.textContent = formatDate(tx.date);
  if (payeeEl) payeeEl.textContent = tx.payee || profile.businessName || 'Merchant';
  if (upiEl) upiEl.textContent = tx.upi || profile.payeeUpi || 'merchant@upi';
  if (noteEl) noteEl.textContent = tx.note || 'N/A';
  if (storeNameEl) storeNameEl.textContent = profile.businessName || 'OfflinePay Store';
  
  if (statusEl) {
    statusEl.textContent = tx.status;
    statusEl.className = tx.status === 'PAID' ? 'val status-paid-tag' : 'val status-failed-tag';
  }

  modal.classList.remove('hidden');
}

export function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoStr;
  }
}
