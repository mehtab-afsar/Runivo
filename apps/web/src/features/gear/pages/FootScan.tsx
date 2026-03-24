import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, RefreshCw, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '@shared/services/supabase';

export type ArchType = 'flat' | 'neutral' | 'high';

export interface FootScanResult {
  archType:           ArchType;
  confidence:         number;
  explanation:        string;
  shoeRecommendation: string;
}

const ARCH_INFO: Record<ArchType, { label: string; emoji: string }> = {
  flat:    { label: 'Flat arch',    emoji: '🦶' },
  neutral: { label: 'Neutral arch', emoji: '👟' },
  high:    { label: 'High arch',    emoji: '🏃' },
};

const T = {
  bg: '#F8F6F3', white: '#FFFFFF', black: '#0A0A0A', t3: '#6B6B6B',
  border: '#E8E4DF', purple: '#5A3A8A', purpleLo: '#F2EEF9',
  green: '#1A6B40', greenLo: '#EDF7F2', red: '#D93518',
};

type Step = 'instructions' | 'analysing' | 'result';

interface FootScanProps {
  onDone?: (result: FootScanResult) => void;
  onClose?: () => void;
}

async function analyseImage(file: File): Promise<FootScanResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/foot-scan`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  });

  if (!res.ok) throw new Error(`Scan failed (${res.status})`);
  return res.json() as Promise<FootScanResult>;
}

export default function FootScan({ onDone, onClose }: FootScanProps) {
  const [step, setStep]       = useState<Step>('instructions');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult]   = useState<FootScanResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setError(null);
    setStep('analysing');

    try {
      const scan = await analyseImage(file);
      setResult(scan);
      setStep('result');

      // Persist to profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          foot_type: scan.archType,
          foot_scan_at: new Date().toISOString(),
        }).eq('id', user.id);
      }

      onDone?.(scan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setStep('instructions');
    }
  };

  const reset = () => { setStep('instructions'); setPreview(null); setResult(null); setError(null); };
  const archInfo = result ? ARCH_INFO[result.archType] : null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: T.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: T.white, borderBottom: `0.5px solid ${T.border}` }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: T.white, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          ←
        </button>
        <span style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 16, color: T.black }}>Foot Scan</span>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 20px 80px', maxWidth: 420, margin: '0 auto' }}>
        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {step === 'instructions' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <span style={{ fontSize: 56, marginTop: 16 }}>🦶</span>
            <h2 style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 20, color: T.black, margin: 0 }}>Analyse your arch type</h2>
            <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 14, color: T.t3, lineHeight: 1.6, maxWidth: 300, margin: 0 }}>
              Place your foot flat on a light-coloured surface and take a photo from directly above. Keep the whole foot in frame.
            </p>
            {error && <p style={{ fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 13, color: T.red, margin: 0 }}>{error}</p>}
            <button onClick={() => fileRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.black, color: T.white, border: 'none', borderRadius: 12, padding: '14px 32px', fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 14, cursor: 'pointer', marginTop: 8 }}>
              <Camera size={18} />
              Open Camera / Choose Photo
            </button>
          </motion.div>
        )}

        {step === 'analysing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {preview && <img src={preview} alt="Foot" style={{ width: '100%', maxWidth: 320, aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader size={20} color={T.purple} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 14, color: T.t3 }}>Analysing with AI…</span>
            </div>
          </motion.div>
        )}

        {step === 'result' && result && archInfo && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
            {preview && <img src={preview} alt="Foot" style={{ width: '100%', maxWidth: 320, aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} />}
            <div style={{ width: '100%', background: T.greenLo, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle size={20} color={T.green} />
                <span style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 14, color: T.green }}>
                  {archInfo.emoji} {archInfo.label} · {result.confidence}% confidence
                </span>
              </div>
              <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 13, color: T.black, lineHeight: 1.6, margin: 0 }}>{result.explanation}</p>
            </div>
            <div style={{ width: '100%', background: T.purpleLo, borderRadius: 12, padding: 16 }}>
              <p style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 12, color: T.purple, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 6px' }}>Shoe recommendation</p>
              <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 13, color: T.black, lineHeight: 1.6, margin: 0 }}>{result.shoeRecommendation}</p>
            </div>
            <button onClick={reset}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '12px 24px', fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 14, color: T.black, cursor: 'pointer' }}>
              <RefreshCw size={16} /> Scan again
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
