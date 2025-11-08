interface StatusHUDProps {
  mode: string;
  snapAngle: number;
  gridEnabled: boolean;
}

export function StatusHUD({ mode, snapAngle, gridEnabled }: StatusHUDProps) {
  const items = [
    { label: 'MODE', value: mode.toUpperCase() },
    { label: 'SNAP', value: `${snapAngle}°` },
    { label: 'GRID', value: gridEnabled ? 'ACTIVE' : 'OFF' },
  ];

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 pointer-events-none">
      <svg width="400" height="60" className="absolute top-0 left-1/2 transform -translate-x-1/2">
        {items.map((_, idx) => (
          <g key={idx}>
            <line
              x1={40 + idx * 120}
              y1="0"
              x2={40 + idx * 120}
              y2="20"
              stroke="#82D1FF"
              strokeWidth="1"
              opacity="0.4"
            />
            <circle cx={40 + idx * 120} cy="20" r="2" fill="#82D1FF" opacity="0.8" />
          </g>
        ))}
        <line x1="40" y1="20" x2="280" y2="20" stroke="#82D1FF" strokeWidth="1" opacity="0.2" strokeDasharray="2 2" />
      </svg>

      <div className="flex gap-8 justify-center mt-7 font-mono text-xs" style={{ color: '#82D1FF' }}>
        {items.map((item, idx) => (
          <div key={idx} className="text-center">
            <div className="text-[9px] opacity-40 mb-1">{item.label}</div>
            <div className="tracking-wider">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
