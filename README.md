# Multi-AI v2

Clean rewrite of the multi-AI comparator. Ask once and get parallel answers from ChatGPT, Claude, Gemini, and Perplexity, then synthesize them with Ollama (local or cloud) into a single unified response.

## Why v2

Version 1 (`../Multi AI/`) grew organically and ended up with 4500+ line files, mixed responsibilities (synthesis inside iframe.js, state thrown into chrome.storage without a schema, DOM selectors without typed fallbacks, untyped message handling). v2 is rewritten from scratch with:

- **Strict TypeScript** — shared types for messages (discriminated unions), sites, prefs.
- **SiteAdapter pattern** — every AI implements the same interface (`matches/submitQuery/extractAnswer`); adding another AI is just 30 lines in a new file.
- **Vite + CRXJS** — HMR in development, optimized build, manifest defined in TS so it breaks if the shape changes.
- **Zero stable response polling** — the "Synthesize" button always extracts whatever is on the screen at that instant. You decide when it's ready.
- **Streaming markdown** — Ollama tokens are rendered live with an inline parser (no external libs).
- **Modal or panel N+1** — toggle between a centered modal or an extra column next to the iframes.

## Structure

```text
src/
├── manifest.ts             # Typed V3 Manifest (CRXJS)
├── types.ts                # Single source of truth for messages, sites, prefs
├── lib/
│   ├── messaging.ts        # Typed postMessage helpers with timeouts
│   └── storage.ts          # chrome.storage wrapper
├── sites/                  # One adapter per AI
│   ├── dom-utils.ts        # Helpers for ProseMirror/contenteditable/textarea
│   ├── chatgpt.ts
│   ├── claude.ts
│   ├── gemini.ts
│   ├── perplexity.ts
│   ├── registry.ts         # Static descriptors
│   └── index.ts            # adapterForUrl()
├── content/
│   └── inject.ts           # Content script that routes to the adapter
├── synth/
│   ├── ollama.ts           # NDJSON streaming client
│   ├── prompt.ts           # Synthesis prompt builder
│   └── markdown.ts         # Inline parser (no external libs)
├── background/
│   └── service-worker.ts   # Opens the page on icon click
└── ui/
    ├── main.html
    ├── main.ts             # Entry: orchestrates App
    ├── styles.css
    ├── Synthesizer.ts      # Orchestrates extract + ollama + render
    └── components/
        ├── IframesGrid.ts
        ├── SearchBar.ts
        └── SynthesisView.ts (Modal + Panel)
```

## Setup

```bash
npm install
npm run dev      # Vite with HMR — reloads the extension when something changes
npm run build    # Generates dist/
npm run typecheck
```

## Load in Chrome

1. `npm run build`
2. `chrome://extensions` → "Developer mode" ON
3. "Load unpacked" → select the `dist/` folder
4. Click on the extension icon → the comparison page opens

## Requirements for synthesis

- [Ollama](https://ollama.com) running on `localhost:11434`
- At least one model installed: `ollama pull llama3.1` (or any other, even `:cloud` models)

## Key differences with v1

| Aspect | v1 (Multi AI) | v2 |
|---|---|---|
| Language | Plain JS | Strict TypeScript |
| Build | No build (direct load) | Vite + CRXJS |
| iframe.js | 4689 lines, everything mixed | UI split into 6 files < 250 lines each |
| Messages | Untyped postMessage, optional requestId | Typed discriminated unions, requestId always |
| SiteAdapters | JSON config + scattered JS handlers | One class per site, uniform contract |
| Stable Synthesis | Polling with "stable response" detection | Instant manual (you choose the moment) |
| Markdown | textContent (plain text) | Inline parser, code/headers/lists/blockquote |
| Persistence | Multiple orphan keys in chrome.storage | A single `prefs` key with clean migration |

## Roadmap (post-MVP)

- Query and response history (chrome.storage.local)
- Prompt templates (filters, formatters)
- Export to markdown/PDF
- More sites (DeepSeek, Mistral, AI Studio)
- Tests with Playwright (at least for SiteAdapters)
- Parallel file upload

## License

Private / personal.
