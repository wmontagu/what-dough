import type { Venue } from "./types";

export function googleMapsLink(name: string, location = ""): string {
  const query = `${name} ${location}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const TEMPLATES: Record<string, Venue[]> = {
  dining: [
    { name: "Umami Sushi Bar", type: "dining", cost_per_person: 32, vibe: "social chill",
      why_it_fits: "Highly rated sushi within group budget", rating: 4.6,
      dietary_options: ["vegetarian", "gluten-free"], location: "" },
    { name: "The Rustic Table", type: "dining", cost_per_person: 28, vibe: "chill",
      why_it_fits: "Farm-to-table, diverse menu options", rating: 4.4,
      dietary_options: ["vegetarian", "vegan", "gluten-free"], location: "" },
    { name: "Fuego Latin Kitchen", type: "dining", cost_per_person: 25, vibe: "energetic social",
      why_it_fits: "Great group atmosphere, lively vibe", rating: 4.3,
      dietary_options: ["vegetarian"], location: "" },
  ],
  entertainment: [
    { name: "Laugh Factory Comedy Club", type: "entertainment", cost_per_person: 22, vibe: "energetic social",
      why_it_fits: "Live comedy, great for groups", rating: 4.5,
      dietary_options: [], location: "" },
    { name: "Escape Room Challenge", type: "entertainment", cost_per_person: 30, vibe: "energetic social",
      why_it_fits: "Team-building fun within budget", rating: 4.7,
      dietary_options: [], location: "" },
    { name: "Retro Arcade Bar", type: "entertainment", cost_per_person: 18, vibe: "energetic chill",
      why_it_fits: "Budget-friendly with games and drinks", rating: 4.2,
      dietary_options: [], location: "" },
  ],
  outdoors: [
    { name: "Sunset Trail Hike", type: "outdoors", cost_per_person: 5, vibe: "chill",
      why_it_fits: "Free activity, great for any budget", rating: 4.8,
      dietary_options: [], location: "" },
    { name: "Kayaking Adventure", type: "outdoors", cost_per_person: 35, vibe: "energetic",
      why_it_fits: "Active outdoor group experience", rating: 4.5,
      dietary_options: [], location: "" },
  ],
  nightlife: [
    { name: "Craft & Pour Brewery", type: "nightlife", cost_per_person: 20, vibe: "chill social",
      why_it_fits: "Relaxed brewery with group seating", rating: 4.3,
      dietary_options: ["vegetarian", "vegan"], location: "" },
    { name: "Skyline Rooftop Lounge", type: "nightlife", cost_per_person: 35, vibe: "social",
      why_it_fits: "Great views and cocktails", rating: 4.6,
      dietary_options: [], location: "" },
  ],
  sports: [
    { name: "Lucky Strike Bowling", type: "sports", cost_per_person: 18, vibe: "energetic social",
      why_it_fits: "Classic group activity, always fun", rating: 4.1,
      dietary_options: [], location: "" },
  ],
  arts: [
    { name: "Modern Art Museum", type: "arts", cost_per_person: 15, vibe: "chill",
      why_it_fits: "Affordable cultural experience", rating: 4.4,
      dietary_options: [], location: "" },
  ],
  wellness: [
    { name: "Zen Day Spa", type: "wellness", cost_per_person: 45, vibe: "chill",
      why_it_fits: "Relaxing group wellness day", rating: 4.7,
      dietary_options: [], location: "" },
  ],
  shopping: [
    { name: "Artisan Market", type: "shopping", cost_per_person: 10, vibe: "chill social",
      why_it_fits: "Browse local vendors, budget-friendly", rating: 4.2,
      dietary_options: [], location: "" },
  ],
};

export function generateMockVenues(
  activityTypes: string[],
  zipcode: string,
  budgetMin: number,
  budgetMax: number
): Venue[] {
  const venues: Venue[] = [];

  for (const atype of activityTypes) {
    for (const template of TEMPLATES[atype] ?? []) {
      const v = { ...template, location: `Near ${zipcode}` };
      if (v.cost_per_person > budgetMax * 1.2) {
        v.cost_per_person = Math.round(budgetMax * 0.9 * 100) / 100;
      }
      venues.push(v);
    }
  }

  if (!activityTypes.includes("dining")) {
    for (const template of TEMPLATES.dining.slice(0, 2)) {
      venues.push({ ...template, location: `Near ${zipcode}` });
    }
  }

  return venues;
}
