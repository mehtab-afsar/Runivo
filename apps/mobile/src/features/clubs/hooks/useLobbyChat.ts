import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchMessages,
  sendMessage as sendMessageService,
  subscribeToMessages,
} from '@features/clubs/services/lobbyChatService';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import { fetchMyBlockedIds } from '@features/social/services/safetyService';

export function useLobbyChat(lobbyId: string) {
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const seenIds = useRef(new Set<string>());
  // Messages from runners you blocked are not shown (they stay in the room for others).
  const blockedIds = useRef(new Set<string>());
  useEffect(() => { fetchMyBlockedIds().then(ids => { blockedIds.current = ids; setMessages(prev => prev.filter(m => !ids.has(m.userId))); }).catch(() => {}); }, []);

  const addMessage = useCallback((msg: LobbyMessage) => {
    if (seenIds.current.has(msg.id) || blockedIds.current.has(msg.userId)) return;
    seenIds.current.add(msg.id);
    setMessages(prev => [...prev, msg]);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    seenIds.current = new Set();

    // Subscribe before the initial fetch resolves so a message that arrives in
    // between isn't missed; addMessage dedupes by id so it isn't double-added
    // once the fetch's own result comes back.
    const unsubscribe = subscribeToMessages(lobbyId, addMessage);

    fetchMessages(lobbyId)
      .then((msgs) => {
        msgs.forEach(m => seenIds.current.add(m.id));
        setMessages(msgs.filter(m => !blockedIds.current.has(m.userId)));
      })
      .catch(() => setError('Could not load messages. Check your connection.'))
      .finally(() => setLoading(false));

    return unsubscribe;
  }, [lobbyId, addMessage]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    // Keep the text in the input until the send actually succeeds — clearing it
    // eagerly (the previous behavior) silently discarded the user's message on
    // any failure (offline, RLS) with no way to recover what they typed.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not signed in');
      await sendMessageService(lobbyId, user.id, text);
      setInputText('');
    } catch {
      setError('Could not send — check your connection and try again.');
    }
    setSending(false);
  }, [inputText, sending, lobbyId]);

  /** Drop a message from the list (after it was deleted). */
  const removeMessage = useCallback((id: string) => setMessages(prev => prev.filter(m => m.id !== id)), []);

  /** Hide everything from a runner you just blocked, now and as new messages arrive. */
  const removeMessagesFrom = useCallback((userId: string) => {
    blockedIds.current.add(userId);
    setMessages(prev => prev.filter(m => m.userId !== userId));
  }, []);

  return { messages, loading, error, inputText, setInputText, sending, sendMessage, removeMessage, removeMessagesFrom };
}
