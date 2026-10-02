import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return (client ??= new Anthropic({ apiKey: config.anthropicApiKey }));
}

export interface StructuredCall<T> {
  model: string;
  system: string;
  user: string;
  toolName: string;
  description: string;
  schema: Record<string, unknown>; // JSON schema for the tool input
  maxTokens?: number;
}

/**
 * Force a structured JSON result via tool use. The model must call the single
 * provided tool, so the output always conforms to `schema`.
 */
export async function structured<T>(call: StructuredCall<T>): Promise<T> {
  const res = await getClient().messages.create({
    model: call.model,
    max_tokens: call.maxTokens ?? 2048,
    system: call.system,
    tools: [{ name: call.toolName, description: call.description, input_schema: call.schema as any }],
    tool_choice: { type: 'tool', name: call.toolName },
    messages: [{ role: 'user', content: call.user }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('model did not return tool_use');
  return block.input as T;
}

/** Plain text completion (used for weekly plan summaries). */
export async function text(model: string, system: string, user: string, maxTokens = 1024): Promise<string> {
  const res = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('\n')
    .trim();
}

export const llmAvailable = () => Boolean(config.anthropicApiKey);
