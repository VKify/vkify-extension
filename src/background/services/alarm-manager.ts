import type { SpyTracker } from './spy-tracker.js';
import type { ProfileTracker } from './profile-tracker.js';
import { AlarmName } from '../../shared/constants/alarms.js';

export class AlarmManager {
  private readonly alarms = AlarmName;

  async setupStorageMonitor(): Promise<void> {
    await chrome.alarms.create(this.alarms.STORAGE_MONITOR, { periodInMinutes: 30 });
  }

  async handleAlarm(
    alarmName: string,
    spyTracker: SpyTracker,
    profileTracker: ProfileTracker,
  ): Promise<void> {
    switch (alarmName) {
      case this.alarms.STORAGE_MONITOR:
        await this.monitorStorage();
        break;

      case this.alarms.ONLINE_SPY_CHECK:
        await this.handleSpyCheck(spyTracker);
        break;

      case this.alarms.PROFILE_SPY_CHECK:
        await this.handleProfileSpyCheck(profileTracker);
        break;

      default:
        console.log('[VKify] Unknown alarm:', alarmName);
    }
  }

  private async handleSpyCheck(spyTracker: SpyTracker): Promise<void> {
    const settings = await chrome.storage.local.get(null);
    await spyTracker.triggerCheck(settings);
  }

  private async handleProfileSpyCheck(profileTracker: ProfileTracker): Promise<void> {
    const settings = await chrome.storage.local.get(null);
    await profileTracker.triggerCheck(settings);
  }

  private async monitorStorage(): Promise<void> {
    try {
      const bytes = await chrome.storage.local.getBytesInUse();
      const quota = (
        chrome.storage.local as chrome.storage.LocalStorageArea & { QUOTA_BYTES?: number }
      ).QUOTA_BYTES ?? 5_242_880;
      const percent = (bytes / quota) * 100;

      console.log(`[VKify] Storage: ${bytes} bytes (${percent.toFixed(1)}%)`);

      if (percent > 80) {
        console.warn('[VKify] Storage usage is high');
      }
    } catch (err) {
      console.log('[VKify] Could not check storage:', (err as Error).message);
    }
  }

  async clearAlarm(name: string): Promise<void> {
    await chrome.alarms.clear(name);
  }
}