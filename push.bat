@echo off
cd /d "%~dp0"

if exist .git\index.lock (
    del .git\index.lock
    echo Lock eliminado.
)

git add public/rules.json src/background/service-worker.ts src/synth/ollama.ts src/types.ts vite.config.ts src/ui/Synthesizer.ts src/ui/components/SynthesisView.ts src/ui/main.ts src/ui/styles.css src/sites/dom-utils.ts src/sites/claude.ts src/sites/chatgpt.ts src/synth/markdown.ts src/content/inject.ts

git commit -m "feat: Obsidian - query title, AI Summaries folder, auto-close tab; query doubling; markdown fix"

git push origin multi-ai-v2

echo.
echo Listo. Podes cerrar esta ventana.
pause
