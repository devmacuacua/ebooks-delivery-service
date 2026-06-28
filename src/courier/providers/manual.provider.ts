import { randomBytes } from 'crypto';

export const manualProvider = {
  name: 'manual',
  generateTrackingCode(): string {
    return `EBS-${randomBytes(4).toString('hex').toUpperCase()}`;
  },
  getTrackingUrl(): null {
    return null; // manual — no external tracking URL
  },
};
