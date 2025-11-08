import { useEffect, useState } from 'react';

interface TargetingReticleProps {
  x: number;
  y: number;
  visible: boolean;
}

export function TargetingReticle({ x, y, visible }: TargetingReticleProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => (p + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  const size = 40 + Math.sin(pulse) * 5;

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.1s, top 0.1s',
      }}
    >
      <svg width={size * 2} height={size * 2} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="#82D1FF"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="#82D1FF"
          strokeWidth="1"
          opacity="0.4"
          strokeDasharray="4 4"
        />
        <line x1="50" y1="10" x2="50" y2="25" stroke="#82D1FF" strokeWidth="1.5" opacity="0.8" />
        <line x1="50" y1="75" x2="50" y2="90" stroke="#82D1FF" strokeWidth="1.5" opacity="0.8" />
        <line x1="10" y1="50" x2="25" y2="50" stroke="#82D1FF" strokeWidth="1.5" opacity="0.8" />
        <line x1="75" y1="50" x2="90" y2="50" stroke="#82D1FF" strokeWidth="1.5" opacity="0.8" />
        <circle cx="50" cy="50" r="3" fill="#E0A9FF" opacity="0.8" />
      </svg>
    </div>
  );
}
