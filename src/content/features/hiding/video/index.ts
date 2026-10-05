import type { FeatureManager } from '@/content/core/feature-manager.js';
import { cssPlugin, handlerFeature } from '@/content/core/features/index.js';
import { createVideoLayoutFeature } from './layout.js';
import { createPlaylistCollapse } from './playlist.js';

export function registerVideoHiding(manager: FeatureManager): void {
  const cssFiles = ['hiding/video/video.css'];
  manager.registerDefinitions([
    ...(['hide_video_comments', 'hide_video_recommendations', 'hide_video_categories', 'hide_video_login_prompt', 'hide_video_playlist'] as const).map(id =>
      handlerFeature({ id, name: id, category: 'hiding', requiresDomLayer: true, cssFiles,
        plugins: [cssPlugin(cssFiles)], handler: createVideoLayoutFeature(manager, id) })),
    handlerFeature({ id: 'collapse_video_playlist', name: 'Свернуть плейлист', category: 'hiding',
      requiresDomLayer: true, cssFiles, plugins: [cssPlugin(cssFiles)], handler: createPlaylistCollapse(manager) }),
  ]);
}
