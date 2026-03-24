import { useState, useEffect } from 'react'
import { supabase } from '@shared/services/supabase'

export interface WeeklyBrief {
  headline: string
  tip: string
  insights: string[]
  nutrition?: {
    summary: string
    connection?: string
    priority: string
  }
}

export function useWeeklyBrief() {
  const [brief, setBrief]   = useState<WeeklyBrief | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      supabase.functions
        .invoke('ai-coach', {
          body: { feature: 'weekly_brief' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        .then(({ data, error }) => {
          if (!error && data) setBrief(data as WeeklyBrief)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }

  useEffect(() => { refresh() }, [])

  return { brief, loading, refresh }
}
