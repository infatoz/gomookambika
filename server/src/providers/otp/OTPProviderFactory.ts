import { IOTPProvider } from './IOTPProvider';
import { logger } from '@/utils/logger';

// Console provider — logs OTP to console (development/testing only)
class ConsoleOTPProvider implements IOTPProvider {
  async sendOTP(phone: string, otp: string): Promise<void> {
    logger.info(`[OTP] Phone: ${phone} | OTP: ${otp}`);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📱 OTP for ${phone}: ${otp}`);
    console.log(`${'='.repeat(50)}\n`);
  }
}

// Stub for Twilio (implement when credentials are available)
class TwilioOTPProvider implements IOTPProvider {
  async sendOTP(phone: string, otp: string): Promise<void> {
    // TODO: Implement Twilio SMS
    throw new Error('Twilio OTP provider not implemented. Set OTP_PROVIDER=console for development.');
  }
}

// Stub for MSG91 (common Indian SMS provider)
class MSG91OTPProvider implements IOTPProvider {
  async sendOTP(phone: string, otp: string): Promise<void> {
    // TODO: Implement MSG91
    throw new Error('MSG91 OTP provider not implemented.');
  }
}

// Stub for Fast2SMS (Indian SMS provider)
class Fast2SMSOTPProvider implements IOTPProvider {
  async sendOTP(phone: string, otp: string): Promise<void> {
    // TODO: Implement Fast2SMS
    throw new Error('Fast2SMS OTP provider not implemented.');
  }
}

export class OTPProviderFactory {
  static create(provider: string): IOTPProvider {
    switch (provider) {
      case 'console':
        return new ConsoleOTPProvider();
      case 'twilio':
        return new TwilioOTPProvider();
      case 'msg91':
        return new MSG91OTPProvider();
      case 'fast2sms':
        return new Fast2SMSOTPProvider();
      default:
        logger.warn(`Unknown OTP provider "${provider}", falling back to console`);
        return new ConsoleOTPProvider();
    }
  }
}
