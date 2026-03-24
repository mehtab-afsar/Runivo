export interface WeeklyBrief {
  headline: string;
  tip: string;
  insights: string[];
  nutrition?: {
    summary: string;
    connection?: string;
    priority: string;
  };
}

export function useWeeklyBrief() {
  return {
    brief: null as WeeklyBrief | null,
    loading: false,
    refresh: () => {},
  };
}
