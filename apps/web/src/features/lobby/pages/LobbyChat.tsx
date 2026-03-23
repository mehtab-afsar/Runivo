import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { useNavVisibility } from '@/shared/hooks/useNavVisibility';
import { supabase } from '@shared/services/supabase';
import {
  LOBBY_ROOMS,
  fetchLobbyMessages,
  sendLobbyMessage,
  subscribeToLobbyRoom,
  type LobbyMessage,
} from '../services/lobbyService';
import { avatarColor } from '@shared/lib/avatarUtils';
import { T, F } from '@shared/design-system/tokens';


function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, isMe }: { msg: LobbyMessage; isMe: boolean }) {
  const bg = avatarColor(msg.userName);
  const initials = msg.userName.slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end', gap: 8, padding: '2px 16px',
      }}
    >
      {/* Avatar — others only */}
      {!isMe && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: F,
        }}>
          {initials}
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        {/* Name + level — others only */}
        {!isMe && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.t2, fontFamily: F }}>{msg.userName}</span>
            <span style={{
              fontSize: 9, fontWeight: 500, color: bg,
              background: `${bg}18`, borderRadius: 4, padding: '1px 4px', fontFamily: F,
            }}>
              Lv.{msg.userLevel}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div style={{
          background: isMe ? T.red : T.white,
          color: isMe ? '#fff' : T.black,
          border: isMe ? 'none' : `1px solid ${T.border}`,
          borderRadius: isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          padding: '8px 12px',
          fontSize: 14, fontFamily: F, lineHeight: 1.45,
        }}>
          {msg.message}
        </div>

        {/* Timestamp */}
        <span style={{ fontSize: 10, color: T.t3, fontFamily: F, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
          {formatTime(msg.timestamp)}
        </span>
      </div>

      {/* Spacer for own messages */}
      {isMe && <div style={{ width: 30, flexShrink: 0 }} />}
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LobbyChat() {
  const navigate = useNavigate();
  const { id: roomId = 'global' } = useParams<{ id: string }>();
  const { setNavVisible } = useNavVisibility();

  const room = LOBBY_ROOMS.find(r => r.id === roomId) ?? LOBBY_ROOMS[0];

  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Hide bottom nav
  useEffect(() => {
    setNavVisible(false);
    return () => setNavVisible(true);
  }, [setNavVisible]);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Load messages + subscribe
  useEffect(() => {
    setLoading(true);
    fetchLobbyMessages(roomId).then(msgs => {
      setMessages(msgs);
      setLoading(false);
      if (msgs.length === 0) {
        // Could be empty room or unavailable table — will show empty state
      }
    }).catch(() => {
      setUnavailable(true);
      setLoading(false);
    });

    const unsub = subscribeToLobbyRoom(roomId, msg => {
      setMessages(prev => [...prev, msg]);
    });
    return unsub;
  }, [roomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    try {
      await sendLobbyMessage(roomId, text);
    } catch {
      // Optimistic — message will arrive via realtime if sent
      // If table unavailable, show nothing
      setUnavailable(true);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
    haptic('light');
  }, [input, sending, roomId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        flexShrink: 0, zIndex: 50,
        background: 'rgba(248,246,243,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${T.border}`,
        padding: '10px 16px',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/lobby')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.black }}
          >
            <ArrowLeft size={22} />
          </button>

          {/* Room emoji + name */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${room.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {room.emoji}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.black, fontFamily: F }}>{room.name}</div>
            <div style={{ fontSize: 11, color: T.t3, fontFamily: F }}>{room.description}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Loader2 size={24} color={T.t3} style={{ animation: 'lobby-spin 0.8s linear infinite' }} />
            <style>{`@keyframes lobby-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : unavailable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 32 }}>
            <span style={{ fontSize: 40 }}>{room.emoji}</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.black, fontFamily: F }}>Coming soon</div>
            <div style={{ fontSize: 13, color: T.t2, fontFamily: F, textAlign: 'center' }}>
              Community chat is being set up. Check back soon!
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 32 }}>
            <span style={{ fontSize: 40 }}>{room.emoji}</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.black, fontFamily: F }}>No messages yet</div>
            <div style={{ fontSize: 13, color: T.t2, fontFamily: F, textAlign: 'center' }}>
              Be the first to start the conversation in {room.name}!
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <Bubble key={msg.id} msg={msg} isMe={msg.userId === currentUserId} />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      {!unavailable && (
        <div style={{
          flexShrink: 0,
          background: 'rgba(248,246,243,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `0.5px solid ${T.border}`,
          padding: '10px 16px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: T.white, border: `1px solid ${T.border}`,
            borderRadius: 24, padding: '8px 16px',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message..."
              maxLength={500}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: T.black, fontFamily: F,
              }}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !sending ? T.red : T.mid,
              border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms',
            }}
          >
            <Send size={16} color={input.trim() && !sending ? '#fff' : T.t3} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
