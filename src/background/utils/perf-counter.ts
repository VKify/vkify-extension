/**
 * Счётчик VK API-вызовов со стороны service worker'а — для Performance Dashboard.
 *
 * Content-сборщик (perfCollector) видит только вызовы из content-скрипта, а
 * спай/профиль-поллеры и запросы попапа идут через background (`callVKApi`).
 * Без этого счётчика «API/мин» в дашборде всегда был бы 0, пока активная
 * вкладка сама не дёрнет VK API. Дёшево: инкремент + кольцо таймстемпов.
 *
 * Счётчик живёт в памяти SW и обнуляется при его перезапуске — это нормально для
 * live-монитора (как и любые рантайм-счётчики).
 */

const WINDOW_MS = 60_000;

let total = 0;
let stamps: number[] = [];

export function recordBgApiCall(): void {
  total++;
  const now = Date.now();
  stamps.push(now);
  const cutoff = now - WINDOW_MS;
  if (stamps[0]! < cutoff) stamps = stamps.filter((t) => t >= cutoff);
}

export function bgApiTotal(): number {
  return total;
}

export function bgApiLastMin(): number {
  const cutoff = Date.now() - WINDOW_MS;
  let n = 0;
  for (const t of stamps) if (t >= cutoff) n++;
  return n;
}
