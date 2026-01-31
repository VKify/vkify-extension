class StorageManager {
  constructor() {
    this.cache = new Map();
  }

  async get(key, defaultValue = null) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key] !== undefined ? result[key] : defaultValue;
      this.cache.set(key, value);
      return value;
    } catch (error) {
      console.error('[VKify] Storage get error:', error);
      return defaultValue;
    }
  }

  async getAll() {
    try {
      const result = await chrome.storage.local.get(null);
      for (const [key, value] of Object.entries(result)) {
        this.cache.set(key, value);
      }
      return result;
    } catch (error) {
      console.error('[VKify] Storage getAll error:', error);
      return {};
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      this.cache.set(key, value);
      this.notifyChange(key, value);
      return true;
    } catch (error) {
      console.error('[VKify] Storage set error:', error);
      return false;
    }
  }

  async setMultiple(items) {
    try {
      await chrome.storage.local.set(items);
      for (const [key, value] of Object.entries(items)) {
        this.cache.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('[VKify] Storage setMultiple error:', error);
      return false;
    }
  }

  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      this.cache.delete(key);
      return true;
    } catch (error) {
      console.error('[VKify] Storage remove error:', error);
      return false;
    }
  }

  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      return true;
    } catch (error) {
      console.error('[VKify] Storage clear error:', error);
      return false;
    }
  }

  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        for (const [key, { newValue }] of Object.entries(changes)) {
          this.cache.set(key, newValue);
          callback(key, newValue);
        }
      }
    });
  }

  notifyChange(key, value) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'STORAGE_CHANGED',
        key,
        value
      }).catch(() => {});
    }
  }
}

const storage = new StorageManager();