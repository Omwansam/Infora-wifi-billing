import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Height of the sticky navbar — keep section headings clear of it. */
const HEADER_OFFSET = 88;

/**
 * Makes in-page anchor links (e.g. `/#pricing`) actually scroll to their
 * section. React Router doesn't handle hash targets on its own, so without
 * this the navbar/footer links change the URL but never move the page.
 *
 * - With a hash: smooth-scroll to the target, offset for the sticky header.
 *   Retries briefly so it still works when arriving from another route
 *   (the home sections need a tick to mount first).
 * - Without a hash: jump to the top on route change, like a normal page load.
 */
export default function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    let frame;
    let attempts = 0;

    const scrollToTarget = () => {
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        return;
      }
      // Section not mounted yet (e.g. navigating in from another page).
      if (attempts < 20) {
        attempts += 1;
        frame = requestAnimationFrame(scrollToTarget);
      }
    };

    frame = requestAnimationFrame(scrollToTarget);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}
