export {
  domObserver,
  type Unsubscribe,
  type Priority,
  type ChangeOpt,
  type ResizeOpt,
} from './dom-observer.js';
export { safeQuerySelector, queryAll, matchesSpec } from './query.js';
export {
  findClosestVkElement,
  exists,
  getText,
  getAttr,
  isAttached,
  specUnion,
} from './dom-utils.js';
export { schedule, type ScheduleOpt } from './schedule.js';
export { SELECTORS } from '@/content/selectors/index.js';
export type { SelectorSpec, SelectorGroup, DynamicSelector } from '@/content/selectors/index.js';
