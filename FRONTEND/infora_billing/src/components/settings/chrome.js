import { createContext, useContext } from 'react';

/**
 * Lets a panel replace the page's display heading with its own.
 *
 * Needed by anything that drills down — the WhatsApp provider list opens a
 * provider, and "WhatsApp providers." sitting above "Infobip" would be a lie —
 * and by gateway panels whose headline is a connection status rather than a
 * topic. A panel calls `setChrome({...})` to take the header over and
 * `setChrome(null)` to hand it back; SettingsPage clears it on every tab
 * change, so a panel can never leak its header onto the next one.
 *
 * This lives in its own module rather than in SettingsPage because the panels
 * that consume it are imported *by* SettingsPage. Exporting the hook from
 * there too would make the cycle SettingsPage → panel → SettingsPage, which
 * bundles today but resolves to `undefined` the moment module evaluation order
 * shifts.
 */
export const ChromeContext = createContext({ setChrome: () => {} });

export function useSettingsChrome() {
  return useContext(ChromeContext);
}
