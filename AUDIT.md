# Multi-AI Extension Marketplace Audit

This document outlines the results of a comprehensive audit on the Multi-AI v2 extension. It focuses on ensuring compliance with Chrome Web Store and Firefox AMO policies, mitigating legal/privacy risks, and identifying any technical debt that could affect publishing or maintainability.

## 1. Legal, Privacy & Store Policies

### 1.1 Permissions Justification
Extensions must request the narrowest possible permissions. The `manifest.json` currently uses the following sensitive permissions:
*   **`declarativeNetRequest`**: Necessary for stripping `X-Frame-Options` and `Content-Security-Policy` headers. **Store Requirement:** When submitting to the Chrome Web Store, you must provide a clear justification. Ensure you explain that this is specifically to bypass frame-busting on the target AI websites, allowing them to be displayed side-by-side in the extension's UI.
*   **`tabs`**: Used by the background service worker to keep a hidden, active tab of Perplexity. **Store Requirement:** This must be justified as necessary because Perplexity strictly blocks iframe embedding and aggressively drops sessions if handled in a background page.
*   **`scripting`**: Required to inject scripts into AI websites to extract the AI's generated response for synthesis. **Store Requirement:** Must state that it is used to interact with the DOM of the target URLs defined in `host_permissions` to provide the core synthesis functionality.
*   **`host_permissions`**: Currently includes `https://chatgpt.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`, `https://www.perplexity.ai/*`, and `http://localhost:11434/*`. These are appropriately scoped to exactly the domains needed.

### 1.2 Privacy Policy
**Critical Requirement**: Both Google and Mozilla require a Privacy Policy for extensions that handle user data or inject scripts into web pages.
*   **Actionable Advice**: Your Privacy Policy must explicitly state that the extension operates **100% locally**. It reads user prompts and AI responses via DOM scraping, but **does not collect, store remotely, or transmit this data to any developer servers**. Mention that data is only sent to the user's local instance of Ollama (`localhost:11434`) and directly to the explicitly enabled third-party AI services.

### 1.3 Trademarks & Branding
*   **Store Requirement**: App titles and descriptions must not infringe on trademarks.
*   **Actionable Advice**: Do not name the extension "ChatGPT & Claude Multi-AI". Instead, use phrases like "Multi-AI - Compare answers from ChatGPT, Claude, and Gemini". Ensure the icons do not contain logos of OpenAI, Anthropic, or Google.

---

## 2. Security Assessment

### 2.1 Content Security Policy (CSP) & XSS
*   The `manifest.json` uses a strict CSP: `"script-src 'self'; object-src 'self'; frame-src https://chatgpt.com ...;"`. This complies with MV3 requirements.
*   **XSS Mitigation**: The extension uses a custom markdown renderer (`src/synth/markdown.ts`) which receives arbitrary AI outputs and renders them via `innerHTML`. 
    *   *Audit finding:* The implementation escapes all HTML characters (`<`, `>`, `&`, `"`, `'`) **before** applying Markdown tags, and safely escapes code blocks. This robustly prevents Cross-Site Scripting (XSS) attacks from malicious AI outputs.

### 2.2 Remote Code Execution
*   The extension does not fetch or execute remote JavaScript code. The local dependency is Ollama via REST API, which is compliant with MV3 policies against remote code.

---

## 3. Technical Debt & Maintainability

### 3.1 Brittle DOM Selectors (High Risk)
*   **Issue**: The extension scrapes answers by relying on hardcoded CSS selectors in `sites/*.ts` (e.g., `button[aria-label="Send message"]`, `.font-claude-response`). 
*   **Risk**: AI sites frequently update their DOM structures. When this happens, the extension will silently fail to submit prompts or extract answers.
*   **Recommendation**: 
    1. Implement a gracefully degrading error UI if selectors fail (e.g., "ChatGPT UI changed, unable to extract").
    2. Decouple selectors from execution logic into a `.config.ts` file. 
    3. *Crucial:* Set up Playwright/Puppeteer end-to-end tests that run daily to warn you if a site's UI changes, as mentioned in the Backlog.

### 3.2 The "God Node" in `App.ts` (Medium Risk)
*   **Issue**: As identified in the `graphify` report, `App.ts` controls too many distinct domains (IframesGrid, SearchBar, message passing, preferences).
*   **Risk**: As more features are added, this file will become unmaintainable.
*   **Recommendation**: Extract the `IframesGrid` orchestration and the `Background` message passing into separate manager classes.

### 3.3 Perplexity Background Tab Management (Medium Risk)
*   **Issue**: Perplexity is managed as a real browser tab via the service worker instead of an iframe.
*   **Risk**: If the user manually closes the hidden tab, the extension might throw unexpected errors or get stuck in a "waiting" state.
*   **Recommendation**: Abstract the background logic into an `OffscreenTabAdapter` to standardize how the app communicates with sites that block iframes, making it resilient to user interference.

### 3.4 Localhost Hardcoding (Low Risk)
*   **Issue**: `http://localhost:11434` is hardcoded. 
*   **Recommendation**: Provide an options page where users can specify a custom endpoint or port if their local Ollama setup differs.

---

## Conclusion
The extension is in a strong state regarding **Security** and **Permissions**. The primary blockers for immediate publishing are purely administrative (Privacy Policy, Store Descriptions).

The most significant **Technical Debt** is the reliance on hardcoded DOM selectors. Before launching to a wider audience, prioritize the E2E Playwright tests to ensure you can react quickly when AI providers update their interfaces.
