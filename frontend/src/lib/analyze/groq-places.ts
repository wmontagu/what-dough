import Groq from "groq-sdk";
import type { ParticipantInput, ConsensusBudget } from "./types";
import { calculateConsensusBudget } from "./tools";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface EventTiming {
  dateStart?: string | null;  // "2024-12-25"
  dateEnd?: string | null;    // "2024-12-26"
  timeStart?: string | null;  // "20:00:00"
  timeEnd?: string | null;    // "23:00:00"
}

interface PriceRange {
  startPrice?: { units?: string };
  endPrice?: { units?: string };
}

interface OpenPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

interface Place {
  displayName?: { text: string };
  formattedAddress?: string;
  priceLevel?: string;
  priceRange?: PriceRange;
  rating?: number;
  googleMapsUri?: string;
  primaryType?: string;
  regularOpeningHours?: { periods?: OpenPeriod[] };
}

interface SearchParams {
  includedTypes: string[];
  rankPreference?: "DISTANCE" | "POPULARITY";
}

const PRICE_LEVEL_COST: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 15,
  PRICE_LEVEL_MODERATE: 30,
  PRICE_LEVEL_EXPENSIVE: 60,
  PRICE_LEVEL_VERY_EXPENSIVE: 100,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Strip <think> blocks and markdown fences before JSON.parse */
function extractJson(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")
    .trim();
}

/** Parse "HH:MM:SS" or "HH:MM" into { hour, minute } */
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return { hour, minute };
}

/** Format 24h time to readable "8:00 PM" */
function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Convert a date string like "2024-12-25" to a day-of-week index (0=Sun) */
function dateToDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}

/**
 * Check whether a place's regular hours overlap with the event time window.
 * Returns "open", "closed", or "unknown" (no hours data).
 */
function checkAvailability(
  periods: OpenPeriod[] | undefined,
  dayOfWeek: number,
  start: { hour: number; minute: number },
  end: { hour: number; minute: number }
): "open" | "closed" | "unknown" {
  if (!periods || periods.length === 0) return "unknown";

  const eventStart = start.hour * 60 + start.minute;
  const eventEnd = end.hour * 60 + end.minute;
  const prevDay = (dayOfWeek + 6) % 7;

  for (const period of periods) {
    // Period opens on event day
    if (period.open.day === dayOfWeek) {
      if (!period.close) return "open"; // 24-hour or unknown close

      const openMin = period.open.hour * 60 + period.open.minute;
      // If close is the next day, treat close as 24h+ minutes
      const closeMin =
        period.close.day !== dayOfWeek
          ? period.close.hour * 60 + period.close.minute + 24 * 60
          : period.close.hour * 60 + period.close.minute;

      // Overlap: period starts before event ends, and period ends after event starts
      if (openMin <= eventEnd && closeMin >= eventStart) return "open";
    }

    // Period opened yesterday and closes on event day (past-midnight carry-over)
    if (
      period.open.day === prevDay &&
      period.close?.day === dayOfWeek
    ) {
      const closeMin = period.close.hour * 60 + period.close.minute;
      if (closeMin >= eventStart) return "open";
    }
  }

  return "closed";
}

async function geocodeZipcode(
  zipcode: string
): Promise<{ lat: number; lng: number }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipcode)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const location = data.results?.[0]?.geometry?.location;
  if (!location) throw new Error(`Could not geocode zipcode: ${zipcode}`);
  return { lat: location.lat, lng: location.lng };
}

