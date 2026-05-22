/**
 * Typed constants for ALL inter-context message protocols in the extension.
 *
 * Previously, message type strings were scattered as raw literals across
 * token-service.ts, vk-api-bridge.ts, injected-vk-api.ts, spy.ts, etc.
 * A typo or rename silently breaks communication with no compile error.
 *
 * Three transport layers, one source of truth:
 *   PostMessageType   — window.postMessage (injected ↔ content script)
 *   ContentEventType  — window.dispatchEvent(CustomEvent) (content ↔ injected)
 *
 * chrome.runtime.onMessage types are defined in src/types/index.ts as ExtensionMessage.
 *
 * NOTE: injected/*.ts are classic IIFE scripts — they cannot import this file.
 * Use these constants in content script and background code only. Injected scripts
 * use the same string values inline (verified by the types below).
 */

export const PostMessageType = {
  // injected-vk-api.ts → content/services/token-service.ts
  TOKEN_UPDATE:        'VKIFY_TOKEN_UPDATE',
  TOKEN_RESPONSE:      'VKIFY_TOKEN_RESPONSE',
  TOKEN_REQUEST:       'VKIFY_REQUEST_TOKEN',

  // content/services/token-service.ts → injected-vk-api.ts
  DESTROY:             'VKIFY_DESTROY',

  // injected/vk-api-bridge.ts ↔ content/api/vk-api-client.ts
  NATIVE_API_CALL:      'VKIFY_NATIVE_API_CALL',
  NATIVE_API_RESPONSE:  'VKIFY_NATIVE_API_RESPONSE',
  NATIVE_API_AVAILABLE: 'VKIFY_NATIVE_API_AVAILABLE',
} as const;

export type PostMessageTypeValue = typeof PostMessageType[keyof typeof PostMessageType];

export const ContentEventType = {
  // content script → injected/anti-tracking.ts, ad-feed-blocker.ts, tracker-blocker.ts
  UPDATE_SETTINGS: 'vkify-update-settings',

  // content script → injected/spy.ts
  SPY_CONTROL:     'vkify-spy-control',

  // injected/spy.ts → content script (via message-service.ts)
  SPY_DATA:        'vkify-spy-data',

  // injected/*.ts → content script (signals that handlers are registered)
  SCRIPT_READY:    'vkify-script-ready',
} as const;

export type ContentEventTypeValue = typeof ContentEventType[keyof typeof ContentEventType];