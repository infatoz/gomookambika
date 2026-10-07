export interface IOTPProvider {
  sendOTP(phone: string, otp: string): Promise<void>;
}
