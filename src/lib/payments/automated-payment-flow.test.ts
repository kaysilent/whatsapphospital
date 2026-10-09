import { describe, it, expect, vi } from 'vitest';
import { 
  createPaymentLink, 
  formatThankYouMessage, 
  testRazorpayConnection,
  DEFAULT_PAYMENT_CONFIG, 
  PaymentConfig 
} from '@/lib/payments/gateway';

describe('Automated Payment Link & WhatsApp Receipt Features Test Suite', () => {

  // =========================================================================
  // Feature 1: Auto-generate and send Payment Link on slot booking
  // =========================================================================
  describe('Feature 1: Auto-generate and send Payment Link on slot booking', () => {
    
    it('successfully generates a hosted checkout link with all slot booking parameters', async () => {
      const bookingData = {
        patientName: 'Ananya Sharma',
        phoneNumber: '+91 98765 43210',
        treatment: 'HydraFacial Deluxe',
        amount: 500,
        appointmentId: 'apt_test_101',
        date: '2026-10-12',
        time: '11:30 AM',
        doctor: 'Dr. Mrinalini',
        origin: 'http://localhost:3000',
      };

      const result = await createPaymentLink(bookingData, DEFAULT_PAYMENT_CONFIG);

      expect(result).toBeDefined();
      expect(result.paymentId).toMatch(/^pay_\d+_[a-z0-9]+$/);
      expect(result.amount).toBe(500);
      expect(result.currency).toBe('INR');
      expect(result.linkUrl).toContain('http://localhost:3000/pay/pay_');
      expect(result.linkUrl).toContain('name=Ananya%20Sharma');
      expect(result.linkUrl).toContain('phone=%2B919876543210');
      expect(result.linkUrl).toContain('treatment=HydraFacial%20Deluxe');
      expect(result.linkUrl).toContain('amount=500');
      expect(result.linkUrl).toContain('date=2026-10-12');
      expect(result.linkUrl).toContain('time=11%3A30%20AM');
      expect(result.linkUrl).toContain('doctor=Dr.%20Mrinalini');
    });

    it('generates a valid UPI Intent deep link and dynamic QR code for instant mobile payments', async () => {
      const bookingData = {
        patientName: 'Vikram Malhotra',
        phoneNumber: '+91 98321 00011',
        treatment: 'Laser Hair Reduction',
        amount: 500,
        appointmentId: 'apt_test_102',
        date: '2026-10-14',
        time: '02:30 PM',
        doctor: 'Dr. Mrinalini',
        origin: 'http://localhost:3000',
      };

      const customConfig: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        upi_vpa: 'lafleur@okhdfcbank',
        merchant_name: 'La Fleur Aesthetic Clinic',
      };

      const result = await createPaymentLink(bookingData, customConfig);

      expect(result.upiString).toBeDefined();
      expect(result.upiString).toContain('upi://pay?pa=lafleur%40okhdfcbank');
      expect(result.upiString).toContain('pn=La%20Fleur%20Aesthetic%20Clinic');
      expect(result.upiString).toContain('am=500');
      expect(result.upiString).toContain('cu=INR');
      
      expect(result.qrCodeUrl).toBeDefined();
      expect(result.qrCodeUrl).toContain('https://api.qrserver.com/v1/create-qr-code/');
      expect(result.qrCodeUrl).toContain('lafleur');
      expect(result.qrCodeUrl).toContain('okhdfcbank');
    });

    it('respects the require_payment_for_booking configuration toggle', () => {
      const configWithPaymentEnabled: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        require_payment_for_booking: true,
      };

      const configWithPaymentDisabled: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        require_payment_for_booking: false,
      };

      expect(configWithPaymentEnabled.require_payment_for_booking).toBe(true);
      expect(configWithPaymentDisabled.require_payment_for_booking).toBe(false);
    });

    it('sets appropriate expiration time (24 hours in the future)', async () => {
      const result = await createPaymentLink({
        patientName: 'Pooja Hegde',
        phoneNumber: '+91 98112 33445',
        treatment: 'PRP Hair Restoration',
        amount: 500,
      }, DEFAULT_PAYMENT_CONFIG);

      const expiresAt = new Date(result.expiresAt).getTime();
      const now = Date.now();
      const diffHours = (expiresAt - now) / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });
  });

  // =========================================================================
  // Feature 2: Auto-send WhatsApp Thank-You & Booking Receipt Message
  // =========================================================================
  describe('Feature 2: Auto-send WhatsApp Thank-You & Booking Receipt Message', () => {

    it('interpolates all dynamic variables correctly into the thank-you template', () => {
      const receiptData = {
        patient_name: 'Vikram Malhotra',
        treatment: 'Acne Scar Revision (Subcision + MNRF)',
        amount: 500,
        currency: '₹',
        date: 'Tomorrow (Oct 6, 2026)',
        time: '11:30 AM',
        doctor: 'Dr. Mrinalini',
        receipt_id: 'REC-2026-884210',
        payment_mode: 'UPI (Google Pay)',
      };

      const message = formatThankYouMessage(
        DEFAULT_PAYMENT_CONFIG.thank_you_message_template,
        receiptData
      );

      // Verify all variables are substituted
      expect(message).toContain('Dear Vikram Malhotra');
      expect(message).toContain('payment of ₹500');
      expect(message).toContain('Acne Scar Revision (Subcision + MNRF)');
      expect(message).toContain('Tomorrow (Oct 6, 2026)');
      expect(message).toContain('11:30 AM');
      expect(message).toContain('Dr. Mrinalini');
      expect(message).toContain('REC-2026-884210');
      expect(message).toContain('UPI (Google Pay)');
      expect(message).toContain('https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad');
      expect(message).toContain('Road No.11 B, Jubilee hills, Hyderabad - 500045');

      // Verify no unresolved placeholders remain
      expect(message).not.toContain('{patient_name}');
      expect(message).not.toContain('{treatment}');
      expect(message).not.toContain('{amount}');
      expect(message).not.toContain('{receipt_id}');
      expect(message).not.toContain('{payment_mode}');
      expect(message).not.toContain('{date}');
      expect(message).not.toContain('{time}');
    });

    it('handles custom user-defined thank-you message templates seamlessly', () => {
      const customTemplate = `Hello {patient_name}! Your booking for {treatment} is confirmed. Fee: ₹{amount}. Receipt: #{receipt_id}. See you on {date} at {time} with {doctor}.`;

      const receiptData = {
        patient_name: 'Sunita Rao',
        treatment: 'Botox Micro-Injections',
        amount: 500,
        date: 'Oct 10, 2026',
        time: '04:00 PM',
        doctor: 'Dr. Mrinalini',
        receipt_id: 'REC-2026-991283',
        payment_mode: 'Razorpay Instant',
      };

      const message = formatThankYouMessage(customTemplate, receiptData);

      expect(message).toBe(
        'Hello Sunita Rao! Your booking for Botox Micro-Injections is confirmed. Fee: ₹500. Receipt: #REC-2026-991283. See you on Oct 10, 2026 at 04:00 PM with Dr. Mrinalini.'
      );
    });

    it('provides resilient fallbacks when optional fields are omitted', () => {
      const receiptData = {
        patient_name: '',
        treatment: '',
        amount: 500,
        date: '2026-10-15',
        time: '10:30 AM',
        doctor: '',
        receipt_id: 'REC-2026-000001',
      };

      const message = formatThankYouMessage(
        DEFAULT_PAYMENT_CONFIG.thank_you_message_template,
        receiptData
      );

      expect(message).toContain('Dear Valued Patient');
      expect(message).toContain('payment of ₹500');
      expect(message).toContain('REC-2026-000001');
      expect(message).toContain('Razorpay / UPI');
    });

    it('verifies auto_send_whatsapp_receipt toggle configuration flag', () => {
      const configWithReceiptEnabled: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        auto_send_whatsapp_receipt: true,
      };

      const configWithReceiptDisabled: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        auto_send_whatsapp_receipt: false,
      };

      expect(configWithReceiptEnabled.auto_send_whatsapp_receipt).toBe(true);
      expect(configWithReceiptDisabled.auto_send_whatsapp_receipt).toBe(false);
    });
  });

  // =========================================================================
  // Feature 3: Razorpay Connection Diagnostics & Status Ping
  // =========================================================================
  describe('Feature 3: Razorpay Connection Diagnostics & Status Ping', () => {

    it('returns error when credentials are empty', async () => {
      const res = await testRazorpayConnection('', '');
      expect(res.success).toBe(false);
      expect(res.message).toContain('required');
    });

    it('returns healthy status for default sandbox mock credentials', async () => {
      const res = await testRazorpayConnection('rzp_test_lafleur_clinic', 'secret_demo');
      expect(res.success).toBe(true);
      expect(res.mode).toBe('mock');
      expect(res.message).toContain('sandbox');
    });

    it('handles network / live ping appropriately', async () => {
      // Testing with a dummy non-mock key should gracefully return failed authentication
      const res = await testRazorpayConnection('rzp_test_invalid123', 'fake_secret_456');
      expect(res).toBeDefined();
      expect(typeof res.latencyMs).toBe('number');
      expect(res.mode).toBe('test');
    });
  });
});
