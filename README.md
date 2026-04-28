# Multi-AI v2

Reescritura limpia del comparador multi-AI. Pregunta una sola vez y obtené respuestas en paralelo de ChatGPT, Claude, Gemini y Perplexity, después sintetizalas con Ollama (local o cloud) en una sola respuesta unificada.

## Por qué v2

La v1 (`../Multi AI/`) creció orgánicamente y terminó con archivos de 4500+ líneas, mezcla de responsabilidades (síntesis dentro de iframe.js, estado tirado en chrome.storage sin esquema, selectores DOM sin fallbacks tipados, manejo de mensajes sin tipos). v2 reescribe desde cero con:

- **TypeScript estricto** — tipos compartidos para mensajes (discriminated unions), sites, prefs.
- **SiteAdapter pattern** — cada AI implementa la misma interfaz (`matches/submitQuery/extractAnswer`); agregar otra AI son 30 líneas en un archivo nuevo.
- **Vite + CRXJS** — HMR en desarrollo, build optimizado, manifest definido en TS para que rompa al cambiar el shape.
- **Cero polling de respuesta estable** — el botón "Sintetizar" siempre extrae lo que hay en pantalla en ese instante. Vos decidís cuándo está listo.
- **Streaming markdown** — tokens de Ollama se renderizan en vivo con un parser inline (sin libs externas).
- **Modal o panel N+1** — toggle entre modal centrado o columna extra al lado de los iframes.

## Estructura

```
src/
├── manifest.ts             # Manifest V3 tipado (CRXJS)
├── types.ts                # Single source of truth para mensajes, sites, prefs
├── lib/
│   ├── messaging.ts        # postMessage helpers tipados con timeouts
│   └── storage.ts          # chrome.storage wrapper
├── sites/                  # Un adapter por AI
│   ├── dom-utils.ts        # Helpers para ProseMirror/contenteditable/textarea
│   ├── chatgpt.ts
│   ├── claude.ts
│   ├── gemini.ts
│   ├── perplexity.ts
│   ├── registry.ts         # Descriptores estáticos
│   └── index.ts            # adapterForUrl()
├── content/
│   └── inject.ts           # Content script que enrutea al adapter
├── synth/
│   ├── ollama.ts           # Cliente con streaming NDJSON
│   ├── prompt.ts           # Builder del prompt de síntesis
│   └── markdown.ts         # Parser inline (sin libs)
├── background/
│   └── service-worker.ts   # Abre la página al click del icono
└── ui/
    ├── main.html
    ├── main.ts             # Entry: orquesta App
    ├── styles.css
    ├── Synthesizer.ts      # Orquesta extract + ollama + render
    └── components/
        ├── IframesGrid.ts
        ├── SearchBar.ts
        └── SynthesisView.ts (Modal + Panel)
```

## Setup

```bash
npm install
npm run dev      # Vite con HMR — recarga la extensión cuando cambia algo
npm run build    # Genera dist/
npm run typecheck
```

## Cargar en Chrome

1. `npm run build`
2. `chrome://extensions` → "Modo desarrollador" ON
3. "Cargar descomprimida" → seleccionar la carpeta `dist/`
4. Click en el icono de la extensión → se abre la página de comparación

## Requisitos para la síntesis

- [Ollama](https://ollama.com) corriendo en `localhost:11434`
- Por lo menos un modelo instalado: `ollama pull llama3.1` (o cualquier otro, incluso modelos `:cloud`)

## Diferencias clave con v1

| Aspecto                 | v1 (Multi AI)                                        | v2                                              |
|-------------------------|------------------------------------------------------|-------------------------------------------------|
| Lenguaje                | JS plano                                             | TypeScript estricto                             |
| Build                   | Sin build (carga directa)                            | Vite + CRXJS                                    |
| iframe.js               | 4689 líneas, todo mezclado                           | UI dividida en 6 archivos < 250 líneas cada uno |
| Mensajes                | postMessage sin tipos, requestId opcional            | Discriminated unions tipadas, requestId siempre |
| SiteAdapters            | Configuración JSON + handlers JS dispersos           | Una clase por sitio, contrato uniforme          |
| Síntesis stable         | Polling con detección de "respuesta estable"         | Manual instantáneo (vos elegís el momento)      |
| Markdown                | textContent (texto plano)                            | Parser inline, code/headers/lists/blockquote    |
| Persistencia            | Múltiples claves orphans en chrome.storage           | Una sola clave `prefs` con migración limpia     |

## Roadmap (post-MVP)

- Historial de queries y respuestas (chrome.storage.local)
- Templates de prompts (filtros, formatters)
- Export a markdown/PDF
- Más sitios (DeepSeek, Mistral, AI Studio)
- Tests con Playwright (al menos para los SiteAdapters)
- File upload paralelo

## Licencia

Privado / personal.
