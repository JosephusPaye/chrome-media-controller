import {
  InjectedToContentMessage,
  ContentToInjectedMessage,
  SessionChange,
} from '../types';

type MediaSessionActionHandler = (details: MediaSessionActionDetails) => void;

/**
 * Proxy the `navigator.mediaSession` API to go through the extension
 */
function proxyMediaSessionApi() {
  /**
   * Log the given messages
   */
  function log(...messages: any) {
    if (__DEV__) {
      console.log('[cmc injected]', ...messages);
    }
  }

  /**
   * Media actions handlers registered by the page
   */
  const actionHandlers = new Map<
    MediaSessionAction,
    MediaSessionActionHandler
  >();

  let hasBeenPlayed = false;

  /**
   * Send the given data to the content script
   */
  function sendToContentScript(data: InjectedToContentMessage['data']) {
    const message = { from: 'CMC_INJECTED', data };
    window.postMessage(message, '*');
  }

  /**
   * Sychronise the state of the given mediaSession
   * with the content script
   */
  function syncState(mediaSession: MediaSession, change: SessionChange) {
    let metadata = null;

    if (mediaSession.metadata) {
      const { title, artist, album, artwork } = mediaSession.metadata;
      metadata = { title, artist, album, artwork };
    }

    hasBeenPlayed = hasBeenPlayed || mediaSession.playbackState === 'playing';

    sendToContentScript({
      type: 'sync',
      change,
      state: {
        metadata,
        playbackState: mediaSession.playbackState,
      },
      actions: [...actionHandlers.keys()],
      hasBeenPlayed,
    });
  }

  /**
   * The `navigator.mediaSession` proxy handler
   */
  const proxyHandler = {
    /**
     * Handle a property access (or method call) on the proxied object
     *
     * @param target The original `navigator.mediaSession` object being proxied
     * @param key    The key being accessed
     */
    get(target: MediaSession, key: PropertyKey) {
      const value = (target as any)[key];

      if (typeof value === 'function') {
        // Bind the function's `this` to the target object
        const fn = value.bind(target);

        // If the `setActionHandler()` method is being called, wrap
        // it so we can intercept the call and save a reference to
        // the action handler, so we can call it later
        if (key === 'setActionHandler') {
          function setActionHandlerWrapped(
            action: MediaSessionAction,
            handler: MediaSessionActionHandler
          ) {
            if (handler === null) {
              // `null` is used to remove action handlers
              actionHandlers.delete(action);

              // Sync state to reflect the removed action
              syncState(target, { type: 'action-removed', action });
            } else {
              // Add the handler to our list of action handlers
              // so we can manually call play(), pause(), etc
              actionHandlers.set(action, handler);

              // Sync state to reflect the added action
              syncState(target, { type: 'action-added', action });
            }

            // Call the default `setActionHandler()` to register
            // the handler with the browser
            fn(action, handler);
          }

          // Return the wrapped `setActionHandler()`
          return setActionHandlerWrapped;
        }

        // Return the bound function which wasn't `setActionHandler()`
        return fn;
      }

      // Return the non-function value
      return value;
    },

    /**
     * Handle a property assignment on the proxied object
     *
     * @param target The original `navigator.mediaSession` object being proxied
     * @param key    The key being assigned
     * @param value  The value being assigned
     */
    set(target: MediaSession, key: PropertyKey, value: any) {
      (target as any)[key] = value;

      // Sync updated state
      syncState(target, {
        type:
          key === 'playbackState'
            ? 'playback-state-changed'
            : 'metadata-changed',
      });

      // Success
      return true;
    },
  };

  // Register the proxy to replace `navigator.mediaSession`
  Object.defineProperty(navigator, 'mediaSession', {
    value: new Proxy(navigator.mediaSession || {}, proxyHandler),
    enumerable: navigator.propertyIsEnumerable('mediaSession'),
    configurable: true,
    writable: false,
  });

  // Listen for messages from the content script
  // on the window.postMessage interface.
  window.addEventListener(
    'message',
    (event: MessageEvent<ContentToInjectedMessage>) => {
      const message = event.data;

      // Ignore messages not from the content script
      if (event.source !== window || message.from !== 'CMC_CONTENT') {
        event.returnValue = false;
        return;
      }

      // Act on action messages like play, pause, etc
      const handler = actionHandlers.get(message.data.action);

      log('triggering action from content script', message.data.action);

      if (handler) {
        handler({ action: message.data.action, ...message.data.actionArgs });
      } else {
        log('action not found:', message.data);
      }

      event.returnValue = true;
    },
    false
  );
}

/**
 * Inject the `navigator.mediaSession` proxy into the page by
 * appending and removing a script tag with the function above
 */
export function injectProxy() {
  const scriptEl = document.createElement('script');
  scriptEl.textContent = `(${proxyMediaSessionApi.toString()})();`;

  (document.head || document.documentElement).appendChild(scriptEl);

  scriptEl.remove();
}
