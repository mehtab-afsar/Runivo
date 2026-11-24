import { useState } from 'react';
import { updateClubDescription } from '@features/clubs/services/clubService';

/** The admin tab's description editor. Kept above the tab so edits survive switching tabs. */
export function useClubDescription(clubId: string, initial: string | undefined) {
  const [description, setDescription] = useState<string>(initial ?? '');
  const [savingDesc, setSavingDesc] = useState(false);

  const handleSaveDesc = async () => {
    setSavingDesc(true);
    await updateClubDescription(clubId, description);
    setSavingDesc(false);
  };

  return { description, setDescription, savingDesc, handleSaveDesc };
}
