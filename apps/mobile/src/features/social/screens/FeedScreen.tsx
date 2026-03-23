import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useFeed } from '@features/social/hooks/useFeed';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import { EmptyFeed } from '@features/social/components/EmptyFeed';
import { StoryReel } from '@features/social/components/StoryReel';
import { fetchStories, type StoryGroup } from '@features/social/services/storyService';
import { supabase } from '@shared/services/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FeedTab = 'explore' | 'following';

const C = { bg: '#F7F6F4', black: '#0A0A0A', t3: '#ADADAD', red: '#D93518', border: '#DDD9D4' };

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab]       = useState<FeedTab>('explore');
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const { posts, loading, refreshing, toggleKudos, refresh } = useFeed();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) fetchStories(session.user.id).then(setStories).catch(() => {});
    });
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Feed</Text>
        <Pressable onPress={() => navigation.navigate('Notifications')}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        <Pressable style={[s.tabBtn, tab === 'explore' && s.tabBtnActive]} onPress={() => setTab('explore')}>
          <Text style={[s.tabLabel, tab === 'explore' && s.tabLabelActive]}>Explore</Text>
        </Pressable>
        <Pressable style={[s.tabBtn, tab === 'following' && s.tabBtnActive]} onPress={() => setTab('following')}>
          <Text style={[s.tabLabel, tab === 'following' && s.tabLabelActive]}>Following</Text>
        </Pressable>
      </View>

      <StoryReel groups={stories} onPress={(g, i) => navigation.navigate('StoryViewer' as any, { groups: stories, initialGroupIndex: i })} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList data={posts} keyExtractor={(p) => p.id}
          renderItem={({ item }) => <FeedPostCard post={item} onKudos={() => toggleKudos(item.id)} onPress={() => {}} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={<EmptyFeed tab={tab} />} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 8 },
  title:         { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black },
  tabs:          { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabBtnActive:  { borderBottomColor: C.black },
  tabLabel:      { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
  tabLabelActive:{ fontFamily: 'Barlow_500Medium', color: C.black },
  list:          { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 100 },
  loader:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
