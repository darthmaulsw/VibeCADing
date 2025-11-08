interface CoordinateOverlayProps {
  position: [number, number, number];
}

export function CoordinateOverlay({ position }: CoordinateOverlayProps) {
  return (
    <div className="absolute top-1/2 right-6 transform -translate-y-1/2">
      <svg width="300" height="200" className="absolute top-0 right-0">
        <line x1="0" y1="40" x2="40" y2="40" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="40" cy="40" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="0" y1="100" x2="40" y2="100" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="40" cy="100" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="0" y1="160" x2="40" y2="160" stroke="#82D1FF" strokeWidth="1" opacity="0.4" />
        <circle cx="40" cy="160" r="3" fill="#82D1FF" opacity="0.8" />

        <line x1="40" y1="40" x2="40" y2="160" stroke="#82D1FF" strokeWidth="1" opacity="0.2" strokeDasharray="2 2" />
      </svg>

      <div className="font-mono text-xs" style={{ color: '#82D1FF', marginLeft: '50px' }}>
        <div className="flex items-baseline gap-3 mb-14">
          <span className="opacity-60 w-3">X</span>
          <span className="text-base font-light tracking-wider">{position[0].toFixed(3)}</span>
          <span className="text-[9px] opacity-40">m</span>
        </div>
        <div className="flex items-baseline gap-3 mb-14">
          <span className="opacity-60 w-3">Y</span>
          <span className="text-base font-light tracking-wider">{position[1].toFixed(3)}</span>
          <span className="text-[9px] opacity-40">m</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="opacity-60 w-3">Z</span>
          <span className="text-base font-light tracking-wider">{position[2].toFixed(3)}</span>
          <span className="text-[9px] opacity-40">m</span>
        </div>
      </div>

      <div
        className="text-[9px] opacity-50 font-mono tracking-widest mt-4"
        style={{ color: '#82D1FF', marginLeft: '50px' }}
      >
        GLOBAL COORDINATES
      </div>
    </div>
  );
}
