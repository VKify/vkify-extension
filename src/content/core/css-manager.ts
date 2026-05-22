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

  clear(): void {
    for (const [id] of this.styles) {
      this.remove(id);
    }
  }
}