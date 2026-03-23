import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, ChevronRight, TrendingUp } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { LOBBY_ROOMS, getLobbyRoomCounts, type LobbyRoom } from '../services/lobbyService';
import { T, F, FD } from '@shared/design-system/tokens';

// ── Room Card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room,
  activity,
  idx,
  onClick,
}: {
  room: LobbyRoom;
  activity: number;
  idx: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        background: T.white, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Emoji icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: `${room.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {room.emoji}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.black, fontFamily: F, marginBottom: 2 }}>
          {room.name}
        </div>
        <div style={{ fontSize: 12, color: T.t2, fontFamily: F }}>{room.description}</div>
        {activity > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendingUp size={10} color={T.red} />
            <span style={{ fontSize: 10, color: T.red, fontFamily: F, fontWeight: 500 }}>
              {activity} messages today
            </span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight size={18} color={T.t3} style={{ flexShrink: 0 }} />
    </motion.button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Lobby() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Record<string, number>>({});

  useEffect(() => {
    getLobbyRoomCounts().then(setActivity).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100%', background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,246,243,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `0.5px solid ${T.border}`,
        padding: '12px 20px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.black }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FD, color: T.black }}>
              Community
            </div>
            <div style={{ fontSize: 11, color: T.t3, fontFamily: F, marginTop: 1 }}>
              Chat with runners worldwide
            </div>
          </div>
          <MessageCircle size={20} color={T.t3} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>

        {/* Section label */}
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: T.t3, fontFamily: F, marginBottom: 12,
        }}>
          Chat Rooms
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LOBBY_ROOMS.map((room, i) => (
            <RoomCard
              key={room.id}
              room={room}
              activity={activity[room.id] ?? 0}
              idx={i}
              onClick={() => { haptic('light'); navigate(`/lobby/${room.id}`); }}
            />
          ))}
        </div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            marginTop: 24, background: T.redLo, borderRadius: 14,
            padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.red, fontFamily: F }}>
              Be respectful
            </div>
            <div style={{ fontSize: 12, color: T.t2, fontFamily: F, marginTop: 2 }}>
              Keep conversations positive and on-topic. Toxic behaviour will result in a ban.
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
