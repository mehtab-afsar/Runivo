import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ScanLine, Trash2, RotateCcw, CheckCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getShoes, getRuns, saveShoe, deleteShoe, type StoredShoe,
} from '@shared/services/store';

const T = {
  bg: '#EDEAE5', white: '#FFFFFF', black: '#0A0A0A',
  border: '#DDD9D4', t3: '#A39E98', red: '#D93518',
  green: '#1A6B40', greenBg: '#EDF7F2',
  amber: '#9E6800', amberBg: '#FDF6E8',
  redBg: '#FEF0EE', card: '#FFFFFF', muted: '#F0EDE8',
};

function barColor(pct: number) {
  if (pct >= 0.85) return T.red;
  if (pct >= 0.60) return T.amber;
  return T.green;
}

async function fetchShoeKmMap(): Promise<Record<string, number>> {
  const runs = await getRuns(500);
  const km: Record<string, number> = {};
  for (const run of runs) {
    if (run.shoeId) km[run.shoeId] = (km[run.shoeId] ?? 0) + run.distanceMeters / 1000;
  }
  return km;
}

async function setDefaultShoe(id: string, all: StoredShoe[]): Promise<StoredShoe[]> {
  const updated = all.map(s => ({ ...s, isDefault: s.id === id }));
  for (const s of updated) await saveShoe(s);
  return updated;
}

async function retireShoe(id: string, all: StoredShoe[]): Promise<StoredShoe[]> {
  const updated = all.map(s => s.id === id ? { ...s, isRetired: true } : s);
  const shoe = updated.find(s => s.id === id);
  if (shoe) await saveShoe(shoe);
  return updated;
}

interface ShoeCardProps {
  shoe: StoredShoe;
  kmRun: number;
  onSetDefault: () => void;
  onRetire: () => void;
  onDelete: () => void;
}

