export interface PostRunInsights {
  praise: string;
  analysis: string;
  suggestion: string;
  recovery?: string;
}

export function usePostRunInsights(_runId: string | null | undefined) {
  return { insights: null as PostRunInsights | null, loading: false };
}
