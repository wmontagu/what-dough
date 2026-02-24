import type { ConsensusBudget, ParsedPreferences, Venue } from "./types";

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  dining: ["restaurant", "food", "eat", "dinner", "lunch", "brunch", "sushi", "pizza", "bbq", "cuisine", "dining"],
  entertainment: ["movie", "concert", "show", "theater", "theatre", "music", "live", "comedy", "karaoke"],
  outdoors: ["hike", "hiking", "park", "outdoor", "nature", "beach", "trail", "camping", "bike", "biking"],
  sports: ["bowling", "golf", "tennis", "basketball", "gym", "climbing", "skating", "swimming"],
  nightlife: ["bar", "club", "drinks", "cocktail", "pub", "brewery", "wine", "nightlife"],
  arts: ["museum", "gallery", "art", "exhibit", "craft", "pottery", "painting"],
  shopping: ["shopping", "mall", "market", "thrift", "vintage", "boutique"],
  wellness: ["spa", "yoga", "meditation", "massage", "sauna"],
};

const DIET_KEYWORDS: Record<string, string[]> = {
  vegetarian: ["vegetarian", "veggie"],
  vegan: ["vegan", "plant-based", "plant based"],
  "gluten-free": ["gluten-free", "gluten free", "celiac"],
  halal: ["halal"],
  kosher: ["kosher"],
};

const VIBE_KEYWORDS: Record<string, string[]> = {
  chill: ["chill", "relax", "casual", "laid-back", "low-key", "quiet"],
  energetic: ["exciting", "energetic", "active", "adventure", "wild", "fun", "party"],
  romantic: ["romantic", "date", "intimate", "cozy"],
  social: ["group", "social", "friends", "team", "everyone"],
};

export function parsePreferences(rawText: string): ParsedPreferences {
  const lower = rawText.toLowerCase();

  const activityTypes: string[] = [];
  for (const [category, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      activityTypes.push(category);
    }
  }
  if (activityTypes.length === 0) {
    activityTypes.push("dining", "entertainment");
  }

  const dietaryRestrictions: string[] = [];
  for (const [restriction, keywords] of Object.entries(DIET_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      dietaryRestrictions.push(restriction);
    }
  }

  const vibes: string[] = [];
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      vibes.push(vibe);
    }
  }
  if (vibes.length === 0) {
    vibes.push("social");
  }

  return {
    activity_types: activityTypes,
    dietary_restrictions: dietaryRestrictions,
    vibe: vibes,
    raw_text: rawText,
  };
}

export function calculateConsensusBudget(
  memberBudgets: [number, number][]
): ConsensusBudget {
  if (memberBudgets.length === 0) {
    return { min: 0, max: 0, has_overlap: false };
  }

  const consensusMin = Math.max(...memberBudgets.map((b) => b[0]));
  const consensusMax = Math.min(...memberBudgets.map((b) => b[1]));

  if (consensusMin <= consensusMax) {
    return {
      min: Math.round(consensusMin * 100) / 100,
      max: Math.round(consensusMax * 100) / 100,
      has_overlap: true,
    };
  }

  const avgMin =
    memberBudgets.reduce((sum, b) => sum + b[0], 0) / memberBudgets.length;
  const avgMax =
    memberBudgets.reduce((sum, b) => sum + b[1], 0) / memberBudgets.length;

  return {
    min: Math.round(avgMin * 100) / 100,
    max: Math.round(avgMax * 100) / 100,
    has_overlap: false,
  };
}

export function scoreVenues(
  venues: Venue[],
  preferences: { activity_types: string[]; dietary_restrictions: string[]; vibe: string[] },
  budgets: ConsensusBudget
): Venue[] {
  const preferredTypes = preferences.activity_types;
  const dietary = preferences.dietary_restrictions;
  const budgetMin = budgets.min;
  const budgetMax = budgets.max;

  const scored = venues.map((venue) => {
    let score = 0.5;

    const venueType = (venue.type || "").toLowerCase();
    if (preferredTypes.some((t) => venueType.includes(t))) {
      score += 0.25;
    }

    const cost = venue.cost_per_person || 0;
    if (budgetMin <= cost && cost <= budgetMax) {
      score += 0.25;
    } else if (cost < budgetMin) {
      score += cost <= 5 ? 0.2 : 0.15;
    } else {
      const overagePct = budgetMax > 0 ? (cost - budgetMax) / budgetMax : 1;
      score -= Math.min(0.3, overagePct * 0.5);
    }

    const venueDietary = venue.dietary_options || [];
    if (dietary.length === 0 || dietary.some((d) => venueDietary.includes(d))) {
      score += 0.1;
    }

    const rating = venue.rating || 0;
    if (rating >= 4.5) {
      score += 0.05;
    } else if (rating >= 4.0) {
      score += 0.03;
    }

    return { ...venue, fit_score: Math.round(Math.max(0, Math.min(1, score)) * 100) / 100 };
  });

  scored.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
  return scored;
}
