export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike'

export interface GroupedRuns<T> {
  date: string
  runs: T[]
}
