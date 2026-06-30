import type { RiskSignal } from './types.js';

export interface SummarizeInput {
  repo: string;
  riskScore: number;
  riskBand: string;
  signals: RiskSignal[];
}

export interface Summarizer {
  readonly mode: 'gemini' | 'templated';
  summarize(input: SummarizeInput): Promise<string>;
}

/**
 * Pluggable report summarizer. If a Gemini key is present we use it; otherwise
 * (or on any failure) we fall back to a deterministic template. This keeps the
 * agent free to run with zero external dependencies and never crashing on the
 * LLM path — the analysis itself is deterministic; the LLM only prettifies it.
 */
export function createSummarizer(cfg: { apiKey?: string; model: string }): Summarizer {
  return cfg.apiKey ? new GeminiSummarizer(cfg.apiKey, cfg.model) : new TemplatedSummarizer();
}

export class TemplatedSummarizer implements Summarizer {
  readonly mode = 'templated' as const;
  async summarize(input: SummarizeInput): Promise<string> {
    const top = [...input.signals].sort((a, b) => b.weight - a.weight).slice(0, 4);
    const factors = top.length
      ? top.map((s) => `- ${s.name}: ${s.detail}`).join('\n')
      : '- No notable risk signals detected.';
    return [
      `${input.repo} scored ${input.riskScore}/100 (${input.riskBand} risk).`,
      `Key factors:`,
      factors,
    ].join('\n');
  }
}

export class GeminiSummarizer implements Summarizer {
  readonly mode = 'gemini' as const;
  private readonly fallback = new TemplatedSummarizer();

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async summarize(input: SummarizeInput): Promise<string> {
    try {
      // Dynamic import keeps @google/generative-ai an optional dependency.
      const mod = await import('@google/generative-ai');
      const genAI = new mod.GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: this.model });
      const prompt =
        `You are a crypto security analyst writing for another AI agent.\n` +
        `Write a concise (<120 words), plain-English risk summary for this GitHub repository.\n` +
        `Repository: ${input.repo}\n` +
        `Risk score: ${input.riskScore}/100 (${input.riskBand}).\n` +
        `Signals:\n${input.signals.map((s) => `- ${s.name} (+${s.weight}): ${s.detail}`).join('\n')}\n` +
        `Return only the summary text.`;
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      return text.length ? text : await this.fallback.summarize(input);
    } catch {
      return this.fallback.summarize(input);
    }
  }
}
