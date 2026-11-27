'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const LINKS = [
  ['/#how', 'How it works'],
  ['/partners', 'Partners'],
  ['/support', 'Support'],
] as const;

/** The nav links on phones (the inline links are hidden under 720px). */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after navigating, and on Escape.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}
      >
        {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
      {open && (
        <div id="mobile-menu" className="menu-panel">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="menu-link" onClick={() => setOpen(false)}>{label}</Link>
          ))}
        </div>
      )}
    </>
  );
}
