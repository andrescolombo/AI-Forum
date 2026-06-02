import { loadPrefs, patchPrefs } from '@/lib/storage';
import { SITE_IDS } from '@/sites/registry';
import type { DisplayMode, SiteId, SyncedPrefs } from '@/types';

/**
 * Single source of truth for user preferences. Wraps the storage layer and
 * keeps an in-memory copy so the rest of the UI never touches chrome.storage
 * directly or has to juggle the raw `prefs` object.
 */
export class PreferencesManager {
  private prefs!: SyncedPrefs;

  async load(): Promise<void> {
    this.prefs = await loadPrefs();
  }

  /** Full preferences object, for consumers that need the whole snapshot (e.g. SearchBar). */
  get snapshot(): SyncedPrefs {
    return this.prefs;
  }

  get preferredModel(): string | undefined {
    return this.prefs.preferredModel;
  }

  get displayMode(): DisplayMode {
    return this.prefs.displayMode;
  }

  isEnabled(siteId: SiteId): boolean {
    return this.prefs.enabledSites[siteId];
  }

  enabledSiteIds(): SiteId[] {
    return SITE_IDS.filter((id) => this.prefs.enabledSites[id]);
  }

  async setPreferredModel(model: string): Promise<void> {
    this.prefs = await patchPrefs({ preferredModel: model });
  }

  async setSiteEnabled(siteId: SiteId, enabled: boolean): Promise<void> {
    this.prefs = await patchPrefs({
      enabledSites: { ...this.prefs.enabledSites, [siteId]: enabled }
    });
  }

  async toggleDisplayMode(): Promise<DisplayMode> {
    const next: DisplayMode = this.prefs.displayMode === 'modal' ? 'panel' : 'modal';
    this.prefs = await patchPrefs({ displayMode: next });
    return next;
  }
}
