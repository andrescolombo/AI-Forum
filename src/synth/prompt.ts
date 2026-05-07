import { SITES } from '@/sites/registry';
import type { SiteResponse } from '@/types';

/**
 * Build a synthesis prompt from the user's question and the AIs' responses.
 *
 * Output format mirrors the user's Obsidian note style:
 *   ---
 *   category: AI
 *   tags: [ai-synthesis, tag1, tag2]
 *   ---
 *   # Título
 *
 *   (síntesis)
 */

const TARGET_TOTAL_CHARS = 22000;

export function buildSynthesisPrompt(query: string, responses: SiteResponse[]): string {
  if (responses.length === 0) {
    throw new Error('buildSynthesisPrompt: no responses to synthesize');
  }

  const perResponseCap = Math.floor(TARGET_TOTAL_CHARS / responses.length);

  const sections = responses
    .map(({ siteId, text }) => {
      const header = SITES[siteId]?.displayName ?? siteId;
      const trimmed = text.length > perResponseCap
        ? text.slice(0, perResponseCap) + `\n[…truncado: ${text.length - perResponseCap} chars más]`
        : text;
      return `## ${header}\n\n${trimmed.trim()}`;
    })
    .join('\n\n---\n\n');

  return [
    'Sos un asistente que sintetiza respuestas de varios modelos de IA en una sola respuesta clara, en español.',
    '',
    'Tu respuesta DEBE seguir EXACTAMENTE esta estructura (sin agregar nada antes del frontmatter):',
    '',
    '---',
    'category: AI',
    'tags: [ai-synthesis, tag2, tag3, tag4]',
    '---',
    '# Título descriptivo y breve',
    '',
    '(contenido de la síntesis en Markdown)',
    '',
    'Reglas para el frontmatter:',
    '- "category" siempre es "AI".',
    '- El primer tag SIEMPRE es "ai-synthesis".',
    '- Agregá entre 2 y 5 tags adicionales que describan el tema. Palabras simples, minúsculas, sin espacios (guión medio si hace falta).',
    '',
    'Reglas para el contenido:',
    '- Identificá los puntos en los que coinciden las IAs — esos son los más confiables.',
    '- Marcá las contradicciones o discrepancias importantes (mencionando qué AI dijo qué).',
    '- Combiná las mejores partes en una respuesta unificada y bien estructurada.',
    '- Si alguna AI agrega algo único y valioso, conservalo y atribuílo brevemente.',
    '- Si las respuestas están vacías o cortadas, mencionalo al principio.',
    '- Nada de "Como inteligencia artificial..." ni disculpas.',
    '',
    `# Pregunta del usuario\n\n${query}`,
    '',
    `# Respuestas de las IAs\n\n${sections}`,
    '',
    '# Tu síntesis'
  ].join('\n');
}

/**
 * Prompt sent to the local judge model to improve the user's raw query
 * using prompt-engineering best practices.
 * The model must return ONLY the improved prompt — no preamble, no quotes.
 */
export function buildPromptImprovementPrompt(query: string): string {
  return [
    'Sos un experto en ingeniería de prompts.',
    'Tu única tarea es tomar la pregunta del usuario y reescribirla como un prompt más efectivo para modelos de lenguaje grandes.',
    '',
    'Reglas estrictas:',
    '- Sé específico, claro y bien estructurado.',
    '- Añadí contexto útil si le falta.',
    '- Pedí el formato de respuesta ideal cuando sea relevante.',
    '- Si la pregunta es técnica, especificá el nivel de detalle esperado.',
    '- Conservá el idioma original de la pregunta.',
    '- Devolvé ÚNICAMENTE el prompt mejorado — sin explicaciones, sin comillas, sin preámbulos, sin texto adicional.',
    '',
    `Pregunta original: ${query}`,
    '',
    'Prompt mejorado:'
  ].join('\n');
}
