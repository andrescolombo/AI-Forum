import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Multi-AI v2',
  version: '0.1.0',
  description: 'Compare answers from ChatGPT, Claude, Gemini, Perplexity in parallel + local Ollama synthesis.',

  action: {
    default_title: 'Open Multi-AI'
  },

  icons: {
    '16': 'icons/icon-16.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png'
  },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },

  permissions: ['storage', 'tabs', 'scripting', 'declarativeNetRequest'],

  declarative_net_request: {
    rule_resources: [
      {
        id: 'multiai_strip_frame_headers',
        enabled: true,
        path: 'rules.json'
      }
    ]
  },

  host_permissions: [
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'http://localhost:11434/*'
  ],

  content_scripts: [
    {
      matches: [
        'https://chatgpt.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
        'https://www.perplexity.ai/*'
      ],
      js: ['src/content/inject.ts'],
      run_at: 'document_idle',
      all_frames: true
    }
  ],

  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; frame-src https://chatgpt.com https://claude.ai https://gemini.google.com https://www.perplexity.ai;"
  },

  web_accessible_resources: [
    {
      resources: ['src/ui/main.html'],
      matches: ['<all_urls>']
    }
  ]
});