function ShoeCard({ shoe, kmRun, onSetDefault, onRetire, onDelete }: ShoeCardProps) {
  const pct = Math.min(1, kmRun / shoe.maxKm);
  const remaining = Math.max(0, shoe.maxKm - kmRun);
  const color = barColor(pct);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: T.white, borderRadius: 14, border: `0.5px solid ${T.border}`, padding: 16, opacity: shoe.isRetired ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {/* Colour swatch */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: shoe.color || '#E8E4DF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          👟
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontFamily: 'Barlow_600SemiBold, sans-serif', fontSize: 14, color: T.black }}>{shoe.nickname || `${shoe.brand} ${shoe.model}`}</span>
            {shoe.isDefault && (
              <span style={{ background: T.greenBg, borderRadius: 4, padding: '1px 6px', fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 9, color: T.green, textTransform: 'uppercase', letterSpacing: 0.5 }}>Default</span>
            )}
          </div>
          <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 11, color: T.t3, margin: '0 0 2px' }}>{shoe.brand} {shoe.model}</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 10, color: '#ADADAD', textTransform: 'uppercase' }}>{shoe.category}</span>
            {pct >= 1 && !shoe.isRetired && (
              <span style={{ background: T.redBg, borderRadius: 4, padding: '1px 5px', fontFamily: 'Barlow_500Medium, sans-serif', fontSize: 8, color: T.red, letterSpacing: 0.5 }}>REPLACE</span>
            )}
            {pct >= 0.85 && pct < 1 && !shoe.isRetired && (
              <span style={{ background: T.amberBg, borderRadius: 4, padding: '1px 5px', fontFamily: 'Barlow_500Medium, sans-serif', fontSize: 8, color: T.amber, letterSpacing: 0.5 }}>WORN</span>
            )}
          </div>
        </div>
      </div>

      {/* Mileage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 11, color: T.t3 }}>{kmRun.toFixed(0)} / {shoe.maxKm} km</span>
        <span style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 11, color: '#ADADAD' }}>{remaining.toFixed(0)} km left</span>
      </div>
      <div style={{ height: 4, background: T.muted, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>

      {shoe.isRetired && (
        <span style={{ display: 'inline-block', background: T.muted, borderRadius: 4, padding: '2px 8px', fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Retired</span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!shoe.isDefault && !shoe.isRetired && (
          <button onClick={onSetDefault} style={{ padding: '5px 12px', borderRadius: 6, background: T.muted, border: `0.5px solid ${T.border}`, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 11, color: T.t3, cursor: 'pointer' }}>
            Set default
          </button>
        )}
        {!shoe.isRetired && (
          <button onClick={onRetire} style={{ padding: '5px 12px', borderRadius: 6, background: T.muted, border: `0.5px solid ${T.border}`, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 11, color: T.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={10} /> Retire
          </button>
        )}
        <button onClick={onDelete} style={{ padding: '5px 12px', borderRadius: 6, background: T.redBg, border: `0.5px solid ${T.red}44`, fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 11, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </motion.div>
  );
}

export default function ShoeList() {
  const navigate = useNavigate();
  const [shoes, setShoes]   = useState<StoredShoe[]>([]);
  const [shoeKm, setShoeKm] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [all, km] = await Promise.all([getShoes(), fetchShoeKmMap()]);
      setShoes(all);
      setShoeKm(km);
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (id: string) => {
    const updated = await setDefaultShoe(id, shoes);
    setShoes(updated);
    showToast('Default shoe updated');
  };

  const handleRetire = async (shoe: StoredShoe) => {
    const updated = await retireShoe(shoe.id, shoes);
    setShoes(updated);
    showToast(`${shoe.brand} ${shoe.model} · ${(shoeKm[shoe.id] ?? 0).toFixed(0)}km · Well run.`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shoe?')) return;
    await deleteShoe(id);
    setShoes(prev => prev.filter(s => s.id !== id));
  };

  const active = shoes.filter(s => !s.isRetired);
  const retired = shoes.filter(s => s.isRetired);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: T.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', background: T.white, borderBottom: `0.5px solid ${T.border}` }}>
        <h1 style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic, serif', fontSize: 22, color: T.black, margin: 0 }}>Gear</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/gear/scan')}
            style={{ width: 34, height: 34, borderRadius: 8, background: '#5A3A8A', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ScanLine size={16} color="#fff" />
          </button>
          <button onClick={() => navigate('/gear/add')}
            style={{ width: 34, height: 34, borderRadius: 8, background: T.black, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={18} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <Loader size={24} color={T.red} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : active.length === 0 && retired.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 64 }}>
            <p style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic, serif', fontSize: 20, color: T.black, marginBottom: 8 }}>No shoes yet</p>
            <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 13, color: T.t3, marginBottom: 20 }}>Add your running shoes to track mileage.</p>
            <button onClick={() => navigate('/gear/add')}
              style={{ padding: '10px 20px', borderRadius: 8, background: T.black, border: 'none', fontFamily: 'Barlow_500Medium, sans-serif', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}>
              Add first shoe
            </button>
          </div>
        ) : (
          <>
            {active.map(shoe => (
              <ShoeCard key={shoe.id} shoe={shoe} kmRun={shoeKm[shoe.id] ?? 0}
                onSetDefault={() => handleSetDefault(shoe.id)}
                onRetire={() => handleRetire(shoe)}
                onDelete={() => handleDelete(shoe.id)}
              />
            ))}
            {retired.length > 0 && (
              <>
                <p style={{ fontFamily: 'Barlow_300Light, sans-serif', fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 8, paddingLeft: 4 }}>Retired</p>
                {retired.map(shoe => (
                  <ShoeCard key={shoe.id} shoe={shoe} kmRun={shoeKm[shoe.id] ?? 0}
                    onSetDefault={() => handleSetDefault(shoe.id)}
                    onRetire={() => handleRetire(shoe)}
                    onDelete={() => handleDelete(shoe.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: T.black, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 50 }}>
            <CheckCircle size={14} color="#4ADE80" />
            <span style={{ fontFamily: 'Barlow_400Regular, sans-serif', fontSize: 13, color: '#fff' }}>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
