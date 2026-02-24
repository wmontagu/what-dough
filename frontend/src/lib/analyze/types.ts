export interface ParticipantInput {
  name: string;
  min_budget: number;
  max_budget: number;
  preferences: string | null;
}

export interface AnalyzeEventRequest {
  event_name: string;
  description?: string | null;
  zipcode: string;
  activity_type?: string | null;
  participants: ParticipantInput[];
  date_start?: string | null;
  date_end?: string | null;
  time_start?: string | null;
  time_end?: string | null;
}

export interface Suggestion {
  name: string;
  type: string;
  cost_per_person: number;
  why_it_fits: string;
  fit_score: number;
  location: string | null;
  booking_link: string | null;
}

export interface ConsensusBudget {
  min: number;
  max: number;
  has_overlap: boolean;
}

export interface AnalyzeEventResponse {
  consensus_budget: ConsensusBudget;
  suggestions: Suggestion[];
  model_usage: Record<string, string>;
}

export interface ParsedPreferences {
  activity_types: string[];
  dietary_restrictions: string[];
  vibe: string[];
  raw_text: string;
}

export interface Venue {
  name: string;
  type: string;
  cost_per_person: number;
  vibe?: string;
  why_it_fits: string;
  rating?: number;
  dietary_options?: string[];
  location: string;
  fit_score?: number;
  booking_link?: string;
}
