import { useEffect, useState } from 'react';
import {
  getEmbedViewport,
  subscribeEmbedViewport,
  isEmbedded,
  type EmbedViewport,
} from '../../utils/embedViewport.js';

/**
 * Возвращает видимую полосу iframe для embed-режима, либо null в обычном popup
 * (где `position: fixed` и так совпадает с видимой областью окна).
 */
export function useEmbedViewport(): EmbedViewport | null {
  const [v, setV] = useState<EmbedViewport | null>(() => getEmbedViewport());
  useEffect(() => subscribeEmbedViewport(setV), []);
  return isEmbedded() ? v : null;
}
