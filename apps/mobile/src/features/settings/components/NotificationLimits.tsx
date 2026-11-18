/** N3: quiet hours and the daily nudge limit, stored on the server where nudges are sent. */
import React, { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { supabase } from '@shared/services/supabase';
import { SettingRow } from './SettingRow';
import { SegmentedControl } from './SettingToggle';

const QUIET = [
  { label: 'Off', start: 0, end: 0 },
  { label: '21–7', start: 21, end: 7 },
  { label: '22–7', start: 22, end: 7 },
  { label: '23–8', start: 23, end: 8 },
];
const LIMITS = [1, 2, 3, 5];

export function NotificationLimits() {
  const [quiet, setQuiet] = useState('22–7');
  const [limit, setLimit] = useState(3);
  useEffect(() => {
    supabase.rpc('get_notification_prefs').then(({ data }) => {
      const row = (data as { quiet_start: number; quiet_end: number; daily_limit: number }[] | null)?.[0];
      if (!row) return;
      const q = QUIET.find(o => o.start === row.quiet_start && o.end === row.quiet_end);
      setQuiet(q?.label ?? `${row.quiet_start}–${row.quiet_end}`);
      setLimit(row.daily_limit);
    }, () => {});
  }, []);

  const save = (label: string, lim: number) => {
    const q = QUIET.find(o => o.label === label) ?? QUIET[2];
    supabase.rpc('set_notification_prefs', { p_quiet_start: q.start, p_quiet_end: q.end, p_daily_limit: lim }).then(() => {}, () => {});
  };

  return (
    <>
      <SettingRow label="Quiet hours" sub="No nudges in these hours, your local time. Stolen zones and safety alerts still come through." stacked>
        <SegmentedControl fit={false} options={QUIET.map(o => o.label)} value={quiet} onChange={v => { setQuiet(v); save(v, limit); }} />
      </SettingRow>
      <SettingRow label="Nudges a day" sub="Reminders and fading-zone warnings, at most">
        <SegmentedControl options={LIMITS.map(String)} value={String(limit)} onChange={v => { const n = Number(v); setLimit(n); save(quiet, n); }} />
      </SettingRow>
    </>
  );
}

/** N4: opt in to "Sam just claimed a zone next to yours". */
export function FriendZoneAlerts({ trackColor, thumbColor }: { trackColor?: { false: string; true: string }; thumbColor?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { supabase.rpc('get_friend_zone_alerts').then(({ data }) => setOn(!!data), () => {}); }, []);
  return (
    <SettingRow label="Friends near your zones" sub="When someone you follow claims ground next to yours">
      <Switch value={on} trackColor={trackColor} thumbColor={thumbColor}
        onValueChange={v => { setOn(v); supabase.rpc('set_friend_zone_alerts', { p_on: v }).then(() => {}, () => setOn(!v)); }} />
    </SettingRow>
  );
}

/** N5: a weekly email when push is off. */
export function EmailDigest({ trackColor, thumbColor }: { trackColor?: { false: string; true: string }; thumbColor?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => { supabase.rpc('get_email_digest').then(({ data }) => setOn(data !== false), () => {}); }, []);
  return (
    <SettingRow label="Weekly email when push is off" sub="Your week, your zones and what's fading, every Monday">
      <Switch value={on} trackColor={trackColor} thumbColor={thumbColor}
        onValueChange={v => { setOn(v); supabase.rpc('set_email_digest', { p_on: v }).then(() => {}, () => setOn(!v)); }} />
    </SettingRow>
  );
}
