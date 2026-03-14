(function() {

  'use strict';

  // ── Step 1: Override document.hidden ───
  // Always report page as visible
  // so YouTube never triggers pause

  try {
    Object.defineProperty(document, 'hidden', {
      get: function() { return false; },
      configurable: true
    });
  } catch(e) {
    // Some browsers may throw if already
    // defined as non-configurable
    console.warn('[FM] hidden override failed:', e);
  }

  // ── Step 2: Override visibilityState ───
  // Always report 'visible'

  try {
    Object.defineProperty(
      document, 'visibilityState', {
        get: function() { return 'visible'; },
        configurable: true
      }
    );
  } catch(e) {
    console.warn(
      '[FM] visibilityState override failed:', e);
  }

  // ── Step 3: Block visibilitychange event ─
  // Intercept in capture phase so our
  // handler runs before ALL other listeners
  // including YouTube's internal listeners.
  // stopImmediatePropagation prevents the
  // event from reaching any other listener.

  document.addEventListener(
    'visibilitychange',
    function(event) {
      event.stopImmediatePropagation();
      // Do NOT call preventDefault here —
      // that would cause errors in strict mode
      // stopImmediatePropagation is enough
    },
    true  // ← capture phase, CRITICAL
  );

  // ── Step 4: Block on window too ────────
  // Some implementations fire on window
  // as well — block that too

  window.addEventListener(
    'visibilitychange',
    function(event) {
      event.stopImmediatePropagation();
    },
    true
  );

  // ── Step 5: Override Page Visibility
  //    on the document object prototype ───
  // Belt and suspenders approach —
  // overrides at prototype level too
  // in case YouTube reads from prototype

  try {
    Object.defineProperty(
      Document.prototype, 'hidden', {
        get: function() { return false; },
        configurable: true
      }
    );
  } catch(e) {}

  try {
    Object.defineProperty(
      Document.prototype, 'visibilityState', {
        get: function() { return 'visible'; },
        configurable: true
      }
    );
  } catch(e) {}

  // ── Step 6: Intercept addEventListener ─
  // Some YouTube versions dynamically add
  // visibilitychange listeners after load.
  // We wrap addEventListener to intercept
  // any future attempts to listen to this
  // event and neutralize them.

  const _originalAddEventListener =
    document.addEventListener.bind(document);

  document.addEventListener = function(
    type, listener, options) {

    if (type === 'visibilitychange') {
      // Wrap the listener so it never fires
      // when document is actually hidden
      const wrappedListener = function(event) {
        // Pretend we are always visible
        // by not calling the original listener
        // when page is actually hidden
        // This effectively disables YouTube's
        // pause-on-hide behavior
        return;
      };
      return _originalAddEventListener(
        type, wrappedListener, options);
    }

    // All other events pass through normally
    return _originalAddEventListener(
      type, listener, options);
  };

  // ── Step 8: Override hasFocus ──────────────────────────
  // Always report as focused

  try {
    Object.defineProperty(document, 'hasFocus', {
      value: function() { return true; },
      configurable: true
    });
  } catch(e) {}

  // ── Step 9: Block blur and focus events ────────────────
  // Prevents YouTube from detecting when the window loses focus

  window.addEventListener('blur', function(e) { e.stopImmediatePropagation(); }, true);
  window.addEventListener('focus', function(e) { e.stopImmediatePropagation(); }, true);

  // ── Step 10: Legacy and Property-style overrides ──────
  // Support webkit-prefixed versions and property-style listeners

  try {
    Object.defineProperty(document, 'webkitHidden', { get: function() { return false; }, configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: function() { return 'visible'; }, configurable: true });
    
    // Nullify existing handler properties to prevent 'leakage'
    document.onvisibilitychange = null;
    window.onvisibilitychange = null;
    window.onblur = null;
    window.onfocus = null;
  } catch(e) {}

  console.log(
    '[FM] Page Visibility spoof active ✓');

})();
