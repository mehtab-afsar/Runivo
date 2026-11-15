/** Activity page: the cheers friends sent during this run. Nothing when there were none. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getPlayer } from '@shared/services/store';
import { fetchRunCheers, cheerText, type Cheer } from './cheerService';

export function RunCheers({ runId, runStart }: { runId: string; runStart?: number }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [list, setList] = useState<Cheer[]>([]);
  const [runnerName, setRunnerName] = useState('');
  useEffect(() => { fetchRunCheers(runId).then(setList).catch(() => {}); }, [runId]);
  useEffect(() => { getPlayer().then(p => setRunnerName(p?.username ?? '')).catch(() => {}); }, []);
  if (list.length === 0) return null;

  const when = (t: number) => {
    if (!runStart) return '';
    const min = Math.max(0, Math.round((t - runStart) / 60000));
    return `${min} min in`;
  };

  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">👏 {list.length} {list.length === 1 ? 'cheer' : 'cheers'} during this run</Text>
      {list.map(c => (
        <View key={c.id} style={s.row}>
          <Avatar name={c.fromName} size={34} />
          <Text style={s.txt} numberOfLines={2}>
            <Text style={s.name}>{c.fromName} </Text>"{cheerText(c.message, runnerName)}"
          </Text>
          {!!runStart && <Text style={s.when}>{when(c.createdAt)}</Text>}
        </View>
      ))}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card:  { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 12 },
    title: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    row:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    txt:   { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    name:  { fontFamily: Fonts.semiBold },
    when:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
  });
}
