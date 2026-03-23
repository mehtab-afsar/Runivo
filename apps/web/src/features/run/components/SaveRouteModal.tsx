import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Lock } from 'lucide-react';
import { saveSavedRoute, type StoredSavedRoute } from '@shared/services/store';
import { pushSavedRoutes } from '@shared/services/sync';
import { haptic } from '@shared/lib/haptics';

const EMOJI_OPTIONS = ['🏃', '🏁', '🌲', '🏔️', '⭐', '🔥', '🌊', '💪', '🌅', '🏙️', '🛤️', '🎯'];

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpsPoints: { lat: number; lng: number }[];
  distanceM: number;
  durationSec: number | null;
  sourceRunId: string | null;
}

export function SaveRouteModal({ isOpen, onClose, gpsPoints, distanceM, durationSec, sourceRunId }: SaveRouteModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏃');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || gpsPoints.length < 2) return;
    setSaving(true);

    const route: StoredSavedRoute = {
      id: crypto.randomUUID(),
      name: name.trim(),
      emoji,
      distanceM,
      durationSec,
      gpsPoints,
      isPublic,
      sourceRunId,
      synced: false,
      createdAt: Date.now(),
    };

    await saveSavedRoute(route);
    haptic('success');

    // Fire-and-forget sync
    pushSavedRoutes().catch(console.error);

    setSaving(false);
    setName('');
    setEmoji('🏃');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          >
            <div className="bg-white rounded-t-3xl px-5 pt-4 pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Save Route</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
              </div>

              {/* Route info */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-4">
                <div className="text-2xl">{emoji}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {(distanceM / 1000).toFixed(2)} km
                  </div>
                  {durationSec && (
                    <div className="text-[11px] text-gray-400">
                      {Math.floor(durationSec / 60)}m {durationSec % 60}s · {gpsPoints.length} points
                    </div>
                  )}
                </div>
              </div>

              {/* Name input */}
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Route name (e.g. Morning Loop)"
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm
                           text-gray-900 placeholder-gray-400 outline-none focus:border-[#E8435A]
                           focus:ring-2 focus:ring-[#F9E4E7] transition mb-4"
                autoFocus
              />

              {/* Emoji picker */}
              <div className="mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Icon</span>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(e); haptic('light'); }}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        emoji === e
                          ? 'bg-[#F9E4E7] border-2 border-[#E8435A] scale-110'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Public/Private toggle */}
              <button
                onClick={() => { setIsPublic(!isPublic); haptic('light'); }}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-gray-200 mb-5"
              >
                {isPublic ? (
                  <Globe className="w-4 h-4 text-[#E8435A]" strokeWidth={2} />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" strokeWidth={2} />
                )}
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-gray-900">
                    {isPublic ? 'Public' : 'Private'}
                  </span>
                  <span className="text-[11px] text-gray-400 block">
                    {isPublic ? 'Others can discover this route nearby' : 'Only visible to you'}
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${isPublic ? 'bg-[#E8435A]' : 'bg-gray-300'}`}>
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-sm"
                    animate={{ x: isPublic ? 16 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>

              {/* Save button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  name.trim()
                    ? 'bg-gradient-to-r from-[#E8435A] to-[#D03A4F] text-white shadow-[0_4px_16px_rgba(232,67,90,0.25)]'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {saving ? 'Saving...' : 'Save Route'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
