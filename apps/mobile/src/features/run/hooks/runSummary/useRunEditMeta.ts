import { useState, useEffect } from 'react';
import { getRunById } from '@shared/services/store';
import type { EditedMeta } from '../../utils/runSummaryTypes';

/** Edit sheet state (title, description, effort, notes, audience, delete) and the saved values. */
export function useRunEditMeta(runId: string) {
  const [editOpen, setEditOpen] = useState(false);
  const [edited, setEdited] = useState<EditedMeta | null>(null);
  useEffect(() => {
    getRunById(runId).then(r => {
      if (r && (r.title || r.description || r.visibility)) {
        setEdited({ title: r.title ?? '', description: r.description ?? '', visibility: r.visibility ?? 'everyone' });
      }
    }).catch(() => {});
  }, [runId]);
  return { editOpen, setEditOpen, edited, setEdited };
}
