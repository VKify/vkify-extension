export class ContextGuard {
  private _destroyed = false;
  private readonly _cleanupCallback: (() => void) | undefined;

  constructor(cleanupCallback?: () => void) {
    this._cleanupCallback = cleanupCallback;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  markDestroyed(): void {
    this._destroyed = true;
  }

  isValid(): boolean {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  isContextError(error: unknown): boolean {
    return (error as Error)?.message?.includes('Extension context invalidated') ?? false;
  }

  triggerCleanup(): void {
    if (!this._destroyed) {
      this._cleanupCallback?.();
    }
  }

  async safeExecute<T>(fn: () => T | Promise<T>, fallback: T | null = null): Promise<T | null> {
    if (this._destroyed || !this.isValid()) {
      if (!this._destroyed) this.triggerCleanup();
      return fallback;
    }

    try {
      return await fn();
    } catch (error) {
      if (this.isContextError(error)) {
        this.triggerCleanup();
        return fallback;
      }
      throw error;
    }
  }
}