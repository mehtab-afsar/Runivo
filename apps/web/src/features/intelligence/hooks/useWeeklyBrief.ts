export interface WeeklyBrief {
  headline: string;
  tip: string;
  insights: string[];
}

export function useWeeklyBrief() {
  return {
    brief: null as WeeklyBrief | null,
    loading: false,
    refresh: () => {},
  };
}
