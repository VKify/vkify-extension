import { startPostSummary } from './post-summary-runtime.js';
import type { PostSummaryFactory } from './post-summary.js';
(globalThis as typeof globalThis & { __VKifyPostSummary?: PostSummaryFactory }).__VKifyPostSummary = startPostSummary;
