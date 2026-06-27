export { FeatureRegistry, PHASE_ORDER } from './feature-registry.js';
export type {
  FeatureCategory,
  FeatureImpact,
  FeaturePhase,
  FeatureMetadata,
  FeatureMetadataInput,
  FeatureDescriptor,
} from './feature-registry.js';

export { compileFeatureDefinition } from './feature-definition.js';
export type { FeatureDefinition, CompiledFeature } from './feature-definition.js';

export { cssFeature } from './css-feature.js';
export type { CssFeatureOptions } from './css-feature.js';

export { cssPlugin, settingsPlugin, handlerPlugin, scriptPlugin } from './feature-plugin.js';
export type { FeaturePlugin, HandlerLike } from './feature-plugin.js';

export { PluginManager, orderPlugins } from './plugin-manager.js';
export type { FeatureLifecycleHooks } from './plugin-manager.js';

export { createFeatureScope, FeatureScope } from './scoped-context.js';
export type { ScopedFeatureContext } from './scoped-context.js';
