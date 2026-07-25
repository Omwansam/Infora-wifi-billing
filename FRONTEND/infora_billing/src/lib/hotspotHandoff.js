/**
 * Hand a subscriber back to the MikroTik hotspot login after they buy or redeem.
 *
 * The router's login page (served by GET /api/portal/captive-redirect) puts its
 * own context on the "Buy a package" link before opening this SPA:
 *
 *   ?link_login=http://172.31.0.1/login&link_orig=…&mac=…&ip=…
 *
 * Without that round trip the subscriber ends up holding credentials with
 * nowhere to type them — the portal runs on the public internet, not on the
 * router. Reading `link_login` back out and re-opening it with the credentials
 * lets the login page auto-submit and put the session online.
 */

/** Hotspot context the router passed into this SPA, or null when not captive. */
export function readHotspotContext(search = window.location.search) {
  const params = new URLSearchParams(search);
  const linkLogin = params.get('link_login');
  if (!linkLogin) return null;
  return {
    linkLogin,
    linkOrig: params.get('link_orig') || '',
    mac: params.get('mac') || '',
    ip: params.get('ip') || '',
  };
}

/**
 * Build the URL that logs `username`/`password` into the hotspot.
 *
 * Points at the router's login page rather than posting straight to
 * `link_login`: the page carries MikroTik's CHAP tokens and handles the POST,
 * and it renders `$(error)` if the credentials are refused.
 */
export function buildHotspotLoginUrl(ctx, username, password) {
  if (!ctx?.linkLogin || !username || !password) return null;
  const url = new URL(ctx.linkLogin, window.location.origin);
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  if (ctx.linkOrig) url.searchParams.set('dst', ctx.linkOrig);
  return url.href;
}

/** Navigate to the hotspot login with credentials. Returns false when not captive. */
export function completeHotspotLogin(username, password, ctx = readHotspotContext()) {
  const target = buildHotspotLoginUrl(ctx, username, password);
  if (!target) return false;
  window.location.href = target;
  return true;
}
