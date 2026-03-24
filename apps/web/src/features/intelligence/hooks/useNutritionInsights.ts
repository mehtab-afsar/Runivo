import { useState, useEffect } from 'react'
import { supabase } from '@shared/services/supabase'
import type { NutritionInsights } from '../services/intelligenceService'

export function useNutritionInsights() {
  const [insights, setInsights] = useState<NutritionInsights | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      supabase.functions
        .invoke('ai-coach', {
          body: { feature: 'nutrition_insights' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        .then(({ data, error: err }) => {
          if (err) { setError(err.message); setLoading(false); return }
          if (data) setInsights(data as NutritionInsights)
          setLoading(false)
        })
        .catch(e => { setError(String(e)); setLoading(false) })
    })
  }

  useEffect(() => { refresh() }, [])

  return { insights, loading, error, refresh }
}
