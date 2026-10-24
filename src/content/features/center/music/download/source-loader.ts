import Hls from 'hls.js/light';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';
import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { BackgroundLoader, parseAndRewriteManifest } from './bg-loader.js';

/** Supply the already fetched root playlist; delegate all other HLS resources. */
export function createSourceLoader(url: string, manifest: string): typeof Hls.DefaultConfig.loader {
  const BaseLoader: typeof Hls.DefaultConfig.loader = IS_FIREFOX ? BackgroundLoader : Hls.DefaultConfig.loader;
  const text = IS_FIREFOX ? parseAndRewriteManifest(manifest, url) : manifest;
  return class extends BaseLoader {
    abort(): void {
      this.stats.aborted = true;
      super.abort();
    }

    destroy(): void {
      this.stats.aborted = true;
      super.destroy();
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
      if (context.url !== url || context.responseType !== 'text') {
        super.load(context, config, callbacks);
        return;
      }
      this.context = context;
      const stats = this.stats;
      stats.aborted = false;
      stats.loading.start = performance.now();
      stats.loaded = stats.total = new TextEncoder().encode(text).length;
      queueMicrotask(() => {
        if (stats.aborted || this.context !== context) return;
        stats.loading.first = stats.loading.end = performance.now();
        callbacks.onSuccess({ url, data: text, code: 200 }, stats, context, null);
      });
    }
  };
}
