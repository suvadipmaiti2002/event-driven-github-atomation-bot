import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

export interface AITriageResult {
  summary: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "bug" | "feature" | "documentation" | "security" | "refactor" | "question" | "general";
  suggestedLabels: string[];
}

export class GeminiClient {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI | null {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here" || apiKey === "your_gemini_api_key") {
      return null;
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }

    return this.ai;
  }

  /**
   * Performs automated AI triage on an issue or PR using the latest @google/genai SDK.
   * Graceful degradation: returns status object without throwing unhandled exceptions.
   */
  async triageContent(params: {
    title: string;
    bodySnippet?: string;
    eventType: "issues" | "pull_request";
    repoFullName: string;
  }): Promise<{ success: boolean; data?: AITriageResult; error?: string }> {
    const client = this.getClient();

    if (!client) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured or using placeholder.",
      };
    }

    const itemType = params.eventType === "pull_request" ? "Pull Request" : "Issue";
    const prompt = `You are an automated GitHub AI triage assistant.
Analyze this GitHub ${itemType}:
Repository: ${params.repoFullName}
Title: "${params.title}"
Description: "${params.bodySnippet || "No description provided."}"

Respond ONLY with a valid raw JSON object (no markdown, no backticks, no code fence, no commentary):
{
  "summary": "Concise 1-2 sentence executive summary of what this ${itemType} is about",
  "priority": "HIGH", // One of: "CRITICAL", "HIGH", "MEDIUM", "LOW"
  "category": "bug", // One of: "bug", "feature", "documentation", "security", "refactor", "question", "general"
  "suggestedLabels": ["bug", "backend"] // Up to 3 short lowercase labels
}`;

    // Read model(s) from .env (supports single model or comma-separated list)
    const envModels = env.GEMINI_MODEL
      ? env.GEMINI_MODEL.split(",").map((m) => m.trim()).filter(Boolean)
      : [];

    const candidateModels = envModels.length > 0
      ? envModels
      : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

    let rawText: string | null = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[GeminiClient] 🤖 Attempting AI triage using model: ${modelName}`);
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.2,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          rawText = response.text;
          console.log(`[GeminiClient] ✅ Successfully triaged using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        const shouldFallback =
          err?.status === 503 ||
          err?.status === 404 ||
          err?.status === 429 ||
          err?.status === "UNAVAILABLE" ||
          err?.status === "NOT_FOUND" ||
          err?.message?.includes("503") ||
          err?.message?.includes("404") ||
          err?.message?.includes("not found") ||
          err?.message?.includes("high demand") ||
          err?.message?.includes("RESOURCE_EXHAUSTED");

        if (shouldFallback) {
          console.warn(`[GeminiClient] ⚠️ Model ${modelName} failed (${err?.message || err}). Falling back to next model...`);
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break;
      }
    }

    try {
      if (!rawText) {
        return {
          success: false,
          error: lastError
            ? `Gemini SDK error: ${lastError?.message || String(lastError)}`
            : "Empty content returned by Gemini.",
        };
      }

      // Clean any accidental markdown fences
      const cleanedText = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");

      const parsed: AITriageResult = JSON.parse(cleanedText);

      // Validate priority fallback
      const validPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      const priority = validPriorities.includes(parsed.priority?.toUpperCase())
        ? (parsed.priority.toUpperCase() as AITriageResult["priority"])
        : "MEDIUM";

      return {
        success: true,
        data: {
          summary: parsed.summary || "Summary not available.",
          priority,
          category: parsed.category || "general",
          suggestedLabels: Array.isArray(parsed.suggestedLabels)
            ? parsed.suggestedLabels.map((l) => String(l).toLowerCase().trim()).slice(0, 3)
            : [],
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Gemini SDK error: ${err?.message || String(err)}`,
      };
    }
  }
}

export const geminiClient = new GeminiClient();
