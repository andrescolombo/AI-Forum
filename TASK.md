# TASK Tracker

## Active Tasks

### Publish on marketplaces

#### Preparation
- [ ] Write privacy policy (required by Chrome and Firefox)
- [ ] Review use of brand names in description (ChatGPT, Claude, Gemini, Perplexity)
- [ ] Justify sensitive permissions in the form: `tabs`, `declarativeNetRequest`, `host_permissions`
  - Reason: modify headers to allow embedding of the sites in iframes
- [ ] Prepare screenshots (minimum 1 of 1280x800 for Chrome)
- [ ] Document the local Ollama dependency (localhost:11434) in the description

#### Chrome Web Store
- [ ] Register at https://chrome.google.com/webstore/devconsole (one-time fee $5 USD)
- [ ] Build and compress `dist/` into `.zip`
- [ ] Upload, complete store listing, and submit for review (1-7 business days)

#### Firefox Add-ons (AMO)
- [ ] Verify MV3 compatibility with Firefox
- [ ] Prepare ZIP of the source code + build instructions (required if using a bundler)
- [ ] Upload at https://addons.mozilla.org/developers/

---

## Backlog / Architecture Improvements

- [x] **Decouple the "God Node" (`App.ts`)**: Split `App` into smaller, focused managers (e.g., `Orchestrator` for UI/Iframes and `PreferencesManager` for state) to improve maintainability. *(Done: `App` in `src/ui/main.ts` is now a thin orchestrator delegating to `PreferencesManager` (state), `PerplexityBridge` (background-tab messaging) and `IframeSubmitController` (DOM submit retries).)*
- [ ] **Standardize the Background Bridge**: Abstract the `handlePerplexityMessage` background tab logic into a generic `OffscreenTabAdapter` to easily support future sites that block iframes (e.g., DeepSeek, AI Studio).
- [ ] **Resolve Isolated Nodes (Types)**: Centralize scattered discriminated unions (like `SubmitQueryMessage`) into a single `types/messages.ts` registry to improve type-safety and discoverability.
- [ ] **Add Ollama Health Check UI**: Implement a status indicator/graceful degradation if Ollama (`localhost:11434`) is not running, improving the onboarding experience before public release.
- [ ] **Increase SiteAdapter Cohesion**: Refactor adapters (e.g., ChatGPT) by splitting brittle DOM selectors (`ANSWER_SELECTORS`, `COMPOSE_SELECTORS`) into a separate `.config.ts` file, separating configuration from execution logic. *(Partial: duplicated send-button detection across all four adapters consolidated into a single locale-resilient `findSubmitButton`/`waitAndClickSubmit` in `dom-utils.ts`. The `.config.ts` selector split is still pending.)*
- [ ] **Implement Playwright Tests**: Add a minimal end-to-end test suite for the `SiteAdapters` to ensure UI changes in target AI sites don't break the extension silently (required by `AGENTS.md`).
- [ ] **Customizable Prompt Improvement Template**: Provide an option in the extension UI/preferences to edit the prompt optimization instructions (system instructions) sent to Ollama, allowing custom tuning of prompt improvements.
- [ ] **Expandable Prompt Input Height**: Modify the prompt input box to have a default/minimum height of 3 or 4 lines with scroll support, preventing it from remaining a single line when writing longer queries.


