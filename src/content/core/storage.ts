type StorageListener = (key: string, value: unknown) => void;

export class StorageManager {
  private cache = new Map<string, unknown>();
  private listeners = new Set<StorageListener>();
  private _contextValid = true;
  private _storageListener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null = null;

  isContextValid(): boolean {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      this._contextValid = false;
      return false;
    }
  }

  private async safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!this._contextValid || !this.isContextValid()) {
      this._contextValid = false;
      return fallback;
    }

    try {
      return await fn();
    } catch (error) {
      if ((error as Error).message?.includes('Extension context invalidated')) {
        this._contextValid = false;
        console.warn('[VKify] Extension context invalidated');
        this.cleanup();
        return fallback;
      }
      throw error;
    }
  }

  cleanup(): void {
    if (this._storageListener) {
      try {
        chrome.storage.onChanged.removeListener(this._storageListener);
      } catch {
        // Ignore errors during cleanup
      }
      this._storageListener = null;
    }
    this.listeners.clear();
  }

  async get<T = unknown>(key: string, defaultValue: T | null = null): Promise<T | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const result = await this.safeCall<unknown>(async () => {
      const data = await chrome.storage.local.get(key);
      return data[key];
    }, undefined);

    if (result === null && !this._contextValid) return defaultValue;

    const value = result !== undefined ? (result as T) : defaultValue;
    this.cache.set(key, value);
    return value;
  }

  async getMultiple(keys: string[]): Promise<Record<string, unknown>> {
    const result = await this.safeCall(
      async () => chrome.storage.local.get(keys),
      {} as Record<string, unknown>,
    );

    if (result) {
      for (const [key, value] of Object.entries(result)) {
        this.cache.set(key, value);
      }
    }

    return result ?? {};
  }

  async getAll(): Promise<Record<string, unknown>> {
    const result = await this.safeCall(
      async () => chrome.storage.local.get(null),
      {} as Record<string, unknown>,
    );

    if (result) {
      for (const [key, value] of Object.entries(result)) {
        this.cache.set(key, value);
      }
    }

    return result ?? {};
  }

  async set(key: string, value: unknown): Promise<boolean> {
    this.cache.set(key, value);

    const success = await this.safeCall(async () => {
      await chrome.storage.local.set({ [key]: value });
      return true;
    }, false);

    if (success) this.notifyListeners(key, value);
    return success;
  }

  async setMultiple(items: Record<string, unknown>): Promise<boolean> {
    for (const [key, value] of Object.entries(items)) {
      this.cache.set(key, value);
    }

    const success = await this.safeCall(async () => {
      await chrome.storage.local.set(items);
      return true;
    }, false);

    if (success) {
      for (const [key, value] of Object.entries(items)) {
        this.notifyListeners(key, value);
      }
    }

    return success;
  }

  async remove(key: string): Promise<boolean> {
    this.cache.delete(key);
    return this.safeCall(async () => {
      await chrome.storage.local.remove(key);
      return true;
    }, false);
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    return this.safeCall(async () => {
      await chrome.storage.local.clear();
      return true;
    }, false);
  }

  onChange(callback: StorageListener): () => void {
    if (!this._contextValid) return () => {};

    this.listeners.add(callback);

    if (!this._storageListener && this.listeners.size === 1) {
      this._storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (!this.isContextValid()) {
          this.cleanup();
          return;
        }

        if (areaName === 'local') {
          for (const [key, { newValue }] of Object.entries(changes)) {
            this.cache.set(key, newValue);
            this.notifyListeners(key, newValue);
          }
        }
      };

      try {
        chrome.storage.onChanged.addListener(this._storageListener);
      } catch (e) {
        console.warn('[VKify] Failed to add storage listener:', e);
        this._storageListener = null;
      }
    }

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this._storageListener) {
        try {
          chrome.storage.onChanged.removeListener(this._storageListener);
        } catch {
          // Ignore
        }
        this._storageListener = null;
      }
    };
  }

  notifyListeners(key: string, value: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(key, value);
      } catch (e) {
        console.error('[VKify] Listener error:', e);
      }
    }
  }

  invalidateCache(key: string | null = null): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const storage = new StorageManager();