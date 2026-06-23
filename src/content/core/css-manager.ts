export class CssManager {
  private readonly styles = new Map<string, HTMLStyleElement>();

  inject(id: string, css: string): void {
    this.remove(id);
    const style = document.createElement('style');
    style.id = `vkify-${id}`;
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
    this.styles.set(id, style);
  }

  remove(id: string): void {
    const el = document.getElementById(`vkify-${id}`);
    if (el) el.remove();
    this.styles.delete(id);
  }

  has(id: string): boolean {
    return this.styles.has(id);
  }

  /** Число инжектированных <style> — для телеметрии производительности. */
  count(): number {
    return this.styles.size;
  }

  /** Суммарный размер инжектированного CSS в байтах (UTF-16 → байты округляем
   *  по длине строки, этого достаточно для индикатора). */
  totalBytes(): number {
    let total = 0;
    for (const style of this.styles.values()) {
      total += style.textContent?.length ?? 0;
    }
    return total;
  }

  clear(): void {
    for (const [id] of this.styles) {
      this.remove(id);
    }
  }
}