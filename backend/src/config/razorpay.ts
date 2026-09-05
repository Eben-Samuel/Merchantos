import Razorpay from 'razorpay';
import { config } from './env';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayInstance) {
    if (!config.razorpay.keyId || config.razorpay.keyId === 'rzp_test_XXXXXXXXXXXXXXXX') {
      throw new Error('Razorpay key ID not configured. Set RAZORPAY_KEY_ID in .env');
    }
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

export function isRazorpayConfigured(): boolean {
  return config.razorpay.keyId !== 'rzp_test_XXXXXXXXXXXXXXXX' &&
         config.razorpay.keySecret !== 'YOUR_SECRET_HERE';
}
