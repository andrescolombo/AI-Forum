# TODO

## Publicar en marketplaces

### Preparación
- [ ] Escribir política de privacidad (requerida por Chrome y Firefox)
- [ ] Revisar uso de nombres de marcas en descripción (ChatGPT, Claude, Gemini, Perplexity)
- [ ] Justificar permisos sensibles en el formulario: `tabs`, `declarativeNetRequest`, `host_permissions`
  - Razón: modificar headers para permitir embedding de los sitios en iframes
- [ ] Preparar capturas de pantalla (mínimo 1 de 1280×800 para Chrome)
- [ ] Documentar la dependencia de Ollama local (localhost:11434) en la descripción

### Chrome Web Store
- [ ] Registrarse en https://chrome.google.com/webstore/devconsole (pago único $5 USD)
- [ ] Buildear y comprimir `dist/` en `.zip`
- [ ] Subir, completar ficha y mandar a revisión (1–7 días hábiles)

### Firefox Add-ons (AMO)
- [ ] Verificar compatibilidad MV3 con Firefox
- [ ] Preparar ZIP del source code + instrucciones de build (requerido si usás bundler)
- [ ] Subir en https://addons.mozilla.org/developers/
