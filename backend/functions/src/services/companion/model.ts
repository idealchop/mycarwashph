import { brand } from "../../config/brand.js";
import { PROJECT_ID } from "../../config/environments.js";

/**
 * Gemini on Vertex AI (the backend Firebase AI Logic's Vertex provider uses),
 * called with the function's default service account. No API keys.
 */
export const COMPANION_MODEL = process.env.COMPANION_MODEL || "gemini-2.5-flash";
/** Vertex AI region; Gemini 2.5 Flash is served in Singapore, same as the functions. */
export const COMPANION_LOCATION = process.env.COMPANION_LOCATION || brand.region;

/** USD per 1M tokens, Vertex AI Gemini 2.5 Flash standard (text in, text out incl. thinking). */
export const PRICING_USD_PER_M = { input: 0.3, output: 2.5 } as const;
export const USD_TO_PHP = 58;

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelResult {
  text: string;
  model: string;
  location: string;
  usage: ModelUsage;
}

export interface ToolDecl {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface ChatResult extends ModelResult {
  toolsUsed: string[];
}

export interface CompanionModel {
  /** One-shot JSON generation (weekly tips). */
  generateJson(input: { system: string; user: string; schema: Record<string, unknown> }): Promise<ModelResult>;
  /** Chat with function calling; `callTool` runs read-only tools server-side. */
  chat(input: { system: string; turns: ChatTurn[]; tools: ToolDecl[]; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }): Promise<ChatResult>;
}

export function estimateCostUsd(usage: ModelUsage): number {
  const usd = (usage.inputTokens * PRICING_USD_PER_M.input + usage.outputTokens * PRICING_USD_PER_M.output) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

const MAX_TOOL_ROUNDS = 5;

type GenAI = import("@google/genai").GoogleGenAI;
type Content = import("@google/genai").Content;

/** Vertex AI Gemini via the Google Gen AI SDK. Loaded lazily so tests never touch it. */
export class VertexCompanionModel implements CompanionModel {
  private client: Promise<GenAI> | null = null;

  constructor(private readonly opts: { project?: string; location?: string; model?: string } = {}) {}

  private get model() {
    return this.opts.model ?? COMPANION_MODEL;
  }
  private get location() {
    return this.opts.location ?? COMPANION_LOCATION;
  }

  private ai() {
    this.client ??= import("@google/genai").then(
      ({ GoogleGenAI }) => new GoogleGenAI({ vertexai: true, project: this.opts.project ?? PROJECT_ID, location: this.location }),
    );
    return this.client;
  }

  async generateJson(input: { system: string; user: string; schema: Record<string, unknown> }): Promise<ModelResult> {
    const ai = await this.ai();
    const res = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      config: {
        systemInstruction: input.system,
        temperature: 0.4,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: input.schema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const usage = usageOf(res.usageMetadata);
    return { text: res.text ?? "", model: res.modelVersion || this.model, location: this.location, usage };
  }

  async chat(input: { system: string; turns: ChatTurn[]; tools: ToolDecl[]; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }): Promise<ChatResult> {
    const ai = await this.ai();
    const contents: Content[] = input.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
    const total: ModelUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const toolsUsed: string[] = [];
    let modelVersion = this.model;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: input.system,
          temperature: 0.5,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
          tools: round < MAX_TOOL_ROUNDS ? [{ functionDeclarations: input.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }] : undefined,
        },
      });
      const u = usageOf(res.usageMetadata);
      total.inputTokens += u.inputTokens;
      total.outputTokens += u.outputTokens;
      total.totalTokens += u.totalTokens;
      modelVersion = res.modelVersion || modelVersion;
      const calls = res.functionCalls ?? [];
      if (!calls.length) {
        return { text: (res.text ?? "").trim(), model: modelVersion, location: this.location, usage: total, toolsUsed };
      }
      contents.push(res.candidates?.[0]?.content ?? { role: "model", parts: calls.map((c) => ({ functionCall: c })) });
      const parts = [];
      for (const call of calls) {
        const name = call.name ?? "";
        toolsUsed.push(name);
        let output: unknown;
        try {
          output = await input.callTool(name, (call.args ?? {}) as Record<string, unknown>);
        } catch (err) {
          output = { error: (err as Error).message };
        }
        parts.push({ functionResponse: { id: call.id, name, response: { output } } });
      }
      contents.push({ role: "user", parts });
    }
    return { text: "", model: modelVersion, location: this.location, usage: total, toolsUsed };
  }
}

function usageOf(u: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number } | undefined): ModelUsage {
  const inputTokens = u?.promptTokenCount ?? 0;
  const outputTokens = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
  return { inputTokens, outputTokens, totalTokens: u?.totalTokenCount ?? inputTokens + outputTokens };
}
