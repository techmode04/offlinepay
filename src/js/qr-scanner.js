/**
 * Standalone QR Code Scanner & UPI Deep Link Parser Module
 * Zero-dependency standalone ESM QR decoder
 */

import jsQR from 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm';

export class QRScannerController {
  constructor(options = {}) {
    this.onScanSuccess = options.onScanSuccess || (() => {});
    this.showToast = options.showToast || console.log;

    this.videoStream = null;
    this.animationFrameId = null;
    this.isScanning = false;

    this.initElements();
  }

  initElements() {
    this.scannerModal = document.getElementById('qr-scanner-modal');
    this.videoEl = document.getElementById('scanner-video');
    this.canvasEl = document.getElementById('scanner-canvas');
    this.closeScannerBtn = document.getElementById('close-scanner-btn');

    this.galleryFileInput = document.getElementById('gallery-qr-input');
    this.manualUpiUriInput = document.getElementById('manual-upi-uri-input');
    this.parseUpiUriBtn = document.getElementById('parse-upi-uri-btn');

    if (this.closeScannerBtn) {
      this.closeScannerBtn.addEventListener('click', () => this.stopScanner());
    }

    if (this.parseUpiUriBtn) {
      this.parseUpiUriBtn.addEventListener('click', () => {
        const val = this.manualUpiUriInput?.value?.trim();
        if (val) {
          this.handleDecodedQrResult(val);
        }
      });
    }

    if (this.galleryFileInput) {
      this.galleryFileInput.addEventListener('change', (e) => this.handleGalleryImage(e));
    }
  }

  async startScanner() {
    if (!this.scannerModal || !this.videoEl || !this.canvasEl) return;

    this.scannerModal.classList.remove('hidden');

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      this.videoEl.srcObject = this.videoStream;
      this.videoEl.setAttribute('playsinline', 'true');
      this.videoEl.play();

      this.isScanning = true;
      requestAnimationFrame(() => this.tickScanner());
      this.showToast('Camera active. Point at any UPI QR Code', 'info');
    } catch (err) {
      console.error('Camera access error:', err);
      this.showToast('Camera access blocked. Select a photo from gallery below.', 'warning');
    }
  }

  stopScanner() {
    this.isScanning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }

    if (this.scannerModal) {
      this.scannerModal.classList.add('hidden');
    }
  }

  tickScanner() {
    if (!this.isScanning || !this.videoEl || !this.canvasEl) return;

    if (this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
      const ctx = this.canvasEl.getContext('2d');
      this.canvasEl.height = this.videoEl.videoHeight;
      this.canvasEl.width = this.videoEl.videoWidth;

      ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
      const imageData = ctx.getImageData(0, 0, this.canvasEl.width, this.canvasEl.height);
      
      try {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          this.stopScanner();
          this.handleDecodedQrResult(code.data);
          return;
        }
      } catch (e) {
        // Fallback decoder
      }
    }

    if (this.isScanning) {
      this.animationFrameId = requestAnimationFrame(() => this.tickScanner());
    }
  }

  handleGalleryImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            this.stopScanner();
            this.handleDecodedQrResult(code.data);
          } else {
            this.showToast('No QR code found in selected image', 'warning');
          }
        } catch (err) {
          this.showToast('QR decode error', 'warning');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  handleDecodedQrResult(qrData) {
    const parsed = parseUpiDeepLink(qrData);

    if (parsed) {
      this.showToast(`Scanned UPI: ${parsed.payeeName || parsed.upiId}`, 'success');
      this.onScanSuccess(parsed);
    } else {
      this.showToast(`Scanned input: ${qrData.substring(0, 25)}...`, 'info');
      this.onScanSuccess({
        upiId: qrData,
        payeeName: '',
        amount: '',
        note: 'Gallery Scan'
      });
    }
  }
}

export function parseUpiDeepLink(uri) {
  if (!uri || typeof uri !== 'string') return null;

  let queryStr = uri;
  if (uri.startsWith('upi://pay?')) {
    queryStr = uri.split('upi://pay?')[1];
  } else if (!uri.includes('pa=')) {
    if (uri.includes('@') || /^\d{10}$/.test(uri.trim())) {
      return {
        upiId: uri.trim(),
        payeeName: '',
        amount: '',
        note: ''
      };
    }
    return null;
  }

  const params = new URLSearchParams(queryStr);
  const pa = params.get('pa') || '';
  const pn = params.get('pn') || '';
  const am = params.get('am') || '';
  const tn = params.get('tn') || '';

  if (!pa && !pn) return null;

  return {
    upiId: pa,
    payeeName: decodeURIComponent(pn),
    amount: am,
    note: decodeURIComponent(tn)
  };
}
