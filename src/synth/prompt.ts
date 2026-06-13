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
        ? text.slice(0, perResponseCap) + `\n[…truncated: ${text.length - perResponseCap} more chars]`
        : text;
      return `## ${header}\n\n${trimmed.trim()}`;
    })
    .join('\n\n---\n\n');

  return [
    'You are an assistant that synthesizes answers from several AI models into a single clear response, in English.',
    '',
    'Your answer MUST follow EXACTLY this structure (without adding anything before the frontmatter):',
    '',
    '---',
    'category: <topic category>',
    'tags: [ai-synthesis, tag2, tag3, tag4]',
    '---',
    '# Short descriptive title',
    '',
    '(synthesis content in Markdown)',
    '',
    'Rules for the frontmatter:',
    '- "category" must be A SINGLE WORD in English that classifies the topic of the question.',
    '  Examples: Technology, Music, Health, Work, Cooking, Finance, Hobbies, Science, History, Sports.',
    '  Use the category that best describes the topic, never put "AI".',
    '- The first tag is ALWAYS "ai-synthesis".',
    '- Add between 2 and 5 additional tags that describe the topic. Simple words, lowercase, no spaces (hyphen if needed).',
    '',
    'Rules for the content:',
    '- Identify the points where the AIs agree — those are the most reliable.',
    '- Highlight important contradictions or discrepancies (mentioning which AI said what).',
    '- Combine the best parts into a unified and well-structured response.',
    '- If any AI adds something unique and valuable, keep it and attribute it briefly.',
    '- If the answers are empty or cut off, mention it at the beginning.',
    '- No "As an AI..." or apologies.',
    '',
    `# User query\n\n${query}`,
    '',
    `# AI responses\n\n${sections}`,
    '',
    '# Your synthesis'
  ].join('\n');
}

/**
 * Prompt sent to the local judge model to improve the user's raw query
 * using prompt-engineering best practices.
 * The model must return ONLY the improved prompt — no preamble, no quotes.
 */
export function buildPromptImprovementPrompt(query: string): string {
  return [
    'You are an expert in prompt engineering.',
    'Your only task is to take the user\'s question and rewrite it as a more effective prompt for large language models.',
    '',
    'Strict rules:',
    '- Be specific, clear, and well-structured.',
    '- Add useful context if missing.',
    '- Ask for the ideal response format when relevant.',
    '- If the question is technical, specify the expected level of detail.',
    '- Keep the original language of the question.',
    '- Return ONLY the improved prompt — no explanations, no quotes, no preamble, no additional text.',
    '',
    `Original question: ${query}`,
    '',
    'Improved prompt:'
  ].join('\n');
}
