import { useState, useEffect } from 'react';
import { TrendingUp, Navigation, Zap, Award } from 'lucide-react';
import { supabase } from '@shared/services/supabase';
import type { LeaderboardTab, TimeFrame, LeaderboardEntry } from '../types';
import { T, F, FD } from '@shared/design-system/tokens';

const redBo = 'rgba(217,53,24,0.2)';

// Medal constants — match mobile LeaderboardScreen exactly
const MEDAL_EMOJIS  = ['🥈', '🥇', '🥉'];
const MEDAL_COLORS  = ['#9E9E9E', '#D4A200', '#A0522D']; // silver, gold, bronze

const AVATAR_PALETTE = ['#C4B0D8', '#8FD4B0', '#F4A460'];

export default function Leaderboard() {
  const [tab, setTab] = useState<LeaderboardTab>('distance');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, timeFrame]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (timeFrame === 'week') {
      const { data } = await supabase
        .from('leaderboard_weekly')
        .select('id, username, level, weekly_xp, weekly_km, weekly_territories, rank')
        .order('rank', { ascending: true })
        .limit(50);

      if (data) {
        const mapped: LeaderboardEntry[] = data.map(row => ({
          rank: row.rank,
          name: row.username,
          level: row.level,
          value:
            tab === 'distance'
              ? Math.round(Number(row.weekly_km) * 10) / 10
              : tab === 'xp'
              ? Number(row.weekly_xp)
              : Number(row.weekly_territories),
          isPlayer: user?.id === row.id,
        }));
        mapped.sort((a, b) => b.value - a.value);
        mapped.forEach((e, i) => {
          e.rank = i + 1;
        });
        setEntries(mapped);
      }
    } else {
      const cutoff =
        timeFrame === 'month'
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(0).toISOString();

      const [{ data: runs }, { data: profiles }] = await Promise.all([
        supabase
          .from('runs')
          .select('user_id, distance_m, xp_earned, territories_claimed')
          .gte('started_at', cutoff),
        supabase.from('profiles').select('id, username, level'),
      ]);

      if (runs && profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const totals = new Map<string, { km: number; xp: number; zones: number }>();

        for (const run of runs) {
          const prev = totals.get(run.user_id) ?? { km: 0, xp: 0, zones: 0 };
          totals.set(run.user_id, {
            km: prev.km + run.distance_m / 1000,
            xp: prev.xp + run.xp_earned,
            zones: prev.zones + (run.territories_claimed?.length ?? 0),
          });
        }

        const mapped: LeaderboardEntry[] = Array.from(totals.entries()).map(([uid, t]) => {
          const profile = profileMap.get(uid);
          return {
            rank: 0,
            name: profile?.username ?? 'Runner',
            level: profile?.level ?? 1,
            value:
              tab === 'distance'
                ? Math.round(t.km * 10) / 10
                : tab === 'xp'
                ? t.xp
                : t.zones,
            isPlayer: user?.id === uid,
          };
        });

        mapped.sort((a, b) => b.value - a.value);
        mapped.forEach((e, i) => {
          e.rank = i + 1;
        });
        setEntries(mapped);
      }
    }
    setLoading(false);
  };

  const formatValue = (value: number): string => {
    if (tab === 'distance') return `${value.toFixed(1)} km`;
    if (tab === 'xp') return `${value.toLocaleString()} XP`;
    return `${Math.floor(value)} zones`;
  };

  const playerEntry = entries.find(e => e.isPlayer);

  const metricTabs: { id: LeaderboardTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'distance',
      label: 'Distance',
      icon: (
        <TrendingUp
          size={11}
          strokeWidth={1.5}
          style={{ color: tab === 'distance' ? T.red : T.t3 }}
        />
      ),
    },
    {
      id: 'territories',
      label: 'Zones',
      icon: (
        <Navigation
          size={11}
          strokeWidth={1.5}
          style={{ color: tab === 'territories' ? T.red : T.t3 }}
        />
      ),
    },
    {
      id: 'xp',
      label: 'XP',
      icon: (
        <Zap
          size={11}
          strokeWidth={1.5}
          style={{ color: tab === 'xp' ? T.red : T.t3 }}
        />
      ),
    },
  ];

  const timeFrames: { id: TimeFrame; label: string }[] = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  // Podium order: 2nd (index 1), 1st (index 0), 3rd (index 2)
  const podiumOrder = entries.length >= 3 ? [entries[1], entries[0], entries[2]] : [];
  // visual positions: 0=2nd place, 1=1st place, 2=3rd place
  const podiumRanks = [2, 1, 3];
  const podiumAvatarSizes = [34, 40, 30];
  const podiumFontSizes = [12, 14, 10];
  const podiumBlockWidths = [60, 70, 52];
  const podiumBlockHeights = [40, 58, 28];

  return (
    <div
      style={{
        height: '100%',
        background: T.bg,
        overflowY: 'auto',
        fontFamily: F,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: T.white,
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          padding: '0 18px 12px',
          borderBottom: `0.5px solid ${T.border}`,
        }}
      >
        <div
          style={{
            paddingTop: 'max(14px, env(safe-area-inset-top))',
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontStyle: 'italic',
              fontFamily: FD,
              color: T.black,
              margin: 0,
              fontWeight: 400,
            }}
          >
            Leaderboard
          </h1>
        </div>
      </div>

      {/* Metric Tabs */}
      <div
        style={{
          background: T.white,
          padding: '10px 18px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex',
          gap: 6,
        }}
      >
        {metricTabs.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '7px 6px',
                borderRadius: 20,
                border: `0.5px solid ${isActive ? 'rgba(217,53,24,0.3)' : T.border}`,
                background: isActive ? T.redLo : T.bg,
                fontSize: 10,
                fontFamily: F,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? T.red : T.t3,
                cursor: 'pointer',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Time Frame Filter */}
      <div
        style={{
          background: T.white,
          padding: '10px 18px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex',
          gap: 4,
        }}
      >
        {timeFrames.map(tf => {
          const isActive = timeFrame === tf.id;
          return (
            <button
              key={tf.id}
              onClick={() => setTimeFrame(tf.id)}
              style={{
                flex: 1,
                padding: '6px',
                textAlign: 'center',
                borderRadius: 4,
                fontSize: 9,
                fontFamily: F,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? T.red : T.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                border: 'none',
                background: isActive ? T.redLo : 'transparent',
              }}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 18px',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: `2px solid ${T.border}`,
              borderTopColor: T.red,
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 18px',
            gap: 8,
          }}
        >
          <Award size={32} strokeWidth={1.5} style={{ color: T.t3 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: T.black,
              fontFamily: F,
            }}
          >
            No runners yet
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 300,
              color: T.t3,
              fontFamily: F,
            }}
          >
            Complete a run to appear here
          </span>
        </div>
      )}

      {!loading && entries.length >= 3 && (
        <>
          {/* Podium */}
          <div
            style={{
              background: T.white,
              padding: '16px 18px',
              borderBottom: `0.5px solid ${T.border}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {podiumOrder.map((entry, posIdx) => {
              const rank      = podiumRanks[posIdx];
              const avatarSize    = podiumAvatarSizes[posIdx];
              const avatarFontSize = podiumFontSizes[posIdx];
              const blockW    = podiumBlockWidths[posIdx];
              const blockH    = podiumBlockHeights[posIdx];
              const isFirst   = rank === 1;
              const blockBg   = isFirst ? T.black : T.border;
              const rankColor = isFirst ? '#FFFFFF' : T.t2;
              const medalColor = MEDAL_COLORS[posIdx];

              return (
                <div
                  key={entry.name + rank}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                >
                  {/* Award crown for 1st */}
                  {isFirst
                    ? <Award size={16} strokeWidth={1.5} style={{ color: '#D4A200', marginBottom: 2 }} />
                    : <div style={{ height: 18 }} />}
                  {/* Medal emoji */}
                  <span style={{ fontSize: avatarFontSize + 2, lineHeight: 1, marginBottom: 2 }}>
                    {MEDAL_EMOJIS[posIdx]}
                  </span>
                  {/* Avatar — bordered with medal color */}
                  <div
                    style={{
                      width:        avatarSize,
                      height:       avatarSize,
                      borderRadius: '50%',
                      background:   AVATAR_PALETTE[posIdx],
                      border:       `2px solid ${medalColor}`,
                      display:      'flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      fontSize:     avatarFontSize,
                      fontWeight:   500,
                      color:        '#FFFFFF',
                      fontFamily:   F,
                    }}
                  >
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Name */}
                  <span
                    style={{
                      fontSize:     9,
                      fontWeight:   400,
                      color:        T.black,
                      fontFamily:   F,
                      textAlign:    'center',
                      maxWidth:     56,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {entry.name}
                  </span>
                  {/* Score */}
                  <span style={{ fontSize: 10, fontWeight: 500, color: T.black, fontFamily: F }}>
                    {formatValue(entry.value)}
                  </span>
                  {/* Podium block */}
                  <div
                    style={{
                      width:        blockW,
                      height:       blockH,
                      background:   blockBg,
                      borderRadius: '6px 6px 0 0',
                      border:       isFirst ? undefined : `0.5px solid ${T.border}`,
                      display:      'flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500, color: rankColor, fontFamily: F }}>
                      #{rank}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Your Rank Card (if rank > 3) */}
          {playerEntry && playerEntry.rank > 3 && (
            <div
              style={{
                margin: '1px 18px 0',
                background: T.redLo,
                border: `0.5px solid rgba(217,53,24,0.25)`,
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: T.red,
                  width: 24,
                  textAlign: 'center',
                  letterSpacing: '-0.02em',
                  fontFamily: F,
                }}
              >
                {playerEntry.rank}
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: T.black,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 400,
                  color: '#FFFFFF',
                  fontFamily: F,
                }}
              >
                {playerEntry.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: T.black,
                    fontFamily: F,
                  }}
                >
                  {playerEntry.name}
                </span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 2,
                    background: T.redLo,
                    color: T.red,
                    fontSize: 8,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    border: `0.5px solid ${redBo}`,
                    marginLeft: 6,
                    fontFamily: F,
                  }}
                >
                  You
                </span>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 300,
                  color: T.black,
                  letterSpacing: '-0.02em',
                  fontFamily: F,
                }}
              >
                {formatValue(playerEntry.value)}
              </span>
            </div>
          )}

          {/* Rankings List (4th+) */}
          <div
            style={{
              background: T.white,
              marginTop: 1,
            }}
          >
            {entries.slice(3).map(entry => (
              <div
                key={entry.name + entry.rank}
                style={{
                  padding: '10px 18px',
                  borderBottom: `0.5px solid ${T.mid}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: entry.isPlayer ? T.redLo : T.white,
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 300,
                    color: T.t3,
                    width: 20,
                    textAlign: 'center',
                    fontFamily: F,
                  }}
                >
                  {entry.rank}
                </span>
                {/* Avatar */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: T.stone,
                    border: `0.5px solid ${T.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 400,
                    color: T.t2,
                    fontFamily: F,
                  }}
                >
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                {/* Name + You badge */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 400,
                    color: T.black,
                    fontFamily: F,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {entry.name}
                  {entry.isPlayer && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 2,
                        background: T.redLo,
                        color: T.red,
                        fontSize: 8,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        border: `0.5px solid ${redBo}`,
                        fontFamily: F,
                      }}
                    >
                      You
                    </span>
                  )}
                </span>
                {/* Level badge */}
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 2,
                    background: T.stone,
                    fontSize: 8,
                    fontWeight: 500,
                    color: T.t2,
                    textTransform: 'uppercase',
                    fontFamily: F,
                  }}
                >
                  Lv. {entry.level}
                </span>
                {/* Score */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    color: T.black,
                    letterSpacing: '-0.02em',
                    fontFamily: F,
                  }}
                >
                  {formatValue(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rankings list when fewer than 3 entries but > 0 */}
      {!loading && entries.length > 0 && entries.length < 3 && (
        <div
          style={{
            background: T.white,
            marginTop: 1,
          }}
        >
          {entries.map(entry => (
            <div
              key={entry.name + entry.rank}
              style={{
                padding: '10px 18px',
                borderBottom: `0.5px solid ${T.mid}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: entry.isPlayer ? T.redLo : T.white,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 300,
                  color: T.t3,
                  width: 20,
                  textAlign: 'center',
                  fontFamily: F,
                }}
              >
                {entry.rank}
              </span>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: T.stone,
                  border: `0.5px solid ${T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 400,
                  color: T.t2,
                  fontFamily: F,
                }}
              >
                {entry.name.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 400,
                  color: T.black,
                  fontFamily: F,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {entry.name}
                {entry.isPlayer && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 2,
                      background: T.redLo,
                      color: T.red,
                      fontSize: 8,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      border: `0.5px solid ${redBo}`,
                      fontFamily: F,
                    }}
                  >
                    You
                  </span>
                )}
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 2,
                  background: T.stone,
                  fontSize: 8,
                  fontWeight: 500,
                  color: T.t2,
                  textTransform: 'uppercase',
                  fontFamily: F,
                }}
              >
                Lv. {entry.level}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: T.black,
                  letterSpacing: '-0.02em',
                  fontFamily: F,
                }}
              >
                {formatValue(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
