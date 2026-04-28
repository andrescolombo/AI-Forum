/**
 * Background service worker. The only job in v2 is to open the main UI page
 * in a new tab when the user clicks the extension's toolbar icon.
 *
 * Why a new tab and not a popup? The UI hosts iframes for the AI sites; popups
 * are too small to be useful and Chrome detaches them on focus loss.
 */

const UI_URL = chrome.runtime.getURL('src/ui/main.html');

chrome.action.onClicked.addListener(async () => {
  // If a Multi-AI tab is already open, focus it instead of opening another.
  const existing = await chrome.tabs.query({ url: UI_URL });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: UI_URL });
});
