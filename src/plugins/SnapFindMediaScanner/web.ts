import { WebPlugin } from '@capacitor/core';
import type {
  SnapFindMediaScannerPlugin,
  ReadMediaBase64Result,
} from './index';

/**
 * Honest web implementation:
 * Web browsers cannot silently monitor device photo galleries via Android MediaStore.
 * Never fake granted permissions or fake automatic gallery monitoring in browser environments.
 */
export class SnapFindMediaScannerWeb extends WebPlugin implements SnapFindMediaScannerPlugin {
  async checkGalleryPermission(): Promise<{
    granted: boolean;
    permissionState: 'granted' | 'partial' | 'denied' | 'prompt' | 'unsupported';
  }> {
    return { granted: false, permissionState: 'unsupported' };
  }

  async requestGalleryPermission(): Promise<{
    granted: boolean;
    permissionState: 'granted' | 'partial' | 'denied' | 'prompt' | 'unsupported';
  }> {
    return { granted: false, permissionState: 'unsupported' };
  }

  async openAppSettings(): Promise<void> {
    // No-op on web; app settings intent is Android-only.
  }

  async readMediaAsBase64(): Promise<ReadMediaBase64Result> {
    throw new Error('Native MediaStore access is only available in the Android app.');
  }

  async scanExistingScreenshots(): Promise<{ totalFound: number; lastScanTimestamp?: number }> {
    return { totalFound: 0, lastScanTimestamp: 0 };
  }

  async startScreenshotMonitoring(): Promise<{ active: boolean }> {
    return { active: false };
  }

  async stopScreenshotMonitoring(): Promise<{ active: boolean }> {
    return { active: false };
  }

  async updateNotificationProgress(): Promise<void> {
    // No-op on web.
  }
}
