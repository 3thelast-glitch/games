// Require offline-compatible loading for every packaged original game iframe.
// Applies even inside the Capacitor WebView where NAQLA's Node HTTP headers do
// not exist. It blocks external CDNs/signaling/telemetry at page level.
export const offlineGameCsp = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export function embedOfflineCsp(html) {
  const head = /<head\b[^>]*>/i;
  if (!head.test(html)) throw new Error('Cannot package game without HTML head for offline CSP');
  // Refuse accidentally merging multiple conflicting CSP tags from build tools.
  if (/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html)) {
    throw new Error('Upstream game has an independent CSP that needs review');
  }
  return html.replace(head, match =>
    match + '\n<meta http-equiv="Content-Security-Policy" content="' + offlineGameCsp + '">');
}
