/**
 * VKify Privacy Protection Module
 * Version: 1.1.0
 * 
 * This script provides privacy controls for VK.com users.
 * 
 * Features:
 * 1. Hide "typing..." status from other users
 * 2. Prevent "read" receipts from being sent
 * 
 * Privacy Statement:
 * - NO user data is collected
 * - NO data is sent to external servers
 * - All settings are stored locally on user's device
 * - User has full control over all features
 * 
 * Technical Implementation:
 * - Intercepts outgoing network requests ONLY
 * - Filters ONLY typing/read status messages
 * - Does NOT modify incoming data
 * - Does NOT access message content
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__vkifyPrivacyModule) return;
  window.__vkifyPrivacyModule = true;
  
  // =====================================================
  // CONFIGURATION
  // =====================================================
  
  // Explicitly defined patterns - nothing else is blocked
  const PRIVACY_FILTERS = Object.freeze({
    typing: Object.freeze([
      'im.setActivity',
      'messages.setActivity',
      'act=typing'
    ]),
    read: Object.freeze([
      'messages.markAsRead',
      'im.markAsRead',
      'act=read'
    ])
  });
  
  // =====================================================
  // SETTINGS MANAGEMENT
  // =====================================================
  
  function getSettings() {
    try {
      return {
        preventTyping: localStorage.getItem('vkify_prevent_typing') === 'true',
        preventRead: localStorage.getItem('vkify_prevent_read') === 'true'
      };
    } catch (e) {
      console.warn('[VKify] Could not read settings:', e.message);
      return { preventTyping: false, preventRead: false };
    }
  }
  
  // =====================================================
  // REQUEST FILTERING
  // =====================================================
  
  /**
   * Checks if a request should be blocked based on user preferences.
   * Only blocks typing/read status - nothing else.
   * 
   * @param {string|object} data - Request data to check
   * @returns {boolean} - True if request should be blocked
   */
  function shouldBlockRequest(data) {
    if (!data) return false;
    
    const settings = getSettings();
    
    // If both features are disabled, skip all checks
    if (!settings.preventTyping && !settings.preventRead) {
      return false;
    }
    
    // Convert data to string for pattern matching
    let dataString = '';
    if (typeof data === 'string') {
      dataString = data;
    } else if (typeof data === 'object') {
      try {
        dataString = JSON.stringify(data);
      } catch (e) {
        return false;
      }
    } else {
      return false;
    }
    
    const dataLower = dataString.toLowerCase();
    
    // Check typing patterns
    if (settings.preventTyping) {
      for (const pattern of PRIVACY_FILTERS.typing) {
        if (dataLower.includes(pattern.toLowerCase())) {
          console.log('[VKify Privacy] Blocked typing indicator (user preference)');
          return true;
        }
      }
    }
    
    // Check read patterns
    if (settings.preventRead) {
      for (const pattern of PRIVACY_FILTERS.read) {
        if (dataLower.includes(pattern.toLowerCase())) {
          console.log('[VKify Privacy] Blocked read receipt (user preference)');
          return true;
        }
      }
    }
    
    return false;
  }
  
  // =====================================================
  // WEBSOCKET WRAPPER
  // Purpose: Filter outgoing typing status messages
  // =====================================================
  
  const OriginalWebSocket = window.WebSocket;
  
  window.WebSocket = function(url, protocols) {
    const ws = protocols 
      ? new OriginalWebSocket(url, protocols) 
      : new OriginalWebSocket(url);
    
    const originalSend = ws.send.bind(ws);
    
    ws.send = function(data) {
      if (shouldBlockRequest(data)) {
        return; // Block only typing/read status
      }
      return originalSend(data);
    };
    
    return ws;
  };
  
  // Preserve WebSocket properties
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  
  // =====================================================
  // XHR WRAPPER
  // Purpose: Filter outgoing read receipts
  // =====================================================
  
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._vkifyRequestUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (shouldBlockRequest(data) || shouldBlockRequest(this._vkifyRequestUrl)) {
      return; // Block only typing/read status
    }
    return originalXHRSend.apply(this, arguments);
  };
  
  // =====================================================
  // FETCH WRAPPER
  // Purpose: Filter outgoing read receipts
  // =====================================================
  
  const originalFetch = window.fetch;
  
  window.fetch = function(resource, init) {
    const url = typeof resource === 'string' ? resource : resource?.url || '';
    const body = init?.body || '';
    
    if (shouldBlockRequest(url) || shouldBlockRequest(body)) {
      // Return empty successful response for blocked requests
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    
    return originalFetch.apply(this, arguments);
  };
  
  // =====================================================
  // SETTINGS UPDATE LISTENER
  // =====================================================
  
  window.addEventListener('vkify-update-settings', function(event) {
    if (event.detail) {
      try {
        if (typeof event.detail.prevent_typing === 'boolean') {
          localStorage.setItem('vkify_prevent_typing', String(event.detail.prevent_typing));
        }
        if (typeof event.detail.prevent_read === 'boolean') {
          localStorage.setItem('vkify_prevent_read', String(event.detail.prevent_read));
        }
      } catch (e) {
        console.warn('[VKify] Could not save settings:', e.message);
      }
    }
  });
  
  // =====================================================
  // INITIALIZATION COMPLETE
  // =====================================================
  
  console.log('[VKify] Privacy protection module loaded');
  
})();