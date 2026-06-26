import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Типобезопасные авто-селекторы для zustand-store.
 *
 * Превращает `useVKifyStore(s => s.settings)` в `store.use.settings()` —
 * каждый ключ state/экшена получает собственный мемоизированный хук с правильным
 * типом, без ручного описания селектора на каждое поле. Паттерн из официальной
 * документации zustand («Auto Generating Selectors»).
 */
type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export function createSelectors<S extends UseBoundStore<StoreApi<object>>>(
  store: S,
): WithSelectors<S> {
  const withUse = store as WithSelectors<S>;
  withUse.use = {} as WithSelectors<S>['use'];
  for (const key of Object.keys(store.getState())) {
    (withUse.use as Record<string, unknown>)[key] = () =>
      store((state) => state[key as keyof typeof state]);
  }
  return withUse;
}
