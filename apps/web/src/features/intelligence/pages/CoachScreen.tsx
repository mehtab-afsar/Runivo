import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, ChevronDown, ChevronUp, Sparkles, Flame } from 'lucide-react';
import { useCoachChat } from '../hooks/useCoachChat';
import type { CoachMessage, TrainingPlan, TrainingWeek } from '../services/intelligenceService';

const T = {
  bg: '#F8F6F3', black: '#0A0A0A', white: '#FFFFFF',
  t3: '#A39E98', border: '#DDD9D4', red: '#D93518',
  purple: '#F2EEF9', purpleDark: '#7C3AED',
};
const PROMPTS = [
  'How can I improve my pace?',
  'Build me a 5K training plan',
  'How should I warm up before a run?',
  'Tips for running in the heat?',
];

function TypingIndicator() {
  return (
    <div className="flex gap-2 px-4 py-2">
      <div style={{ width: 32, height: 32, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Sparkles size={14} color={T.purpleDark} />
      </div>
      <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: '4px 14px 14px 14px', padding: '10px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 0.2, 0.4].map(d => (
          <motion.div key={d} style={{ width: 6, height: 6, borderRadius: 3, background: T.t3 }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: d }} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: CoachMessage }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', gap: 8, padding: '4px 16px', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={14} color={T.purpleDark} />
        </div>
      )}
      <div style={{
        maxWidth: '72%', padding: '10px 14px', lineHeight: 1.55, fontSize: 13,
        fontFamily: 'Barlow_400Regular, sans-serif', color: isUser ? T.white : T.black,
        background: isUser ? T.black : T.white,
        border: isUser ? 'none' : `0.5px solid ${T.border}`,
        borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </motion.div>
  );
}

function TrainingPlanAccordion({ plan, open, onToggle, goalInput, onGoalChange, onGenerate, loading }:
  { plan: TrainingPlan | null; open: boolean; onToggle: () => void;
    goalInput: string; onGoalChange: (v: string) => void; onGenerate: () => void; loading: boolean }) {
  return (
    <div style={{ borderBottom: `0.5px solid ${T.border}`, background: T.white }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <Flame size={16} color={T.red} />
        <span style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 13, color: T.black, flex: 1, textAlign: 'left' }}>
          Training Plan {plan ? `— ${plan.goal}` : ''}
        </span>
        {open ? <ChevronUp size={16} color={T.t3} /> : <ChevronDown size={16} color={T.t3} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 16px 12px' }}>
              {!plan ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={goalInput} onChange={e => onGoalChange(e.target.value)}
                    placeholder="e.g. Run a 5K in under 30 minutes"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `0.5px solid ${T.border}`, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 13, color: T.black, background: T.bg, outline: 'none' }} />
                  <button onClick={onGenerate} disabled={!goalInput.trim() || loading}
                    style={{ padding: '8px 14px', borderRadius: 8, background: loading ? T.border : T.black, color: T.white, border: 'none', cursor: loading ? 'default' : 'pointer', fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 12 }}>
                    {loading ? '...' : 'Generate'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.weeks.map((w: TrainingWeek) => (
                    <div key={w.week} style={{ background: T.bg, borderRadius: 8, padding: 12 }}>
                      <p style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 12, color: T.black, marginBottom: 4 }}>Week {w.week} — {w.summary}</p>
                      {w.days.map(d => (
                        <p key={d.day} style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 11, color: T.t3, lineHeight: 1.6 }}>
                          <span style={{ color: T.black }}>{d.day}:</span> {d.workout}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CoachScreen() {
  const coach   = useCoachChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coach.messages.length, coach.sending]);

  const handleSend = () => {
    if (!input.trim() || coach.sending) return;
    coach.sendMessage(input.trim());
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `0.5px solid ${T.border}`, background: T.white }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color={T.purpleDark} />
        </div>
        <div>
          <p style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic, serif', fontSize: 18, color: T.black, margin: 0 }}>AI Coach</p>
          <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 10, color: T.t3, margin: 0 }}>Powered by Claude</p>
        </div>
      </div>

      {/* Training Plan Accordion */}
      <TrainingPlanAccordion
        plan={coach.trainingPlan} open={coach.planOpen} onToggle={coach.togglePlanOpen}
        goalInput={coach.goalInput} onGoalChange={coach.setGoalInput}
        onGenerate={coach.generatePlan} loading={coach.planLoading}
      />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {coach.messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>🏃</span>
            </div>
            <p style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic, serif', fontSize: 20, color: T.black, marginBottom: 8 }}>Your AI Running Coach</p>
            <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 13, color: T.t3, lineHeight: 1.6, maxWidth: 280 }}>
              Ask me anything about training, nutrition, form, recovery, or race strategy.
            </p>
            {/* Quick prompts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24 }}>
              {PROMPTS.map(p => (
                <button key={p} onClick={() => { coach.sendMessage(p); }}
                  style={{ padding: '8px 14px', borderRadius: 20, border: `0.5px solid ${T.border}`, background: T.white, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 12, color: T.black, cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 8 }}>
            {coach.messages.map(m => <MessageBubble key={m.id} msg={m} />)}
            {coach.sending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
        {coach.error && (
          <p style={{ fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 12, color: T.red, textAlign: 'center', padding: '4px 16px' }}>{coach.error}</p>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderTop: `0.5px solid ${T.border}`, background: T.bg, alignItems: 'center' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask your coach..."
          style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: `0.5px solid ${T.border}`, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 14, color: T.black, background: T.white, outline: 'none' }}
        />
        <button onClick={handleSend} disabled={!input.trim() || coach.sending}
          style={{ width: 40, height: 40, borderRadius: 20, background: (input.trim() && !coach.sending) ? T.red : T.border, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (input.trim() && !coach.sending) ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}>
          <Send size={16} color={T.white} />
        </button>
      </div>
    </div>
  );
}
