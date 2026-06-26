/**
 * Барель сервис-слоя content-скрипта: единый singleton-контейнер, строковые id
 * сервисов и типобезопасный доступ к ним.
 *
 * Сам `ServiceContainer` (service-container.ts) ничего не знает о конкретных
 * сервисах — вся типизация известных сервисов сосредоточена здесь, чтобы
 * контейнер оставался переиспользуемым. Регистрация значений происходит в
 * FeatureManager (он владеет cssManager/scriptInjector/registry и видит
 * глобальные синглтоны domObserver/perfCollector/storage).
 */

import { ServiceContainer } from './service-container.js';
import type { domObserver } from '../dom/index.js';
import type { perfCollector } from '../perf/collector.js';
import type { CssManager } from '../css-manager.js';
import type { ScriptInjector } from '../script-injector.js';
import type { StorageManager } from '../storage.js';
import type { FeatureRegistry } from '../features/feature-registry.js';
import type { EventBus, ContentBusEvents } from './event-bus.js';
import type { Migrator } from '@/shared/storage/Migrator.js';

export { ServiceContainer } from './service-container.js';
export type { ServiceFactory } from './service-container.js';
export { EventBus } from './event-bus.js';
export type { ContentBusEvents, EventListener } from './event-bus.js';

/** Строковые id известных сервисов. */
export const SERVICES = {
  domObserver:     'dom-observer',
  perfCollector:   'perf-collector',
  cssManager:      'css-manager',
  scriptInjector:  'script-injector',
  storage:         'storage',
  featureRegistry: 'feature-registry',
  eventBus:        'event-bus',
  migrator:        'migrator',
} as const;

export type ServiceId = typeof SERVICES[keyof typeof SERVICES];

/** Карта id → тип сервиса. Ключи — литералы значений SERVICES. */
export interface ServiceTypeMap {
  'dom-observer':     typeof domObserver;
  'perf-collector':   typeof perfCollector;
  'css-manager':      CssManager;
  'script-injector':  ScriptInjector;
  'storage':          StorageManager;
  'feature-registry': FeatureRegistry;
  'event-bus':        EventBus<ContentBusEvents>;
  'migrator':         Migrator;
}

/** Глобальный singleton-контейнер content-скрипта. */
export const serviceContainer = new ServiceContainer();

/**
 * Типобезопасный доступ к известным сервисам:
 *   getService(SERVICES.perfCollector).recordApiCall()
 * Тип возвращаемого значения выводится из ServiceTypeMap.
 */
export function getService<K extends keyof ServiceTypeMap>(id: K): ServiceTypeMap[K] {
  return serviceContainer.get<ServiceTypeMap[K]>(id);
}
