import type { FeatureContext } from '../../core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { SELECTORS } from '@/content/selectors/index.js';

export function createAutoAddFriendsFeature(ctx: FeatureContext): FeatureMap {
  let isRunning = false;
  let addCount = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const randomDelay = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const randomScrollTo = (element: Element): void => {
    const randomOffset = Math.floor(Math.random() * 501) - 100;
    const elementPosition = element.getBoundingClientRect().top + window.scrollY + randomOffset;
    window.scrollTo({ top: elementPosition, behavior: 'smooth' });
  };

  const updateStats = (): void => {
    chrome.storage.local.set({ auto_add_stats: { added: addCount, isRunning } });
  };

  return {
    auto_add_friends: {
      matchPath: (pathname) => pathname.startsWith('/friends'),

      enable: async () => {
        if (!window.location.href.includes('vk.ru/friends')) {
          console.log('[VKify] Auto-add: not on friends page');
          return;
        }

        const settings = await ctx.getAllSettings();
        const maxPerHour = (settings['auto_add_limit'] as number) ?? 50;
        const delayMin = ((settings['auto_add_delay_min'] as number) ?? 20) * 1000;
        const delayMax = ((settings['auto_add_delay_max'] as number) ?? 40) * 1000;

        isRunning = true;
        addCount = 0;
        updateStats();

        const addFriend = (): void => {
          if (!isRunning || addCount >= maxPerHour) {
            if (addCount >= maxPerHour) {
              console.log('[VKify] Достигнут лимит добавлений');
            }
            isRunning = false;
            updateStats();
            return;
          }

          // Migrated to new DOM layer: кандидаты кнопки — SELECTORS.friends.addButtonCandidates.
          const addButtons = Array.from(
            document.querySelectorAll(SELECTORS.friends.addButtonCandidates)
          ).filter(btn => {
            const text = btn.textContent?.trim().toLowerCase() || '';
            return (text === 'добавить' || text === 'добавить в друзья') &&
                   !(btn.closest('button') as HTMLButtonElement | null)?.disabled;
          });

          if (addButtons.length > 0) {
            const randomButton = addButtons[Math.floor(Math.random() * addButtons.length)];
            randomScrollTo(randomButton);

            timeoutId = setTimeout(() => {
              if (!isRunning) return;

              const clickTarget = randomButton.closest('button') || randomButton;
              (clickTarget as HTMLElement).click();

              addCount++;
              console.log(`[VKify] Добавлен друг! Всего: ${addCount}/${maxPerHour}`);
              updateStats();

              timeoutId = setTimeout(addFriend, randomDelay(delayMin, delayMax));
            }, Math.floor(Math.random() * 3000) + 1000);
          } else {
            console.log('[VKify] Нет доступных кнопок, скроллим...');
            window.scrollBy({ top: 500, behavior: 'smooth' });
            timeoutId = setTimeout(addFriend, 5000);
          }
        };

        timeoutId = setTimeout(addFriend, randomDelay(delayMin, delayMax));
        console.log('[VKify] Авто-добавление друзей запущено');
      },

      disable: () => {
        isRunning = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        updateStats();
        console.log('[VKify] Авто-добавление друзей остановлено');
      },
    },

    auto_add_limit: { enable: () => {}, disable: () => {} },
    auto_add_delay_min: { enable: () => {}, disable: () => {} },
    auto_add_delay_max: { enable: () => {}, disable: () => {} },
  };
}
