/**
 * src/js/visibility-fixer.js
 * 
 * CRITICAL: This script MUST be loaded as a plain <script> tag (non-module) 
 * at the absolute top of the <head> to be effective.
 * 
 * This script overrides the Page Visibility API to prevent the YouTube iframe 
 * from detecting that the tab is hidden or backgrounded.
 */

(function () {
    'use strict';

    // 1. Storage for real state
    let _realHidden = false;
    let _realVisibilityState = 'visible';

    // 2. Override Property Descriptors
    const spoofProperty = (obj, prop, value) => {
        try {
            Object.defineProperty(obj, prop, {
                get: function () {
                    // Internal check: if we are inside our own override, allow real value if needed
                    // otherwise ALWAYS return spoofed "visible" state.
                    return value;
                },
                set: function () { }, // Block external changes
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            console.warn('[VisibilityFixer] Failed to spoof:', prop);
        }
    };

    // Spoof standard and webkit/ms prefixes
    ['hidden', 'webkitHidden', 'mozHidden', 'msHidden'].forEach(p => spoofProperty(Document.prototype, p, false));
    ['visibilityState', 'webkitVisibilityState', 'mozVisibilityState', 'msVisibilityState'].forEach(p => spoofProperty(Document.prototype, p, 'visible'));

    // 3. Block Event Listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        const lowerType = (type || '').toLowerCase();
        
        // Block visibilitychange events from external libraries (like YT API)
        if (lowerType.includes('visibilitychange')) {
            // console.log('[VisibilityFixer] Blocked listener for:', type);
            return;
        }
        
        return originalAddEventListener.apply(this, arguments);
    };

    // 4. Handle Real State internally (for our own app logic)
    // We can use a custom property to track the REAL state if we ever need it.
    const realStateDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    if (realStateDescriptor && realStateDescriptor.get) {
        Object.defineProperty(document, '_realVisibilityState', {
            get: function () {
                return realStateDescriptor.get.call(document);
            }
        });
    }

    console.log('[VisibilityFixer] Deep Masking Active');
})();
