# Graph Report - .  (2026-05-14)

## Corpus Check
- Corpus is ~13,769 words - fits in a single context window. You may not need a graph.

## Summary
- 359 nodes · 579 edges · 29 communities (13 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ChatGPT Site Adapter|ChatGPT Site Adapter]]
- [[_COMMUNITY_UI Rendering Utilities|UI Rendering Utilities]]
- [[_COMMUNITY_IframesGrid Core Types|IframesGrid Core Types]]
- [[_COMMUNITY_Site Adapter Implementations|Site Adapter Implementations]]
- [[_COMMUNITY_App & Preferences|App & Preferences]]
- [[_COMMUNITY_Perplexity Extraction|Perplexity Extraction]]
- [[_COMMUNITY_Extension UI Shell|Extension UI Shell]]
- [[_COMMUNITY_App Orchestration Flow|App Orchestration Flow]]
- [[_COMMUNITY_IframesGrid Layout|IframesGrid Layout]]
- [[_COMMUNITY_SearchBar Component|SearchBar Component]]
- [[_COMMUNITY_Synthesizer Pipeline|Synthesizer Pipeline]]
- [[_COMMUNITY_Background Bridge Patterns|Background Bridge Patterns]]
- [[_COMMUNITY_Ollama Client|Ollama Client]]
- [[_COMMUNITY_Storage & Preferences|Storage & Preferences]]
- [[_COMMUNITY_Model Selection Flow|Model Selection Flow]]
- [[_COMMUNITY_Project Docs & Roadmap|Project Docs & Roadmap]]
- [[_COMMUNITY_Extension Manifest|Extension Manifest]]
- [[_COMMUNITY_Message Types|Message Types]]
- [[_COMMUNITY_Ollama Model Type|Ollama Model Type]]
- [[_COMMUNITY_Site Response Type|Site Response Type]]
- [[_COMMUNITY_Synthesis Request Type|Synthesis Request Type]]
- [[_COMMUNITY_Sync Action Title|Sync Action Title]]
- [[_COMMUNITY_Request ID Generator|Request ID Generator]]
- [[_COMMUNITY_Ollama Error Type|Ollama Error Type]]
- [[_COMMUNITY_IframesGrid Mount|IframesGrid Mount]]
- [[_COMMUNITY_IframesGrid Panel Attach|IframesGrid Panel Attach]]
- [[_COMMUNITY_SearchBar Handlers Type|SearchBar Handlers Type]]
- [[_COMMUNITY_Markdown Render Usage|Markdown Render Usage]]

