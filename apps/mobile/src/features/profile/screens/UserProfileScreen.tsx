import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { UserPlus, MessageSquare, Check, MapPin } from 'lucide-react-native';
import { supabase } from '@shared/services/supabase';
import { Avatar } from '../components/Avatar';
import { avatarColor } from '@shared/lib/avatarUtils';
import { Colors } from '@theme';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'UserProfile'>;

const C = Colors;

interface UserData {
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  total_runs?: number;
  total_distance_km?: number;
  territories_claimed?: number;
  level?: number;
}

export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId, username } = route.params;

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, bio, location, avatar_color, avatar_url, total_runs, total_distance_km, territories_claimed, level')
        .eq('id', userId)
        .single();
      setUser(data ?? null);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: follow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', session.user.id)
          .eq('following_id', userId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', userId);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: userId });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  };

  const handleMessage = () => {};

  const displayName = user?.display_name || username;
  const color = user?.avatar_color || avatarColor(username);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>{username}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.red} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.profileSection}>
            <Avatar name={displayName} color={color} size={64} />
            <Text style={s.displayName}>{displayName}</Text>
            {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
            {user?.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} color={C.t3} strokeWidth={1.5} />
                <Text style={s.location}>{user.location}</Text>
              </View>
            ) : null}
            {user?.level ? <Text style={s.level}>Level {user.level}</Text> : null}

            {/* Follow / Message actions */}
            <View style={s.actions}>
              <Pressable
                style={[s.followBtn, isFollowing && s.followingBtn]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                {isFollowing ? (
                  <Check size={14} color={C.black} strokeWidth={2} />
                ) : (
                  <UserPlus size={14} color={C.white} strokeWidth={2} />
                )}
                <Text style={[s.followBtnLabel, isFollowing && s.followingBtnLabel]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable style={[s.messageBtn, s.messageBtnDisabled]} disabled>
                <MessageSquare size={14} color={C.t3} strokeWidth={1.5} />
                <Text style={[s.messageBtnLabel, s.messageBtnLabelDisabled]}>Message</Text>
              </Pressable>
            </View>
          </View>

          {/* Stats grid */}
          <View style={s.statsGrid}>
            {[
              { label: 'Runs', value: String(user?.total_runs ?? 0) },
              { label: 'km', value: (user?.total_distance_km ?? 0).toFixed(0) },
              { label: 'Zones', value: String(user?.territories_claimed ?? 0) },
            ].map(stat => (
              <View key={stat.label} style={s.statCell}>
                <Text style={s.statValue}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:      { width: 32 },
  backText:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  profileSection:{ alignItems: 'center', padding: 24, gap: 6 },
  displayName:  { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black, marginTop: 8 },
  bio:          { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
  location:     { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  level:        { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.red },
  actions:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  followBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.black, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  followingBtn: { backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
  followBtnLabel:   { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.white },
  followingBtnLabel:{ color: C.black },
  messageBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.stone, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 18, paddingVertical: 10 },
  messageBtnDisabled: { opacity: 0.45 },
  messageBtnLabel:  { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  messageBtnLabelDisabled: { color: C.t3 },
  statsGrid:    { flexDirection: 'row', marginHorizontal: 20, backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  statCell:     { flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: 0.5, borderRightColor: C.border },
  statValue:    { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black, letterSpacing: -0.5 },
  statLabel:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
});
