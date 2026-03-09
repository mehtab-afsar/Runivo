import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Ruler, Moon, Bell, Volume2, Heart, Activity, Satellite,
  Timer, Trophy, Zap, Globe, LogOut, HelpCircle, ChevronRight,
  Shield, Info, Trash2, Download, Target,
} from 'lucide-react';
import { getSettings, saveSettings, StoredSettings, DEFAULT_SETTINGS } from '@shared/services/store';
import { soundManager } from '@shared/audio/sounds';
import { haptic } from '@shared/lib/haptics';
import { supabase } from '@shared/services/supabase';

// ── Reusable primitives ──────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => { onChange(!value); haptic('light'); }}
      className={`w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-teal-500' : 'bg-gray-200'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${value ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({
  icon,
  label,
  sublabel,
  children,
  border = true,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${border ? 'border-b border-gray-100' : ''}`}>
      <span className="text-gray-400 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900">{label}</span>
        {sublabel && <p className="text-[11px] text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2 px-1">{title}</h3>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => { onChange(opt.value); haptic('light'); }}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
            value === opt.value ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const update = useCallback(
    async <K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) => {
      const next = { ...settings, [key]: value };
      setSettings(next);
      await saveSettings(next);

      // Side-effects for specific keys
      if (key === 'soundEnabled') soundManager.setEnabled(value as boolean);
    },
    [settings]
  );

  if (!loaded) {
    return (
      <div className="h-full bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-12">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[#FAFAFA]/90 backdrop-blur border-b border-gray-100 flex items-center gap-3 px-5 py-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => { navigate(-1); haptic('light'); }}
          className="w-8 h-8 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" strokeWidth={2} />
        </button>
        <h1 className="text-base font-bold text-gray-900">Settings</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="px-5 pt-5"
      >

        {/* ── Account ── */}
        <Section title="Account">
          <button
            onClick={() => { navigate('/profile'); haptic('light'); }}
            className="w-full active:bg-gray-50 transition"
          >
            <Row icon={<Shield size={16} strokeWidth={1.8} />} label="Edit Profile">
              <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
            </Row>
          </button>
          <Row icon={<Globe size={16} strokeWidth={1.8} />} label="Profile Visibility" border={false}>
            <SegmentedControl
              options={[
                { label: 'Public',    value: 'public' as const },
                { label: 'Friends',   value: 'followers' as const },
                { label: 'Private',   value: 'private' as const },
              ]}
              value={settings.privacy}
              onChange={v => update('privacy', v)}
            />
          </Row>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <Row icon={<Ruler size={16} strokeWidth={1.8} />} label="Distance Units">
            <SegmentedControl
              options={[
                { label: 'km', value: 'km' as const },
                { label: 'mi', value: 'mi' as const },
              ]}
              value={settings.distanceUnit}
              onChange={v => update('distanceUnit', v)}
            />
          </Row>
          <Row icon={<Moon size={16} strokeWidth={1.8} />} label="Dark Mode" sublabel="Coming soon" border={false}>
            <Toggle value={settings.darkMode} onChange={v => update('darkMode', v)} />
          </Row>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <Row icon={<Bell size={16} strokeWidth={1.8} />} label="Push Notifications">
            <Toggle value={settings.notificationsEnabled} onChange={v => update('notificationsEnabled', v)} />
          </Row>
          <Row icon={<Trophy size={16} strokeWidth={1.8} />} label="Announce Achievements">
            <Toggle value={settings.announceAchievements} onChange={v => update('announceAchievements', v)} />
          </Row>
          <Row icon={<Target size={16} strokeWidth={1.8} />} label="Weekly Summary" sublabel="Sunday recap of your runs" border={false}>
            <Toggle value={settings.weeklySummary} onChange={v => update('weeklySummary', v)} />
          </Row>
        </Section>

        {/* ── Sound & Haptics ── */}
        <Section title="Sound & Haptics">
          <Row icon={<Volume2 size={16} strokeWidth={1.8} />} label="Sound Effects">
            <Toggle value={settings.soundEnabled} onChange={v => update('soundEnabled', v)} />
          </Row>
          <Row icon={<Heart size={16} strokeWidth={1.8} />} label="Haptic Feedback" border={false}>
            <Toggle value={settings.hapticEnabled} onChange={v => update('hapticEnabled', v)} />
          </Row>
        </Section>

        {/* ── Run ── */}
        <Section title="Run Settings">
          <Row icon={<Activity size={16} strokeWidth={1.8} />} label="Auto-Pause" sublabel="Pause when you stop moving">
            <Toggle value={settings.autoPause} onChange={v => update('autoPause', v)} />
          </Row>
          <Row icon={<Satellite size={16} strokeWidth={1.8} />} label="GPS Accuracy">
            <SegmentedControl
              options={[
                { label: 'Standard', value: 'standard' as const },
                { label: 'High',     value: 'high' as const },
              ]}
              value={settings.gpsAccuracy}
              onChange={v => update('gpsAccuracy', v)}
            />
          </Row>
          <Row icon={<Timer size={16} strokeWidth={1.8} />} label="Start Countdown" border={false}>
            <SegmentedControl
              options={[
                { label: 'Off', value: 0 as const },
                { label: '3s',  value: 3 as const },
                { label: '5s',  value: 5 as const },
              ]}
              value={settings.countdownSeconds}
              onChange={v => update('countdownSeconds', v)}
            />
          </Row>
        </Section>

        {/* ── Missions ── */}
        <Section title="Missions">
          <Row icon={<Trophy size={16} strokeWidth={1.8} />} label="Daily Missions">
            <Toggle value={settings.dailyMissionsEnabled} onChange={v => {
              update('dailyMissionsEnabled', v);
              // Keep localStorage in sync for missionStore (which reads it directly)
              localStorage.setItem('runivo-daily-missions', String(v));
            }} />
          </Row>
          <Row icon={<Zap size={16} strokeWidth={1.8} />} label="Difficulty" sublabel="Affects XP rewards" border={false}>
            <SegmentedControl
              options={[
                { label: 'Easy',  value: 'easy' as const },
                { label: 'Mixed', value: 'mixed' as const },
                { label: 'Hard',  value: 'hard' as const },
              ]}
              value={settings.missionDifficulty}
              onChange={v => {
                update('missionDifficulty', v);
                localStorage.setItem('runivo-mission-difficulty', v);
              }}
            />
          </Row>
        </Section>

        {/* ── Data & Privacy ── */}
        <Section title="Data & Privacy">
          <button
            onClick={() => haptic('light')}
            className="w-full active:bg-gray-50 transition"
          >
            <Row icon={<Download size={16} strokeWidth={1.8} />} label="Export Run Data">
              <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
            </Row>
          </button>
          <button
            onClick={() => haptic('light')}
            className="w-full active:bg-gray-50 transition"
          >
            <Row icon={<Trash2 size={16} strokeWidth={1.8} />} label="Clear Run History" sublabel="Removes local data only" border={false}>
              <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
            </Row>
          </button>
        </Section>

        {/* ── Support ── */}
        <Section title="Support">
          <button
            onClick={() => haptic('light')}
            className="w-full active:bg-gray-50 transition"
          >
            <Row icon={<HelpCircle size={16} strokeWidth={1.8} />} label="Help & FAQ">
              <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
            </Row>
          </button>
          <button
            onClick={() => haptic('light')}
            className="w-full active:bg-gray-50 transition"
          >
            <Row icon={<Info size={16} strokeWidth={1.8} />} label="About Runivo" border={false}>
              <span className="text-xs text-gray-400">v1.0.0</span>
            </Row>
          </button>
        </Section>

        {/* ── Subscription shortcut ── */}
        <div className="mb-5">
          <button
            onClick={() => { navigate('/subscription'); haptic('medium'); }}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl
                       bg-gradient-to-r from-teal-500 to-teal-600
                       shadow-[0_4px_20px_rgba(0,180,198,0.2)]
                       active:opacity-90 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Upgrade to Pro</p>
                <p className="text-[11px] text-teal-100">Unlock unlimited zones &amp; features</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70" strokeWidth={2} />
          </button>
        </div>

        {/* ── Log Out ── */}
        <button
          onClick={async () => {
            haptic('medium');
            await supabase.auth.signOut();
            localStorage.removeItem('runivo-onboarding-complete');
            window.location.href = '/';
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 mb-4 rounded-2xl
                     bg-red-50 border border-red-100 active:bg-red-100 transition"
        >
          <LogOut className="w-4 h-4 text-red-500" strokeWidth={2} />
          <span className="text-sm font-semibold text-red-500">Log Out</span>
        </button>

        <p className="text-center text-[10px] text-gray-300 pb-4">Runivo v1.0.0</p>
      </motion.div>
    </div>
  );
}
