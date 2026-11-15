import { cssPlugin, settingsPlugin, type FeatureDefinition } from '@/content/core/features/index.js';
import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';
import { POST_SUMMARY_PROVIDERS, postSummaryProviders, type PostSummaryProvider, type PostSummaryInstructions } from '@/shared/post-summary.js';
import { providerOrder } from '@/shared/provider-order.js';

export type PostSummaryFactory = (ctx: ScopedFeatureContext, providers: PostSummaryProvider[], instructions: PostSummaryInstructions) => () => void;
type SummaryGlobal = typeof globalThis & { __VKifyPostSummary?: PostSummaryFactory };
let pending: Promise<PostSummaryFactory> | null = null;
function load(): Promise<PostSummaryFactory> {
  const factory = (globalThis as SummaryGlobal).__VKifyPostSummary;
  if (factory) return Promise.resolve(factory);
  if (!pending) pending = chrome.runtime.sendMessage({ type: 'INJECT_POST_SUMMARY' }).then((result: { ok?: boolean }) => {
    const setup = (globalThis as SummaryGlobal).__VKifyPostSummary;
    if (!result?.ok || !setup) throw new Error('Post summary module unavailable');
    return setup;
  }).catch((error: unknown) => { pending = null; throw error; });
  return pending!;
}

const settingsKeys = ['post_summary_providers', 'post_summary_order', 'post_summary_prompt_ru', 'post_summary_prompt_en'];
export const postSummaryFeature: FeatureDefinition = {
  id: 'post_summary', name: 'Краткая сводка поста', category: 'feed', requiresDomLayer: true,
  reapplyOnNavigate: true, reapplyOnLanguageChange: true, cssFiles: ['center/feed/post-summary.css'], settingsKeys,
  plugins: [cssPlugin(['center/feed/post-summary.css']), settingsPlugin(settingsKeys), {
    name: 'post-summary',
    setup(ctx) {
      let active = true, stop: (() => void) | undefined;
      void Promise.all(settingsKeys.map(key => ctx.getSetting(key))).then(([value, order, ru, en]) => {
        const enabled = postSummaryProviders(value);
        const providers = providerOrder(POST_SUMMARY_PROVIDERS, order ?? enabled).filter(id => enabled.includes(id));
        if (!active || !providers.length) return;
        const instructions = { ru: typeof ru === 'string' ? ru : undefined, en: typeof en === 'string' ? en : undefined };
        return load().then(start => { if (active) stop = start(ctx, providers, instructions); });
      }).catch(() => { /* A later enable/navigation retries a failed module load. */ });
      return () => { active = false; stop?.(); };
    },
  }],
};
