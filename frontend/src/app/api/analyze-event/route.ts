import { NextResponse } from "next/server";
import type { AnalyzeEventRequest, AnalyzeEventResponse, Suggestion } from "@/lib/analyze/types";
import { parsePreferences, calculateConsensusBudget, scoreVenues } from "@/lib/analyze/tools";
import { generateMockVenues, googleMapsLink } from "@/lib/analyze/mock-venues";
import { runWithGroqPlaces } from "@/lib/analyze/groq-places";

export async function POST(request: Request) {
  let body: AnalyzeEventRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.zipcode || !body.participants || body.participants.length === 0) {
    return NextResponse.json(
      { detail: "zipcode and at least one participant are required" },
      { status: 400 }
    );
  }

  // --- Groq + Google Places path ---
  if (process.env.GROQ_API_KEY && process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const result = await runWithGroqPlaces(
        body.event_name,
        body.zipcode,
        body.participants,
        {
          dateStart: body.date_start,
          dateEnd: body.date_end,
          timeStart: body.time_start,
          timeEnd: body.time_end,
        },
        body.description,
      );

      if (result.suggestions.length > 0) {
        const response: AnalyzeEventResponse = {
          consensus_budget: result.consensus_budget,
          suggestions: result.suggestions.map(toSuggestion),
          model_usage: result.model_usage,
        };
        return NextResponse.json(response);
      }
    } catch (e) {
      console.warn("Groq+Places error, falling back to local pipeline:", e);
    }
  }

  // --- Local fallback ---
  try {
    const response = runLocal(body);
    return NextResponse.json(response);
  } catch (e) {
    console.error("analyze-event error:", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function runLocal(body: AnalyzeEventRequest): AnalyzeEventResponse {
  const allPrefs = body.participants.map((p) => {
    let text = p.preferences ?? "";
    if (body.activity_type) {
      text = text ? `${body.activity_type}, ${text}` : body.activity_type;
    }
    return parsePreferences(text);
  });

  const budgets: [number, number][] = body.participants.map((p) => [
    p.min_budget,
    p.max_budget,
  ]);
  const consensus = calculateConsensusBudget(budgets);

  const allTypes = new Set<string>();
  for (const pref of allPrefs) {
    for (const t of pref.activity_types) allTypes.add(t);
  }

  const venues = generateMockVenues(
    Array.from(allTypes),
    body.zipcode,
    consensus.min,
    consensus.max
  );

  const aggregated = {
    activity_types: Array.from(allTypes),
    vibe: Array.from(new Set(allPrefs.flatMap((p) => p.vibe))),
    dietary_restrictions: Array.from(
      new Set(allPrefs.flatMap((p) => p.dietary_restrictions))
    ),
  };

  const scored = scoreVenues(venues, aggregated, consensus);

  const suggestions: Suggestion[] = scored.slice(0, 6).map((v) => ({
    name: v.name,
    type: v.type || "activity",
    cost_per_person: v.cost_per_person || 0,
    why_it_fits: v.why_it_fits || "",
    fit_score: v.fit_score ?? 0.5,
    location: v.location || null,
    booking_link: v.booking_link || googleMapsLink(v.name, v.location || ""),
  }));

  return {
    consensus_budget: consensus,
    suggestions,
    model_usage: { pipeline: "local-fallback" },
  };
}

function toSuggestion(s: Record<string, unknown>): Suggestion {
  const fitScore = Number(s.fit_score ?? 0.5);
  return {
    name: String(s.name ?? "Unknown"),
    type: String(s.type ?? "activity"),
    cost_per_person: s.cost_per_person != null ? Number(s.cost_per_person) : null,
    why_it_fits: String(s.why_it_fits ?? ""),
    fit_score: Math.max(0, Math.min(1, fitScore)),
    location: s.location ? String(s.location) : null,
    booking_link: s.booking_link
      ? String(s.booking_link)
      : s.booking_url
        ? String(s.booking_url)
        : null,
  };
}