/** Single AI call: synthesize event + participant data into a Places searchNearby query */
async function buildSearchParams(
  eventName: string,
  description: string | null | undefined,
  participants: ParticipantInput[],
  consensus: ConsensusBudget,
  timing: EventTiming
): Promise<SearchParams> {
  const prefLines = participants
    .filter((p) => p.preferences)
    .map((p) => `- ${p.name}: ${p.preferences}`)
    .join("\n");

  // Build timing context line
  const timingParts: string[] = [];
  if (timing.dateStart) {
    const day = DAY_NAMES[dateToDayOfWeek(timing.dateStart)];
    const dayLabel =
      timing.dateEnd && timing.dateEnd !== timing.dateStart
        ? `${day}–${DAY_NAMES[dateToDayOfWeek(timing.dateEnd)]}`
        : day;
    timingParts.push(dayLabel);
  }
  if (timing.timeStart) {
    const s = parseTime(timing.timeStart);
    const e = timing.timeEnd ? parseTime(timing.timeEnd) : null;
    if (s) {
      timingParts.push(
        e
          ? `${formatTime(s.hour, s.minute)}–${formatTime(e.hour, e.minute)}`
          : formatTime(s.hour, s.minute)
      );
    }
  }
  const timingLine = timingParts.length
    ? `Event timing: ${timingParts.join(", ")}`
    : "";

  const prompt = `/no_think
You are given details about a group outing. Produce Google Places API search parameters to find the best venue options for this group.

Event: "${eventName}"${description ? `\nDescription: ${description}` : ""}
Budget per person: $${consensus.min}–$${consensus.max}
${timingLine}
Participant preferences:
${prefLines || "(none)"}

Return a JSON object with:
- "includedTypes": array of 3–5 types from the list below that best match the group
- "rankPreference": "POPULARITY" or "DISTANCE"

Available types by category:
OUTDOORS & NATURE: barbecue_area, beach, botanical_garden, cycling_park, hiking_area, marina, national_park, nature_preserve, observation_deck, park, picnic_ground, scenic_spot, state_park, wildlife_park, wildlife_refuge, woods
ATTRACTIONS & SIGHTSEEING: aquarium, amusement_park, amusement_center, castle, cultural_landmark, ferris_wheel, historical_landmark, monument, planetarium, roller_coaster, tourist_attraction, water_park, zoo
ACTIVE & SPORTS: adventure_sports_center, bowling_alley, fitness_center, go_karting_venue, golf_course, ice_skating_rink, karaoke, miniature_golf_course, paintball_center, ski_resort, sports_complex, swimming_pool, tennis_court, video_arcade
ARTS & CULTURE: art_gallery, art_museum, comedy_club, concert_hall, cultural_center, dance_hall, live_music_venue, museum, opera_house, performing_arts_theater
NIGHTLIFE: bar, beer_garden, brewery, brewpub, casino, cocktail_bar, lounge_bar, night_club, pub, sports_bar, wine_bar, winery
DINING: barbecue_restaurant, brunch_restaurant, buffet_restaurant, cafe, diner, fine_dining_restaurant, gastropub, italian_restaurant, japanese_restaurant, korean_restaurant, mexican_restaurant, ramen_restaurant, restaurant, seafood_restaurant, steak_house, sushi_restaurant, thai_restaurant, vegan_restaurant, vietnamese_restaurant
WELLNESS: massage, sauna, spa, wellness_center, yoga_studio

Return ONLY the JSON object. Example:
{"includedTypes":["sushi_restaurant","karaoke","cocktail_bar"],"rankPreference":"POPULARITY"}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "qwen/qwen3-32b",
    temperature: 0.3,
    max_completion_tokens: 150,
  });

  const text = extractJson(
    completion.choices[0]?.message?.content ?? '{"includedTypes":["restaurant"]}'
  );

  try {
    const parsed = JSON.parse(text) as SearchParams;
    return {
      includedTypes: Array.isArray(parsed.includedTypes)
        ? parsed.includedTypes
        : ["restaurant"],
      rankPreference:
        parsed.rankPreference === "DISTANCE" ? "DISTANCE" : "POPULARITY",
    };
  } catch {
    return { includedTypes: ["restaurant"], rankPreference: "POPULARITY" };
  }
}

/** Call Google Places searchNearby (v1) with AI-generated params */
async function searchNearby(
  lat: number,
  lng: number,
  params: SearchParams
): Promise<Place[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.priceLevel,places.priceRange,places.rating,places.googleMapsUri,places.primaryType,places.regularOpeningHours",
      },
      body: JSON.stringify({
        includedTypes: params.includedTypes,
        rankPreference: params.rankPreference ?? "POPULARITY",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 8000,
          },
        },
        maxResultCount: 5,
      }),
    }
  );
  const data = await res.json();
  return (data.places as Place[]) ?? [];
}

/** Derive a cost estimate from priceRange midpoint, falling back to priceLevel. Returns null if no data. */
function estimateCost(place: Place): number | null {
  const start = parseInt(place.priceRange?.startPrice?.units ?? "", 10);
  const end = parseInt(place.priceRange?.endPrice?.units ?? "", 10);
  if (!isNaN(start) && !isNaN(end)) return Math.round((start + end) / 2);
  if (!isNaN(start)) return start;
  if (!isNaN(end)) return end;
  const fromLevel = PRICE_LEVEL_COST[place.priceLevel ?? ""];
  return fromLevel ?? null;
}

/** Map a raw Place to a Suggestion — no AI, just data transformation */
function placeToSuggestion(
  place: Place,
  consensus: ConsensusBudget,
  timing: EventTiming
): Record<string, unknown> {
  const costPerPerson = estimateCost(place);
  const rating = place.rating ?? 3.5;

  // Availability check
  let availability: "open" | "closed" | "unknown" = "unknown";
  if (timing.dateStart && timing.timeStart && timing.timeEnd) {
    const dayOfWeek = dateToDayOfWeek(timing.dateStart);
    const start = parseTime(timing.timeStart);
    const end = parseTime(timing.timeEnd);
    if (start && end) {
      availability = checkAvailability(
        place.regularOpeningHours?.periods,
        dayOfWeek,
        start,
        end
      );
    }
  }

  // Budget score: 1.0 in range, degrades outside, neutral 0.75 if unknown
  const budgetScore =
    costPerPerson === null
      ? 0.75
      : costPerPerson >= consensus.min && costPerPerson <= consensus.max
        ? 1.0
        : costPerPerson < consensus.min
          ? 0.7
          : Math.max(0, 1 - (costPerPerson - consensus.max) / consensus.max);

  // Rating score: normalized 0–1
  const ratingScore = Math.min(rating, 5) / 5;

  // Availability adjustment
  const availabilityAdjust =
    availability === "open" ? 0.1 : availability === "closed" ? -0.25 : 0;

  const fitScore =
    Math.round(
      Math.max(0, Math.min(1, budgetScore * 0.8 + ratingScore * 0.2 + availabilityAdjust)) * 100
    ) / 100;

  const typeLabel = (place.primaryType ?? "place")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const availabilityNote =
    availability === "open"
      ? "Open during your event"
      : availability === "closed"
        ? "May be closed during your event"
        : null;

  const why = [
    availabilityNote,
    `Rated ${rating.toFixed(1)}/5 on Google Maps`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    name: place.displayName?.text ?? "Unknown",
    type: typeLabel,
    cost_per_person: costPerPerson,
    why_it_fits: why,
    fit_score: fitScore,
    location: place.formattedAddress ?? null,
    booking_link: place.googleMapsUri ?? null,
  };
}

export async function runWithGroqPlaces(
  eventName: string,
  zipcode: string,
  participants: ParticipantInput[],
  timing: EventTiming = {},
  description?: string | null
): Promise<{
  suggestions: Array<Record<string, unknown>>;
  consensus_budget: ConsensusBudget;
  model_usage: Record<string, string>;
}> {
  const budgets: [number, number][] = participants.map((p) => [
    p.min_budget,
    p.max_budget,
  ]);
  const consensus = calculateConsensusBudget(budgets);

  // AI builds search params + geocode run in parallel
  const [coords, searchParams] = await Promise.all([
    geocodeZipcode(zipcode),
    buildSearchParams(eventName, description, participants, consensus, timing),
  ]);

  const places = await searchNearby(coords.lat, coords.lng, searchParams);

  if (places.length === 0) {
    throw new Error("No places found near that zipcode.");
  }

  const suggestions = places.map((p) =>
    placeToSuggestion(p, consensus, timing)
  );

  return {
    suggestions,
    consensus_budget: consensus,
    model_usage: {
      pipeline: "groq-places",
      model: "qwen/qwen3-32b",
      place_types: searchParams.includedTypes.join(", "),
    },
  };
}
