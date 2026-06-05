import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const clients = [
  new Groq({ apiKey: process.env.GROQ_API_KEY }),
  process.env.GROQ_API_KEY_2
    ? new Groq({ apiKey: process.env.GROQ_API_KEY_2 })
    : null
].filter(Boolean) as Groq[];

let currentClientIndex = 0;

function getClient(): Groq {
  return clients[currentClientIndex % clients.length];
}

function rotateClient() {
  currentClientIndex = (currentClientIndex + 1) % clients.length;
  console.log(`Rotated to Groq client ${currentClientIndex + 1}/${clients.length}`);
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2,
  maxTokens = 4096,
  retries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await getClient().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: "system",
            content: systemPrompt + "\n\nCRITICAL: Respond with valid JSON only. No markdown. No backticks. No explanation. Raw JSON only."
          },
          { role: "user", content: userPrompt }
        ]
      });

      const content = res.choices[0]?.message?.content;
      if (!content) throw new Error("Empty LLM response");
      return content;

    } catch (err: unknown) {
      const msg = String(err);
      const is429 = msg.includes("429") || msg.includes("Rate limit") || msg.includes("rate_limit");

      if (is429) {
        console.log(`Rate limited on client ${currentClientIndex + 1}. Rotating key...`);
        rotateClient();

        if (attempt < retries) {
          const waitMs = attempt * 15000;
          console.log(`Waiting ${waitMs / 1000}s before retry ${attempt + 1}/${retries}...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded across all API keys");
}

export function safeParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Could not parse JSON from response");
    }
  }
}