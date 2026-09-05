import { config } from '../config/env';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

/** True when an OpenAI (ChatGPT) API key is configured. */
export function isLLMConfigured(): boolean {
  return !!config.ai.openaiApiKey;
}

/**
 * ChatGPT (OpenAI Chat Completions) call with graceful degradation.
 * Returns null on any failure so callers can fall back to the rule-based engine.
 */
export async function chatComplete(
  messages: LLMMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  if (!isLLMConfigured()) return null;
  if (typeof fetch !== 'function') {
    console.warn('[LLM] global fetch unavailable (needs Node 18+)');
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 300,
        temperature: opts.temperature ?? 0.8,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[LLM] OpenAI API error ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : null;
  } catch (err: any) {
    console.warn('[LLM] request failed:', err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}



