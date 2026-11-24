/**
 * Holds the run audio session (plays on silent, keeps playing with the screen
 * locked, ducks the user's music for voice cues) for as long as `active` is true,
 * and hands everything back when it stops being true or the screen goes away,
 * which covers Finish, Discard and Android back. See shared/services/audioSession.ts.
 */
import { useEffect } from 'react';
import { enterRunAudioSession, exitRunAudioSession } from '@mobile/shared/services/audioSession';
import { stopRunCues } from '@mobile/shared/services/speakRunCue';

export function useRunAudioSession(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    void enterRunAudioSession();
    return () => {
      stopRunCues();
      void exitRunAudioSession();
    };
  }, [active]);
}