## God Nodes (most connected - your core abstractions)
1. `App` - 22 edges
2. `SynthesisPanelView` - 18 edges
3. `SynthesisModalView` - 17 edges
4. `IframesGrid` - 16 edges
5. `SearchBar` - 13 edges
6. `Synthesizer` - 11 edges
7. `chatgptAdapter SiteAdapter` - 10 edges
8. `claudeAdapter SiteAdapter` - 10 edges
9. `perplexityAdapter SiteAdapter` - 10 edges
10. `SiteId` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Extension Icon 128px — convergence arrows design` --references--> `App (main entry)`  [INFERRED]
  public/icons/icon-128.png → src/ui/main.ts
- `stripMarkdown` --semantically_similar_to--> `renderMarkdown`  [INFERRED] [semantically similar]
  src/ui/components/SynthesisView.ts → src/synth/markdown.ts
- `main.html (UI entry point)` --references--> `App (main entry)`  [EXTRACTED]
  src/ui/main.html → src/ui/main.ts
- `TODO — Publish & Roadmap` --references--> `Multi-AI v2 README`  [INFERRED]
  TODO.md → README.md
- `Vite Config` --references--> `Chrome Extension Manifest`  [EXTRACTED]
  vite.config.ts → src/manifest.ts

## Hyperedges (group relationships)
- **Parent-Child Message Roundtrip Protocol** — inject_adapter, messaging_posttoframe, messaging_awaitanswer, types_submitquerymessage, types_answerextractedmessage [INFERRED 0.90]
- **Site Adapter Pattern (SiteAdapter + DOM Utils + Registry)** — types_siteadapter, index_adapters, domutils_typeintocontenteditable, domutils_textofall, domutils_queryselectorany [INFERRED 0.90]
- **Perplexity Background Tab Bridge** — serviceworker_handleperplexitymessage, serviceworker_extractperplexityfromtab, serviceworker_extractperplexityinpage, types_backgroundrequest, types_backgroundresponse [EXTRACTED 1.00]
- **Full Synthesis Pipeline: Query → OllamaClient → SynthesisView** — synthesizer_synthesize, prompt_buildsynthesisprompt, ollama_generate, synthesisview_synthesisview, markdown_rendermarkdown [INFERRED 0.95]
- **Prompt Improvement Pipeline: SearchBar → OllamaClient → App.onSubmit** — searchbar_improveprompt, prompt_buildpromptimprovementprompt, main_app_onsubmit, ollama_generate [INFERRED 0.90]
- **Modal & Panel Views sharing SynthesisView interface** — synthesisview_synthesisview, synthesisview_synthesismodalview, synthesisview_synthesispanelview, synthesizer_synthesizer [EXTRACTED 1.00]

## Communities (29 total, 16 thin omitted)

### Community 0 - "ChatGPT Site Adapter"
Cohesion: 0.07
Nodes (39): ANSWER_SELECTORS, chatgptAdapter, COMPOSE_SELECTORS, STREAMING_SELECTORS, SUBMIT_SELECTORS, ANSWER_SELECTORS, claudeAdapter, COMPOSE_SELECTORS (+31 more)

### Community 1 - "UI Rendering Utilities"
Cohesion: 0.05
Nodes (11): buildActionBar(), buildHeader(), buildProgressBar(), buildPromptBox(), escapeHtml(), SynthesisModalView, SynthesisPanelView, SynthesisView (+3 more)

### Community 2 - "IframesGrid Core Types"
Cohesion: 0.1
Nodes (32): FrameRef, IframesGridOptions, MirrorRef, SearchBarHandlers, adapter, handledSubmits, result, awaitAnswer() (+24 more)

### Community 3 - "Site Adapter Implementations"
Cohesion: 0.09
Nodes (38): chatgptAdapter SiteAdapter, clickChatGptSend Function, findSendButtonNear (ChatGPT), isUsableSendButton (ChatGPT), claudeAdapter SiteAdapter, clickClaudeSend Function, clickLikeUser Function, findSendButtonNear (Claude) (+30 more)

### Community 4 - "App & Preferences"
Cohesion: 0.15
Nodes (6): loadPrefs(), patchPrefs(), savePrefs(), DEFAULT_PREFS, App, sleep()

### Community 5 - "Perplexity Extraction"
Cohesion: 0.15
Nodes (14): cleanPerplexityLines(), cleanPerplexityText(), ensurePerplexityTab(), extractAnswerFromVisibleText(), extractPerplexityFromTab(), findPerplexityTab(), handlePerplexityMessage(), isLikelyUiLine() (+6 more)

### Community 6 - "Extension UI Shell"
Cohesion: 0.12
Nodes (22): Extension Icon 128px — convergence arrows design, IframesGrid, Mirror Panel (Perplexity display), IframesGrid.setMirrorContent, App (main entry), main.html (UI entry point), escapeAttr (markdown), escapeHtml (markdown) (+14 more)

### Community 7 - "App Orchestration Flow"
Cohesion: 0.11
Nodes (20): FrameRef, IframesGrid.submitViaUrl, App.init, App.onSubmit, App.onSynth, App.pollPerplexityAnswer, App.scheduleDomSubmissions, App.sendBackground (+12 more)

### Community 11 - "Background Bridge Patterns"
Cohesion: 0.24
Nodes (10): Ollama CORS Proxy via Service Worker, Perplexity Background Tab Bridge Pattern, ensurePerplexityTab Function, extractPerplexityFromTab Function, extractPerplexityInPage (injected function), findPerplexityTab Function, handleOllamaMessage Function, handlePerplexityMessage Function (+2 more)

### Community 13 - "Storage & Preferences"
Cohesion: 0.5
Nodes (5): loadPrefs Function, patchPrefs Function, savePrefs Function, DEFAULT_PREFS Constant, SyncedPrefs Interface

### Community 14 - "Model Selection Flow"
Cohesion: 0.5
Nodes (4): OllamaClient.listModels, OllamaClient.listRunningModels, OllamaClient.pickDefaultModel, Synthesizer.refreshModelList

### Community 15 - "Project Docs & Roadmap"
Cohesion: 0.67
Nodes (4): Multi-AI v2 README, SiteAdapter Pattern, v1 vs v2 Architecture Comparison, TODO — Publish & Roadmap

## Knowledge Gaps
- **80 isolated node(s):** `SubmitQueryMessage`, `ExtractAnswerMessage`, `AnyMessage`, `SynthesisRequest`, `UI_URL` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App` connect `App & Preferences` to `IframesGrid Core Types`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `SynthesisPanelView` connect `UI Rendering Utilities` to `IframesGrid Core Types`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `SynthesisModalView` connect `UI Rendering Utilities` to `IframesGrid Core Types`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `SubmitQueryMessage`, `ExtractAnswerMessage`, `AnyMessage` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ChatGPT Site Adapter` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `UI Rendering Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `IframesGrid Core Types` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._