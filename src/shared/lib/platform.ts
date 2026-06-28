/** True when running on a macOS / iOS device (best-effort, client-side only). */
export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

/**
 * Label for the Alt/Option modifier in keyboard-shortcut hints.
 * macOS keyboards label this key "⌥ Option" (not "Alt"), though `event.altKey`
 * is still the flag we listen for. Use this for display only.
 */
export const ALT_KEY_LABEL = IS_MAC ? '⌥' : 'Alt';