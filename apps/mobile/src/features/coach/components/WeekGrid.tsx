import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';
import type { SessionWithStatus } from '../hooks/usePlanScreen';

const DAY_ORDER   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_SHORT: Record<string, string> = {
  'Easy Run':    'easy',
  'Tempo':       'tempo',
  'Long Run':    'long',
  'Intervals':   'int',
  'Cross-train': 'cross',
  'Race':        'race',
  'Rest':        '—',
};

const TODAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  sessions: SessionWithStatus[];
  compact?: boolean;
}

export function WeekGrid({ sessions, compact = false }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C, compact), [C, compact]);
  const todayAbbrev = TODAY_ABBREVS[new Date().getDay()];

  return (
    <View style={s.row}>
      {DAY_ORDER.map((dayAbbrev, i) => {
        const session = sessions.find(sess => sess.day === dayAbbrev);
        const isToday = dayAbbrev === todayAbbrev;
        const isRest  = session?.type === 'Rest' || !session;

        let cellBg   = C.surface;
        let textColor = C.t3;
        let borderColor = 'transparent';

        if (!session || isRest) {
          cellBg    = C.surface;
          textColor = C.t3;
        } else if (session.status === 'completed') {
          cellBg    = C.greenBg;
          textColor = C.green;
        } else if (isToday) {
          cellBg      = C.redLo;
          textColor   = C.red;
          borderColor = C.red;
        } else if (session.status === 'missed') {
          cellBg    = C.redLo;
          textColor = C.red;
        }

        const label = session ? (TYPE_SHORT[session.type] ?? session.type.slice(0, 4).toLowerCase()) : '—';
        const displayLabel = session?.status === 'completed' ? '✓' : label;

        return (
          <View
            key={dayAbbrev}
            style={[s.cell, { backgroundColor: cellBg, borderColor }]}
          >
            <Text style={s.dayLabel}>{DAY_ABBREVS[i]}</Text>
            <Text style={[s.sessionLabel, { color: textColor }]} numberOfLines={1}>
              {displayLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function mkStyles(C: AppColors, compact: boolean) {
  const cellW = compact ? 40 : 46;
  const cellH = compact ? 52 : 62;
  return StyleSheet.create({
    row:          { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
    cell:         { width: cellW, height: cellH, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, gap: 4 },
    dayLabel:     { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, letterSpacing: 0.3 },
    sessionLabel: { fontFamily: 'Barlow_500Medium', fontSize: compact ? 9 : 10, textAlign: 'center' },
  });
}
