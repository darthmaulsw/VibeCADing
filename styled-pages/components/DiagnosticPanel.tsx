import { useEffect, useState } from 'react';

export function DiagnosticPanel() {
  const [fps, setFps] = useState(60);
  const [cpu, setCpu] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(58 + Math.random() * 4);
      setCpu(15 + Math.random() * 25);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-6 right-6">
      <svg width="280" height="150" className="absolute bottom-0 right-0">
        <line x1="280" y1="30" x2="240" y2="30" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="240" cy="30" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="280" y1="70" x2="240" y2="70" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="240" cy="70" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="280" y1="110" x2="240" y2="110" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="240" cy="110" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="240" y1="30" x2="240" y2="110" stroke="#82D1FF" strokeWidth="1" opacity="0.2" strokeDasharray="2 2" />
      </svg>

      <div className="font-mono text-xs" style={{ color: '#82D1FF', marginRight: '50px', textAlign: 'right' }}>
        <div className="flex items-baseline justify-end gap-3 mb-9">
          <span className="text-[9px] opacity-40">FPS</span>
          <span className="text-base font-light tracking-wider">{fps.toFixed(1)}</span>
        </div>
        <div className="flex items-baseline justify-end gap-3 mb-9">
          <span className="text-[9px] opacity-40">CPU</span>
          <span className="text-base font-light tracking-wider">{cpu.toFixed(1)}%</span>
        </div>
        <div className="flex items-baseline justify-end gap-3">
          <span className="text-[9px] opacity-40">MODE</span>
          <span className="text-xs font-light tracking-wider">REALTIME</span>
        </div>
      </div>

      <div
        className="text-[9px] opacity-50 font-mono tracking-widest mt-4 text-right"
        style={{ color: '#82D1FF', marginRight: '50px' }}
      >
        SYSTEM DIAGNOSTICS
      </div>
    </div>
  );
}
