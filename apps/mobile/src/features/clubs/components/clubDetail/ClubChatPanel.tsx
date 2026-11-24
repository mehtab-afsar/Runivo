import React, { useMemo, type ComponentProps, type RefObject } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import { ClubInitialsTile } from '../ClubHeroCard';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  listRef: RefObject<FlatList<LobbyMessage> | null>;
  messages: LobbyMessage[];
  loading: boolean;
  error: string | null;
  clubName: string;
  clubAvatar: string | null;
  currentUserId: string | null;
  /** Long-press menu (report / block / delete / remove). */
  onMessageOptions: (m: LobbyMessage) => void;
  inputText: string;
  onChangeInput: (text: string) => void;
  onSend: ComponentProps<typeof ChatInput>['onSend'];
  sending: boolean;
  autoFocus: boolean;
}

export function ClubChatPanel({
  listRef, messages, loading, error, clubName, clubAvatar, currentUserId, onMessageOptions,
  inputText, onChangeInput, onSend, sending, autoFocus,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : messages.length === 0 && error ? (
        // A failed load is not "No messages yet".
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Couldn't load the chat</Text>
          <Text style={s.emptyText}>{error}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={s.empty}>
          <ClubInitialsTile name={clubName} size={48} uri={clubAvatar} shape="hex" />
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyText}>Start the conversation with your club!</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={msg => msg.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} isOwn={item.userId === currentUserId} onLongPress={() => onMessageOptions(item)} />
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      {/* Send failures (offline, blocked words, suspended) used to vanish silently. */}
      {!!error && messages.length > 0 && (
        <Text style={[s.emptyText, { color: C.danger, paddingHorizontal: 18, paddingBottom: 6 }]} accessibilityRole="alert">{error}</Text>
      )}
      <ChatInput value={inputText} onChange={onChangeInput} onSend={onSend} sending={sending} placeholder={`Message ${clubName}`} autoFocus={autoFocus} />
    </KeyboardAvoidingView>
  );
}
