import { motion, AnimatePresence } from 'framer-motion';
import type { Person } from '../lib/types';

interface Props {
  person: Person | null;
  personMap: Map<string, Person>;
  onClose: () => void;
}

const MALE   = '#5B8DD9';
const FEMALE = '#D4826A';
const GOLD   = '#C9A227';

function RelBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        background: 'rgba(201,162,39,0.12)',
        border: '1px solid rgba(201,162,39,0.3)',
        fontSize: 12,
        color: GOLD,
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {label}
    </span>
  );
}

function PersonChip({ person }: { person: Person }) {
  const color = person.sex === 1 ? MALE : FEMALE;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        marginBottom: 5,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: '#E8DEC8' }}>{person.name}</span>
    </div>
  );
}

export function InfoPanel({ person, personMap, onClose }: Props) {
  const isMobile   = typeof window !== 'undefined' && window.innerWidth < 640;
  const accentColor = person ? (person.sex === 1 ? MALE : FEMALE) : GOLD;

  const spouses  = person ? (person.spouses.map(id => personMap.get(id)).filter(Boolean) as Person[]) : [];
  const children = person ? (person.children.map(id => personMap.get(id)).filter(Boolean) as Person[]) : [];

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxHeight: '62vh',
        borderRadius: '18px 18px 0 0',
        borderTop: `1px solid rgba(201,162,39,0.25)`,
        borderLeft: 'none',
        overflowY: 'auto',
      }
    : {
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 320,
        borderLeft: `1px solid rgba(201,162,39,0.25)`,
        overflowY: 'auto',
      };

  const motionProps = isMobile
    ? {
        initial: { y: '100%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit:    { y: '100%', opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 340, damping: 34 },
      }
    : {
        initial: { x: 360, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit:    { x: 360, opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      };

  return (
    <AnimatePresence>
      {person && (
        <motion.div
          key={person.id}
          {...motionProps}
          style={{
            background: 'rgba(10, 6, 2, 0.96)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            padding: isMobile ? '20px 18px 32px' : '28px 24px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            ...panelStyle,
          }}
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(201,162,39,0.3)' }} />
            </div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              alignSelf: 'flex-end',
              background: 'transparent',
              border: '1px solid rgba(201,162,39,0.3)',
              color: GOLD,
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
            aria-label="Ёпиш"
          >
            ×
          </button>

          {/* Sex badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
            <span style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(201,162,39,0.7)', textTransform: 'uppercase' }}>
              {person.sex === 1 ? 'Эркак' : 'Аёл'}
            </span>
          </div>

          {/* Name */}
          <motion.h2
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.07 }}
            style={{
              margin: 0,
              fontSize: isMobile ? 22 : 26,
              fontFamily: 'Georgia, serif',
              color: '#F6F1E9',
              lineHeight: 1.25,
              borderBottom: '1px solid rgba(201,162,39,0.2)',
              paddingBottom: 14,
            }}
          >
            {person.name}
          </motion.h2>

          {/* Stats */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.11 }}
            style={{ display: 'flex', gap: 10 }}
          >
            <div style={{ textAlign: 'center', flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(201,162,39,0.08)' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: GOLD }}>{children.length}</div>
              <div style={{ fontSize: 9, color: 'rgba(201,162,39,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>фарзанд</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(201,162,39,0.08)' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: GOLD }}>{spouses.length}</div>
              <div style={{ fontSize: 9, color: 'rgba(201,162,39,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>турмуш</div>
            </div>
          </motion.div>

          {spouses.length > 0 && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
              <div style={{ marginBottom: 8 }}><RelBadge label="Турмуш ўртоғи" /></div>
              {spouses.map(s => <PersonChip key={s.id} person={s} />)}
            </motion.div>
          )}

          {children.length > 0 && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.19 }}>
              <div style={{ marginBottom: 8 }}><RelBadge label="Фарзандлар" /></div>
              {children.map(c => <PersonChip key={c.id} person={c} />)}
            </motion.div>
          )}

          {children.length === 0 && spouses.length === 0 && (
            <p style={{ color: 'rgba(201,162,39,0.4)', fontSize: 13, fontStyle: 'italic' }}>
              Маълумот йўқ
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
