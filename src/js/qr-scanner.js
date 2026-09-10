/**
 * Bulletproof UPI QR Code Scanner & Gallery Photo Decoder
 * Supports Google Pay, PhonePe, Paytm, BHIM, and BharatQR formats.
 */

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

  /**
   * Start Live Camera Stream
   */
  async startScanner() {
    if (!this.scannerModal || !this.videoEl || !this.canvasEl) return;

    this.scannerModal.classList.remove('hidden');

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.videoEl.srcObject = this.videoStream;
      this.videoEl.setAttribute('playsinline', 'true');
      await this.videoEl.play();

      this.isScanning = true;
      requestAnimationFrame(() => this.tickScanner());
      this.showToast('Camera active. Align QR code in target box', 'info');
    } catch (err) {
      console.error('Camera stream error:', err);
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

  /**
   * Frame-by-frame live camera QR scanner loop
   */
  tickScanner() {
    if (!this.isScanning || !this.videoEl || !this.canvasEl) return;

    if (this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
      const ctx = this.canvasEl.getContext('2d', { willReadFrequently: true });
      this.canvasEl.width = this.videoEl.videoWidth;
      this.canvasEl.height = this.videoEl.videoHeight;

      ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
      const imageData = ctx.getImageData(0, 0, this.canvasEl.width, this.canvasEl.height);

      const qrResult = decodeImageData(imageData);
      if (qrResult) {
        this.stopScanner();
        this.handleDecodedQrResult(qrResult);
        return;
      }
    }

    if (this.isScanning) {
      this.animationFrameId = requestAnimationFrame(() => this.tickScanner());
    }
  }

  /**
   * Handle Gallery Image File Upload & Decoding
   */
  handleGalleryImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.showToast('Processing QR photo from gallery...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Scale high-res photo down to max 800px width/height for fast & accurate QR decoding
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const qrResult = decodeImageData(imageData);

        if (qrResult) {
          this.stopScanner();
          this.handleDecodedQrResult(qrResult);
        } else {
          this.showToast('Could not decode QR from image. Try a clearer photo or enter UPI ID manually.', 'warning');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handle Scanned UPI Data Result
   */
  handleDecodedQrResult(qrData) {
    console.log('Decoded QR raw content:', qrData);
    const parsed = parseUpiDeepLink(qrData);

    if (parsed) {
      this.showToast(`Scanned UPI: ${parsed.payeeName || parsed.upiId}`, 'success');
      this.onScanSuccess(parsed);
    } else {
      this.showToast(`Scanned value: ${qrData.substring(0, 30)}...`, 'info');
      this.onScanSuccess({
        upiId: qrData.trim(),
        payeeName: 'Merchant Store',
        amount: '',
        note: 'Scanned QR'
      });
    }
  }
}

/**
 * Universal ImageData Decoder Function
 */
function decodeImageData(imageData) {
  if (typeof window.jsQR === 'function') {
    try {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        return code.data;
      }
    } catch (err) {
      console.error('jsQR decode error:', err);
    }
  }
  return null;
}

/**
 * Universal UPI Deep Link Parser
 */
export function parseUpiDeepLink(uri) {
  if (!uri || typeof uri !== 'string') return null;

  const cleanUri = uri.trim();
  let queryStr = cleanUri;

  if (cleanUri.startsWith('upi://pay?')) {
    queryStr = cleanUri.split('upi://pay?')[1];
  } else if (cleanUri.includes('upi://pay')) {
    queryStr = cleanUri.substring(cleanUri.indexOf('upi://pay?') + 10);
  } else if (!cleanUri.includes('pa=')) {
    // Direct UPI ID or mobile handle (e.g. merchant@upi, 9876543210@ybl, etc.)
    if (cleanUri.includes('@') || /^\d{10}$/.test(cleanUri)) {
      return {
        upiId: cleanUri,
        payeeName: 'Merchant Store',
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
    payeeName: pn ? decodeURIComponent(pn.replace(/\+/g, ' ')) : 'Merchant Store',
    amount: am,
    note: tn ? decodeURIComponent(tn.replace(/\+/g, ' ')) : ''
  };
}
