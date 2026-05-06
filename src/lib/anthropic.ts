import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export function parseClaudeJsonResponse<T>(message: Anthropic.Message): T {
  const text = (message.content as Array<{ type?: string; text?: string }>)
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("")
    .trim();

  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  const jsonStr = fence ? fence[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) throw new Error("No JSON in Claude response");

  return JSON.parse(jsonStr) as T;
}
