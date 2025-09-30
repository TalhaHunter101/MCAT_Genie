// Core data types for MCAT Scheduler

export interface Topic {
  id: number;
  content_category_number: string;
  content_category_title: string;
  subtopic_number: number;
  subtopic_title: string;
  concept_number: number;
  concept_title: string;
  high_yield: boolean;
  key: string;
}

export interface BaseResource {
  id: number;
  stable_id?: string;
  title: string;
  key: string;
  time_minutes: number;
}

export interface KhanAcademyResource extends BaseResource {
  resource_type: 'Video' | 'Article' | 'Practice Passage' | 'Discrete Practice Question';
}

export interface KaplanResource extends BaseResource {
  high_yield: boolean;
}

export interface JackWestinResource extends BaseResource {
  resource_type: 'CARS Passage' | 'Discrete Practice Question';
}

export interface UWorldResource extends BaseResource {
  question_count: number;
}

export interface AAMCResource extends BaseResource {
  resource_type: 'Question Pack' | 'Full Length';
  pack_name?: string;
}

export type Resource = KhanAcademyResource | KaplanResource | JackWestinResource | UWorldResource | AAMCResource;

export interface UsedResource {
  id: number;
  schedule_id: string;
  provider: string;
  resource_id: number;
  resource_uid: string;
  used_date: string;
}

export interface ScheduleRequest {
  start_date: string;
  test_date: string;
  priorities: string;
  availability: string;
  fl_weekday: string;
}

export interface ScheduleDay {
  date: string;
  kind: 'break' | 'study' | 'full_length';
  phase?: number;
  provider?: string;
  name?: string;
  blocks?: {
    science_content?: string[];
    science_discretes?: string[];
    science_passages?: string[];
    uworld_set?: string[];
    extra_discretes?: string[];
    aamc_sets?: string[];
    aamc_CARS_passages?: string[];
    cars?: string[];
    written_review_minutes: number;
    total_resource_minutes: number;
  };
}

export interface ScheduleResponse {
  schedule: ScheduleDay[];
  metadata: {
    total_days: number;
    study_days: number;
    break_days: number;
    phase_1_days: number;
    phase_2_days: number;
    phase_3_days: number;
    full_length_days: number;
  };
}

export interface PhaseInfo {
  phase: number;
  start_day: number;
  end_day: number;
  total_days: number;
}

export interface ResourceSelection {
  resource: Resource;
  provider: string;
  time_minutes: number;
  specificity: number; // 0=concept, 1=subtopic, 2=category
}

export interface TimeFit {
  target: number;
  band_min: number;
  band_max: number;
}

export const TIME_FITS: Record<string, TimeFit> = {
  'KA video': { target: 15, band_min: 10, band_max: 15 },
  'Kaplan': { target: 30, band_min: 20, band_max: 30 },
  'Discrete': { target: 30, band_min: 25, band_max: 35 },
  'Passage': { target: 25, band_min: 20, band_max: 25 },
  'UWorld 10Q': { target: 30, band_min: 25, band_max: 35 }
};

export const DEFAULT_TIMINGS: Record<string, number> = {
  'KA video': 12,
  'KA article': 10,
  'Kaplan section': 30,
  'Discrete': 30,
  'Passage': 25,
  'UWorld 10Q': 30
};
