import { motion } from 'framer-motion';

interface Props {
  totalNodes: number;
  selectedName: string | null;
}

const GOLD = '#C9A227';

export function HUD({ totalNodes, selectedName }: Props) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <>
      {/* Title bar */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '16px 28px',
          background: 'linear-gradient(to bottom, rgba(8,4,1,0.95) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        <div>
          <div
            style={{
              fontSize: isMobile ? 9 : 11,
              letterSpacing: '0.2em',
              color: 'rgba(201,162,39,0.6)',
              textTransform: 'uppercase',
              marginBottom: 3,
              fontFamily: 'Georgia, serif',
            }}
          >
            Шажара · Родословная
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 16 : 22,
              fontFamily: 'Georgia, serif',
              color: '#F6F1E9',
              fontWeight: 400,
            }}
          >
            Род Одил қори
          </h1>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? 14 : 24, alignItems: 'center' }}>
          <Stat label="нафар" value={totalNodes} isMobile={isMobile} />
          <Stat label="авлод" value={5} isMobile={isMobile} />
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 25 }}
        style={{
          position: 'fixed',
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 12 : 24,
          zIndex: 50,
          display: 'flex',
          gap: isMobile ? 10 : 16,
          alignItems: 'center',
          background: 'rgba(8,4,1,0.75)',
          border: '1px solid rgba(201,162,39,0.18)',
          padding: isMobile ? '7px 11px' : '10px 16px',
          borderRadius: 12,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      >
        <LegendItem color="#5B8DD9" label="Эркак" isMobile={isMobile} />
        <div style={{ width: 1, height: 14, background: 'rgba(201,162,39,0.2)' }} />
        <LegendItem color="#D4826A" label="Аёл" isMobile={isMobile} />
        {!isMobile && (
          <>
            <div style={{ width: 1, height: 14, background: 'rgba(201,162,39,0.2)' }} />
            <div style={{ fontSize: 10, color: 'rgba(201,162,39,0.5)' }}>
              Сурганг = ҳаракат · Ctrl+ғилдирак = яқинлаш · ↑↓ = кейинги
            </div>
          </>
        )}
      </motion.div>

      {/* Selected hint — centered bottom */}
      {selectedName && (
        <motion.div
          key={selectedName}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: isMobile ? 16 : 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(8,4,1,0.88)',
            border: `1px solid ${GOLD}44`,
            padding: isMobile ? '6px 14px' : '8px 20px',
            borderRadius: 999,
            color: GOLD,
            fontSize: isMobile ? 11 : 13,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
          }}
        >
          {selectedName} — танланди
        </motion.div>
      )}
    </>
  );
}

function Stat({ label, value, isMobile }: { label: string; value: number; isMobile: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 600, color: GOLD, lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: isMobile ? 8 : 10,
          letterSpacing: '0.12em',
          color: 'rgba(201,162,39,0.5)',
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function LegendItem({ color, label, isMobile }: { color: string; label: string; isMobile: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 5px ${color}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: isMobile ? 10 : 12, color: 'rgba(246,241,233,0.6)' }}>{label}</span>
    </div>
  );
}
