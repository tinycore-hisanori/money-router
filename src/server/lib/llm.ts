import { config } from './config.js';

const API = 'https://api.anthropic.com/v1/messages';

export interface StructuredCall<T> {
  model: string;
  system: string;
  user: string;
  /** Kept for call-site readability; not sent to the API. */
  toolName?: string;
  description?: string;
  schema: Record<string, unknown>; // JSON schema for the result
  maxTokens?: number;
}

/**
 * Force a structured JSON result with native structured outputs
 * (output_config.format = json_schema). Uses fetch directly so the request
 * shape doesn't depend on the installed SDK version.
 */
export async function structured<T>(call: StructuredCall<T>): Promise<T> {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const body = {
    model: call.model,
    max_tokens: call.maxTokens ?? 2048,
    system: call.system,
    messages: [{ role: 'user', content: call.user }],
    output_config: { format: { type: 'json_schema', schema: strictify(call.schema) } },
  };
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${txt}`);
  const j = JSON.parse(txt);
  const text = (j.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  if (!text) throw new Error(`model returned no text (stop_reason=${j.stop_reason})`);
  if (j.stop_reason === 'max_tokens') throw new Error(`model output truncated at max_tokens=${body.max_tokens}; reduce input or raise maxTokens`);
  return JSON.parse(text) as T;
}

/** Plain text completion (used for weekly plan summaries). */
export async function text(model: string, system: string, user: string, maxTokens = 1024): Promise<string> {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${txt}`);
  const j = JSON.parse(txt);
  return (j.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}

export const llmAvailable = () => Boolean(config.anthropicApiKey);

/** Structured outputs want closed objects: add additionalProperties:false and require every property. */
function strictify(schema: any): any {
  if (Array.isArray(schema)) return schema.map(strictify);
  if (!schema || typeof schema !== 'object') return schema;
  const out: any = { ...schema };
  // Keep to the widely supported subset: no numeric bounds / formats; unions as anyOf.
  delete out.minimum;
  delete out.maximum;
  delete out.format;
  if (Array.isArray(out.type)) {
    const types = out.type;
    delete out.type;
    out.anyOf = types.map((t: string) => ({ type: t }));
  }
  if (out.type === 'object' && out.properties) {
    out.properties = Object.fromEntries(Object.entries(out.properties).map(([k, v]) => [k, strictify(v)]));
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  if (out.items) out.items = strictify(out.items);
  return out;
}
