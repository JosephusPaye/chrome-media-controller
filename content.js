function proxyMediaSession() {
  const actionHandlers = new Map();

  function sendToContentScript(data) {
    const message = { from: 'CMC_INJECTED', data };
    window.postMessage(message, '*');
  }

  function syncState(target, extra = {}) {
    let metadata = null;

    if (target.metadata) {
      const { title, artist, album, artwork } = target.metadata;
      metadata = { title, artist, album, artwork };
    }

    sendToContentScript({
      type: 'sync',
      state: {
        metadata,
        playbackState: target.playbackState,
      },
      actions: [...actionHandlers.keys()],
      ...extra,
    });
  }

  const handler = {
    get(target, key) {
      const value = target[key];

      if (typeof value === 'function') {
        // Bind the function's this to the target object
        const fn = value.bind(target);

        // If the setActionHandler() method is being called, wrap
        // it in a proxy so we can call those handlers manually later
        if (key === 'setActionHandler') {
          function setActionHandlerProxy(action, handler) {
            if (handler === null) {
              // null is used to remove action handlers
              actionHandlers.delete(action);

              // Send updated state to reflect the removed action
              syncState(target, { actionRemoved: action });
            } else {
              // add the handler to our list of action handlers
              // so we can e.g. manually call play(), pause(), etc
              actionHandlers.set(action, handler);

              // Send updated state to reflect the added action
              syncState(target, { actionAdded: action });
            }

            // Call the original setActionHandler() to register the handler with the browser
            fn(action, handler);
          }

          // Return the proxied setActionHandler()
          return setActionHandlerProxy;
        }

        // Return the bound function which wasn't setActionHandler()
        return fn;
      }

      // Return the non-function value
      return value;
    },

    set(target, key, value) {
      target[key] = value;

      // Send updated state
      syncState(target);

      return true;
    },
  };

  Object.defineProperty(navigator, 'mediaSession', {
    value: new Proxy(navigator.mediaSession, handler),
    enumerable: navigator.propertyIsEnumerable('mediaSession'),
    configurable: true,
    writable: false,
  });

  window.cmcActionHandlers = actionHandlers;

  window.addEventListener(
    'message',
    function (event) {
      const message = event.data;

      // Ignore messages not from the content script
      if (event.source !== window || message.from !== 'CMC_CONTENT') {
        event.returnValue = false;
        return;
      }

      if (message.data.action) {
        const handler = actionHandlers.get(message.data.action);

        console.log(
          '[cmc injected] triggering action from content script',
          handler,
        );

        if (handler) {
          handler({ action: message.data.action });
        } else {
          console.log('[cmc injected] action not found:', message.data);
        }
      } else {
        console.log('message from content script without action', message);
      }

      event.returnValue = true;
    },
    false,
  );
}

function injectProxy() {
  const scriptEl = document.createElement('script');
  scriptEl.textContent = `(${proxyMediaSession.toString()})();`;

  (document.head || document.documentElement).appendChild(scriptEl);

  scriptEl.remove();
}

function sendToInjectedScript(data) {
  const message = { from: 'CMC_CONTENT', data };
  window.postMessage(message, '*');
}

window.addEventListener(
  'message',
  function (event) {
    const message = event.data;

    // Ignore messages not from the injected script
    if (event.source !== window || message.from !== 'CMC_INJECTED') {
      event.returnValue = false;
      return;
    }

    console.log(
      '[cmc content.js] message received from injected script, forwarding to background',
      message,
    );

    chrome.runtime.sendMessage({ from: 'CMC_CONTENT', data: message.data });

    event.returnValue = true;
  },
  false,
);

window.addEventListener('unload', function () {
  console.log('on unload, sending message to background');
  chrome.runtime &&
    chrome.runtime.sendMessage({
      from: 'CMC_CONTENT',
      data: { type: 'unload' },
    });
});

let currentFrameId = 0;

chrome.extension.onMessage.addListener(function (message) {
  if (message.frameId === currentFrameId) {
    console.log('message from background', message);
    sendToInjectedScript(message);
  }

  return true;
});

chrome.runtime.sendMessage(
  { from: 'CMC_CONTENT', data: { type: 'get-frame-id' } },
  function (response) {
    currentFrameId = response.frameId;
  },
);

injectProxy();
