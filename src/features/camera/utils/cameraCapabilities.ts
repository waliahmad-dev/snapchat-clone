/**
 * Best-effort probe for whether the current device exposes a true ultra-wide
 * (0.5x) lens that our camera layer can actually switch to.
 *
 * Why this exists
 * ---------------
 * expo-camera v17 exposes only `facing` ('back' | 'front') and a normalized
 * `zoom` (0..1) that operates *within* the currently active lens. It has no
 * API to pick between wide / ultra-wide / telephoto modules, so even on an
 * iPhone 15 Pro we cannot actually engage the 0.5x camera. That's why the
 * `.5` and `1` zoom pills were visually distinct but functionally identical.
 *
 * The honest fix is to hide the `.5x` affordance when we know we cannot
 * honour it. When the app migrates to react-native-vision-camera (which *does*
 * expose per-lens control via `getAvailableCameraDevices()` and the
 * `physicalDevices` array), flip this function to do a real probe and
 * restore the 0.5x preset in ZoomBar.
 *
 * Returning a boolean (not a Promise) keeps the call synchronous for render
 * paths — callers can use it inline without useEffect gymnastics.
 */
export function hasUltraWideLens(): boolean {
  // TODO(ultra-wide): replace with a VisionCamera-based probe once the
  // camera layer is migrated. Until then, no device we can drive actually
  // supports 0.5x, so we report false uniformly.
  return false;
}
