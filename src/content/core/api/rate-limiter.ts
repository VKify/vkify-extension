/**
 * Очередь вызовов VK API: ограничивает параллелизм и делает retry с backoff'ом
 * на flood-ошибках VK («Too many requests» / «Flood control»).
 *
 * Зачем не полная сериализация: многие потоки уже сами пэйсятся (постраничная
 * выгрузка альбома/истории спит между страницами). Жёсткий глобальный лок их бы
 * замедлил. Поэтому здесь — семафор с лимитом параллелизма (не latency-floor),
 * а реальную защиту от всплесков даёт retry на flood-ответах.
 */

const FLOOD_RE = /too many requests|flood/i;

export interface ApiQueueOptions {
  /** Максимум одновременных вызовов. */
  concurrency?: number;
  /** Сколько раз повторить вызов на flood-ошибке. */
  maxRetries?: number;
  /** База задержки backoff'а (умножается на номер попытки). */
  retryBaseMs?: number;
}

export class ApiQueue {
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  /** Сейчас занятых слотов параллелизма. */
  private active = 0;
  /** Резолверы ожидающих вызовов (FIFO). */
  private readonly waiters: Array<() => void> = [];

  constructor(opts: ApiQueueOptions = {}) {
    this.concurrency = opts.concurrency ?? 4;
    this.maxRetries  = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 600;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this._acquire();
    try {
      return await this._withRetry(task);
    } finally {
      this._release();
    }
  }

  private _acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    // Слот занят — встаём в очередь; разбудивший нас release() передаёт свой слот
    // (active не трогаем — он «наследуется», см. _release).
    return new Promise<void>(resolve => this.waiters.push(resolve));
  }

  private _release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();            // передаём активный слот следующему — active не меняется
    } else {
      this.active--;     // желающих нет — освобождаем слот
    }
  }

  private async _withRetry<T>(task: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await task();
      } catch (err) {
        lastErr = err;
        const floodable = FLOOD_RE.test((err as Error)?.message ?? '');
        if (!floodable || attempt === this.maxRetries) throw err;
        await new Promise(r => setTimeout(r, this.retryBaseMs * (attempt + 1)));
      }
    }
    throw lastErr;
  }
}
