import { SITES } from '@/sites/registry';
import type { SiteResponse } from '@/types';

/**
 * Build a synthesis prompt from the user's question and the AIs' responses.
 *
 * Design choices:
 *   - Every response gets a clear `## SiteName` header so the model can refer
 *     to them by source ("ChatGPT and Claude both said..., Gemini disagreed").
 *   - We cap each response by character count so the total prompt stays under
 *     ~24k chars regardless of how chatty any single AI was. Cap is dynamic
 *     by site count.
 *   - Output language: Spanish, because the user is es-AR and ChatGPT/Claude
 *     usually respond in the language of the question — but Ollama with a
 *     mixed-language prompt sometimes drifts to English. Force it.
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
    'Te paso la pregunta original del usuario y las respuestas que dieron N IAs distintas. Tu tarea:',
    '',
    '1. Identificá los puntos en los que coinciden — esos son los más confiables.',
    '2. Marcá las contradicciones o discrepancias importantes (mencionando qué AI dijo qué).',
    '3. Combiná las mejores partes en una respuesta unificada y bien estructurada.',
    '4. Si alguna AI agrega algo único y valioso, conservalo y atribuilo brevemente.',
    '5. Si las respuestas están vacías o cortadas (porque las pediste antes de que terminaran), decilo al principio en una línea.',
    '',
    'Formato: Markdown. Conciso pero completo. Nada de "Como inteligencia artificial..." y nada de pedir disculpas.',
    '',
    `# Pregunta del usuario\n\n${query}`,
    '',
    `# Respuestas de las IAs\n\n${sections}`,
    '',
    '# Tu síntesis'
  ].join('\n');
}
