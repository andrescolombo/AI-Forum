# 🧠 AI-Forum — One-Click to compare answers from multiple AIs

---

## ✨ Introduction

**AI-Forum** (formerly "AI Compare") is a browser extension that lets you compare answers from multiple AI models in one place. Enter a query once and see results from ChatGPT, Gemini, Claude, Grok, DeepSeek, Kimi, Doubao, Tencent Yuanbao, and many more — side by side. You use your existing AI accounts; the extension does not require sign-up or paid membership.

### 📦 Features

#### 1. Multi-AI comparison page (iframe)

- **One page, multiple AIs**: Open a single tab with several AI sites embedded (iframes). Enter your query once and get responses from all selected AIs at once.
- **Layout**: Switch between 1 / 2 / 3 / 4 columns.
- **File upload**: Upload files (images, documents, etc.) and send them to all AI sites in one go.
- **Export**: Export all AI responses as a single file (e.g. Markdown).
- **History**: History drawer lists recent comparison sessions; click to reopen a session.
- **Query suggestions**: Prompt templates appear as buttons above the input; one click fills the query (e.g. `Risk Analysis: "{query}"`).
- **Favorite query**: Star the current query to save it to Favorites.
- **Site selection**: Choose which AI sites to load and save as default (collection mode settings).

#### 2. AI Synthesis with Ollama (Local AI)

- **Integrated Synthesis Panel**: A new dedicated panel that appears alongside AI iframes to synthesize multiple responses into one comprehensive answer using local models via Ollama.
- **Real-time Progress Tracking**: Visual progress indicators (pills) show exactly which AIs have finished responding and which are still pending.
- **Markdown Support**: The synthesized response is rendered with rich Markdown formatting for better readability.
- **Model Selection & Control**: Easily switch between local models directly from the panel and re-trigger synthesis as needed.
- **Privacy-First**: Your synthesis happens locally on your machine using Ollama, keeping your data private.


#### 2. Side panel / Homepage

- **Open**: Click the extension icon or press **⌘+M** (Mac) / **Ctrl+M** (Windows).
- **Search & compare**: Type a query, select AI sites, click PK to open the multi-AI comparison page (or open in new tab).
- **Save favorite sites**: Select sites and save as “favorite sites” for quick access.
- **Pin guide**: Optional reminder to pin the extension to the toolbar for faster access.
- **Shortcuts**: Links to Settings, History, Favorites, Feedback. Optional file upload button.

#### 3. Floating ball (optional)

- **Where**: Shown on web pages when enabled in settings (default: off).
- **Action**: Click to open the side panel; drag to move.
- **Close**: Close button offers: close for now, disable on current site only, or disable globally.
- **Extra**: Small icons for Settings and Feedback.

#### 4. Selection toolbar (optional)

- **Trigger**: Select text on any page; a toolbar appears near the selection.
- **Favorite site**: One click sends the selected text to your saved “favorite” AI site (single site).
- **Site list**: Dropdown to pick another AI site for this query.
- **PK**: Send selected text to the multi-AI comparison page.  
  Can be turned off in Options.

#### 5. Search engine toolbar (optional)

- **Where**: Google, Baidu, Bing (and cn.bing.com).
- **What**: A small toolbar next to the search box with:
  - **Favorite site**: Run current search query on your favorite AI site (single site).
  - **Site list**: Choose another AI site.
  - **PK**: Open multi-AI comparison with the current search query.  
  Can be turned off in Options.

#### 6. Site button on AI pages (optional)

- **Where**: On supported AI chat pages (e.g. ChatGPT, Claude, Gemini, Kimi) — from `siteHandlers.json` with iframe support.
- **What**: A small extension icon next to the send button.
- **Action**: Click to read the current input, open the multi-AI comparison page with that text as the query.  
  Can be turned off in config.

#### 7. Context menu

- **On extension icon (right‑click)**: Options, History, Favorites.
- **On selected text (right‑click)**: “Search with AI Forum” to query multiple AIs (if “Context Menu” is enabled in Options).

#### 8. Omnibox (address bar)

- **Keyword**: Type `ai` in the address bar, then space and your query (e.g. `ai what is machine learning`).
- **Action**: Opens the multi-AI comparison page with that query (current tab or new tab by how you open it).

#### 9. Options page

- **Quick entry settings**: Toggle on/off: Floating ball, Selection search, Context menu, Search engine toolbar (defaults from `appConfig.json`).
- **Disabled sites**: List of sites where the floating ball is disabled; re-enable from here.
- **Prompt templates**: Add / edit / delete templates (name, query text with `{query}`, display order).
- **Links**: Open History page, Favorites page.

#### 10. History & Favorites pages

- **History**: Full list of past comparison sessions; search and open again; clear history.
- **Favorites**: Saved queries/sessions; search and open again; clear all.

### 🤖 Supported AI sites (examples)

Configured in `siteHandlers.json` (enable/disable per site):  
ChatGPT, Gemini, Grok, Claude, AI Studio, DeepSeek, Doubao, Metaso AI, Wenxin Yiyan, Tencent Yuanbao, Kimi, Qwen, Copilot, POE, Perplexity, Bing, Google, Baidu, etc.

### ❤️ Loved by users worldwide

From content creators, product managers, and freelancers, to editors, foreign trade professionals, and tech enthusiasts — people everywhere are saving time with AI Forum.

> "We use AI Forum every day — it saves us nearly 2 hours of manual work daily. 10/10 would recommend!"
>
> "Amazing tool! Finally, no need to open multiple AI pages — and it supports all major models. Love it!"
>
> "Simple, smart, and powerful — just what I needed."

### 📥 Contact

- Email: AIShortcuts@outlook.com  

### License

This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).
