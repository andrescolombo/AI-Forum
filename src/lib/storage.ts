import { DEFAULT_PREFS, type SyncedPrefs } from '@/types';

/**
 * Typed wrapper over chrome.storage.sync. Single object key 'prefs' so we
 * don't accumulate orphan top-level keys as the schema evolves.
 */

const KEY = 'prefs';

export async function loadPrefs(): Promise<SyncedPrefs> {
  const raw = await chrome.storage.sync.get(KEY);
  const stored = raw[KEY] as Partial<SyncedPrefs> | undefined;
  const prefs: SyncedPrefs = {
    ...DEFAULT_PREFS,
    ...stored,
    enabledSites: { ...DEFAULT_PREFS.enabledSites, ...(stored?.enabledSites ?? {}) }
  };
  const migration = await chrome.storage.local.get('migration_perplexity_bridge_v1');
  if (!migration.migration_perplexity_bridge_v1) {
    prefs.enabledSites.perplexity = true;
    await chrome.storage.local.set({ migration_perplexity_bridge_v1: true });
    await savePrefs(prefs);
  }
  return prefs;
}

export async function savePrefs(prefs: SyncedPrefs): Promise<void> {
  await chrome.storage.sync.set({ [KEY]: prefs });
}

export async function patchPrefs(patch: Partial<SyncedPrefs>): Promise<SyncedPrefs> {
  const current = await loadPrefs();
  const merged: SyncedPrefs = {
    ...current,
    ...patch,
    enabledSites: { ...current.enabledSites, ...(patch.enabledSites ?? {}) }
  };
  await savePrefs(merged);
  return merged;
}
