import Dedalus from "dedalus-labs";
import type { ParticipantInput, ConsensusBudget } from "./types";
import { calculateConsensusBudget } from "./tools";

export async function runWithDedalus(
  apiKey: string,
  eventName: string,
  activityType: string | null | undefined,
  zipcode: string,
  participants: ParticipantInput[]
): Promise<{
  suggestions: Array<Record<string, unknown>>;
  consensus_budget: ConsensusBudget;
  model_usage: Record<string, string>;
}> {
  const client = new Dedalus({ apiKey });

  const membersSummary = participants
    .map(
      (p) =>
        `- ${p.name}: budget $${p.min_budget}-$${p.max_budget}, preferences: ${p.preferences || "none"}`
    )
    .join("\n");

  const budgets: [number, number][] = participants.map((p) => [
    p.min_budget,
    p.max_budget,
  ]);
  const consensus = calculateConsensusBudget(budgets);

  const prompt =
    `I'm planning a group activity called '${eventName}' near zipcode ${zipcode}.\n\n` +
    `Participants:\n${membersSummary}\n\n` +
    `Target Budget: $${consensus.min} - $${consensus.max} per person ` +
    `(${consensus.has_overlap ? "exact overlap" : "compromise average"}).\n\n` +
    `Search for real activities, restaurants, and venues near zipcode ${zipcode}. ` +
    `CRITICAL: Prioritize suggestions that fall WITHIN the $${consensus.min}-$${consensus.max} range. ` +
    `This budget reflects the group's desired level of spending/experience quality. ` +
    `While high-quality activities costing less than $${consensus.min} ` +
    `can be included, they should make up no more than ONE of your total suggestions. ` +
    `Exclude any options that exceed $${consensus.max}.\n\n` +
    `Diversity Requirement: Provide a balanced mix of activity types. ` +
    `Ensure at least 3 different 'types' from the JSON schema are represented. ` +
    `Consider each participant's preferences specifically.\n\n` +
    `Use your own knowledge of real places near ${zipcode} — ` +
    `do NOT refuse or apologize, just provide your best suggestions of real venues. ` +
    `For booking_url, include a real URL if you know one, otherwise set it to null.\n\n` +
    `Return a JSON object with exactly this structure:\n` +
    `{"suggestions": [{"name": "...", "type": "dining|entertainment|outdoors|nightlife|sports|arts", ` +
    `"cost_per_person": 25, "why_it_fits": "...", "fit_score": 0.85, "location": "...", ` +
    `"booking_url": "..."}]}\n\n` +
    `Return 5-6 suggestions sorted by fit_score (0 to 1). Only return the JSON, no other text.`;

  const completion = await client.chat.completions.create({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an expert local activity planner. Return only valid JSON, no markdown fences or explanation.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  const parsed = parseDedalusResult(raw);

  return {
    suggestions: parsed.suggestions ?? [],
    consensus_budget: consensus,
    model_usage: {
      pipeline: "dedalus",
      models: "gpt-4o",
    },
  };
}

function parseDedalusResult(raw: string): { suggestions: Array<Record<string, unknown>> } {
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    cleaned = firstNewline >= 0 ? cleaned.slice(firstNewline + 1) : cleaned.slice(3);
    const lastFence = cleaned.lastIndexOf("```");
    if (lastFence >= 0) {
      cleaned = cleaned.slice(0, lastFence);
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return { suggestions: [] };
  }
}
