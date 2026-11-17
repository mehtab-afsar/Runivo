/**
 * Missed a key session this week (PRD daily mock F): do it today, skip it, or
 * talk it through with PaceX. Shown once per session, the next time Home opens.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChoiceCards, FormButton } from '@mobile/shared/components/form/FormKit';
import { weekday, type Session } from '@shared/engine/training';

const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SEEN = 'runivo.missedSeen.v1';

export async function missedAlreadySeen(id: string): Promise<boolean> {
  try { return ((JSON.parse((await AsyncStorage.getItem(SEEN)) ?? '[]')) as string[]).includes(id); } catch { return false; }
}
export async function markMissedSeen(id: string): Promise<void> {
  try {
    const seen = JSON.parse((await AsyncStorage.getItem(SEEN)) ?? '[]') as string[];
    await AsyncStorage.setItem(SEEN, JSON.stringify([...seen.filter(x => x !== id), id].slice(-40)));
  } catch { /* best effort */ }
}

type Choice = 'today' | 'skip' | 'pacex';

export default function MissedSessionSheet({ session, canToday, onChoose, onClose }: {
  session: Session;
  canToday: boolean;
  onChoose: (c: Choice) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<Choice>(canToday ? 'today' : 'skip');
  const options = [
    ...(canToday ? [{ value: 'today' as const, title: 'Do it today', sub: 'A hard session tomorrow becomes easy, so two hard days never stack.' }] : []),
    { value: 'skip' as const, title: 'Skip it', sub: 'The plan carries on. Nothing piles up.' },
    { value: 'pacex' as const, title: 'Ask PaceX', sub: 'Talk it through, e.g. "I\'m sore" or "work got busy".' },
  ];
  return (
    <ModalSheet visible onClose={onClose} tone="page"
      title={`Missed ${DAY[weekday(session.date)]}'s ${session.kind === 'long' ? 'long run' : session.kind}`}
      subtitle="That's fine. Pick what works this week.">
      <View style={{ gap: 12 }}>
        <ChoiceCards options={options} value={choice} onChange={setChoice} />
        <FormButton label={choice === 'pacex' ? 'Open PaceX' : 'Update my week'} onPress={() => onChoose(choice)} />
      </View>
    </ModalSheet>
  );
}

