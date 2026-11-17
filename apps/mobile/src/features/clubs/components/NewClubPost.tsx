// Groups · Clubs: "New post to a club…" (mock GroupsClubs). Opens the club's
// chat with the keyboard up; with several clubs, pick one first.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { getPlayer } from '@shared/services/store';
import type { Club } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';

const initials = (name: string) =>
  name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '·';

export function NewClubPost({ clubs, onPick }: { clubs: Club[]; onPick: (club: Club) => void }) {
  const C = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const [me, setMe] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => { getPlayer().then(p => setMe(p?.username ?? '')).catch(() => {}); }, []);
  if (clubs.length === 0) return null;

  const open = () => (clubs.length === 1 ? onPick(clubs[0]!) : setPicking(true));

  return (
    <>
      <Pressable style={s.box} onPress={open} accessibilityRole="button" accessibilityLabel="New post to a club">
        <View style={s.avatar}><Text style={s.avatarText}>{initials(me)}</Text></View>
        <Text style={s.prompt}>New post to a club…</Text>
      </Pressable>
      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={s.scrim} onPress={() => setPicking(false)}>
          <View style={s.sheet}>
            <Text style={s.title}>Post to which club?</Text>
            {clubs.map(c => (
              <Pressable key={c.id} style={s.row} onPress={() => { setPicking(false); onPick(c); }} accessibilityRole="button">
                <Text style={s.rowText} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = (C: AppColors) => StyleSheet.create({
  box:        { height: 56, borderRadius: 22, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  avatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.lime },
  prompt:     { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
  scrim:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 8 },
  title:      { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, marginBottom: 6 },
  row:        { height: 52, borderRadius: 18, backgroundColor: C.card, justifyContent: 'center', paddingHorizontal: 16 },
  rowText:    { fontFamily: Fonts.medium, fontSize: 16, color: C.t1 },
});
