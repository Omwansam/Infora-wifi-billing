import gettingStarted from './getting-started.js';
import subscribers from './subscribers.js';
import network from './network.js';
import network2 from './network2.js';
import billing from './billing.js';
import communications from './communications.js';
import analytics from './analytics.js';
import portal from './portal.js';
import reference from './reference.js';
import extra from './extra.js';

/**
 * Every documentation page, keyed by slug.
 *
 * Split across files by section purely so no single module becomes unreadable —
 * the slug namespace is flat, and [nav.js] is what decides where a page appears
 * in the sidebar. A page here with no nav entry is unreachable; a nav entry with
 * no page here renders the not-found state. `npm run docs:check` catches both.
 */
export const PAGES = {
  ...gettingStarted,
  ...subscribers,
  ...network,
  ...network2,
  ...billing,
  ...communications,
  ...analytics,
  ...portal,
  ...reference,
  ...extra,
};

export default PAGES;
