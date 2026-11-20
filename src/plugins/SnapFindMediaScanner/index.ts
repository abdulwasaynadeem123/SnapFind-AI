import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface MediaScreenshotRecord {
  mediaId?: string;
  uri: string;
  filename: string;
  dateAdded: number;
  dateModified?: number;
  width?: number;
  height?: number;
  size?: number;
  relativePath?: string;
  isModified?: boolean;
}

export interface ScanProgressPayload {
  scanned: number;
  total: number;
  currentUri?: string;
  screenshot?: MediaScreenshotRecord;
}

export interface ScanCompletedPayload {
  totalFound: number;
  lastScanTimestamp?: number;
  screenshots: MediaScreenshotRecord[];
}

export type ScreenshotDetectedPayload = MediaScreenshotRecord;

export interface PermissionRevokedPayload {
  granted: boolean;
  permissionState: 'denied' | 'prompt';
}

export interface ReadMediaBase64Result {
  base64Data: string;
  thumbnailData?: string;
  width?: number;
  height?: number;
}

export interface SnapFindMediaScannerPlugin {
  checkGalleryPermission(): Promise<{
    granted: boolean;
    permissionState: 'granted' | 'partial' | 'denied' | 'prompt' | 'unsupported';
  }>;
  requestGalleryPermission(): Promise<{
    granted: boolean;
    permissionState: 'granted' | 'partial' | 'denied' | 'prompt' | 'unsupported';
  }>;
  openAppSettings(): Promise<void>;
  readMediaAsBase64(options: {
    uri: string;
    maxDimension?: number;
    thumbnailMax?: number;
  }): Promise<ReadMediaBase64Result>;
  scanExistingScreenshots(options?: { sinceTimestamp?: number }): Promise<{
    totalFound: number;
    lastScanTimestamp?: number;
  }>;
  startScreenshotMonitoring(): Promise<{ active: boolean }>;
  stopScreenshotMonitoring(): Promise<{ active: boolean }>;
  updateNotificationProgress(options: { progressPercentage: number }): Promise<void>;

  addListener(
    eventName: 'onInitialScanProgress',
    listenerFunc: (progress: ScanProgressPayload) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onInitialScanCompleted',
    listenerFunc: (result: ScanCompletedPayload) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onScreenshotDetected',
    listenerFunc: (screenshot: ScreenshotDetectedPayload) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onPermissionRevoked',
    listenerFunc: (payload: PermissionRevokedPayload) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

const SnapFindMediaScanner = registerPlugin<SnapFindMediaScannerPlugin>('SnapFindMediaScanner', {
  web: () => import('./web').then((m) => new m.SnapFindMediaScannerWeb()),
});

export default SnapFindMediaScanner;
