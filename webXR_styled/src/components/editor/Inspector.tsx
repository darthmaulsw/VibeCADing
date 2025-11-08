import { useState } from 'react';
import { Box, Layers, Palette } from 'lucide-react';

interface InspectorProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  onPositionChange: (pos: [number, number, number]) => void;
  onRotationChange: (rot: [number, number, number]) => void;
  onScaleChange: (scale: [number, number, number]) => void;
}

export function Inspector({
  position,
  rotation,
  scale,
  onPositionChange,
  onRotationChange,
  onScaleChange,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState('Transform');

  const tabs = [
    { name: 'Transform', icon: <Box size={14} /> },
    { name: 'Geometry', icon: <Layers size={14} /> },
    { name: 'Material', icon: <Palette size={14} /> },
  ];

  return (
    <div className="absolute right-6 top-24">
      <svg width="360" height="400" className="absolute top-0 right-0 pointer-events-none">
        <line x1="360" y1="0" x2="360" y2="400" stroke="#00D4FF" strokeWidth="1" opacity="0.2" />
        <line x1="340" y1="50" x2="360" y2="50" stroke="#00D4FF" strokeWidth="1" opacity="0.4" />
        <circle cx="340" cy="50" r="3" fill="#00D4FF" opacity="0.8" />

        <line x1="340" y1="120" x2="360" y2="120" stroke="#00D4FF" strokeWidth="1" opacity="0.4" />
        <circle cx="340" cy="120" r="3" fill="#00D4FF" opacity="0.8" />

        <line x1="340" y1="190" x2="360" y2="190" stroke="#00D4FF" strokeWidth="1" opacity="0.4" />
        <circle cx="340" cy="190" r="3" fill="#00D4FF" opacity="0.8" />
      </svg>

      <div style={{ marginRight: '30px' }}>
        <div
          className="mb-6 font-mono text-[9px] opacity-50 tracking-widest text-right"
          style={{ color: '#00D4FF' }}
        >
          OBJECT INSPECTOR
        </div>

        <div className="flex gap-4 mb-6 justify-end">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className="text-[10px] font-mono tracking-wider transition-opacity"
              style={{
                color: '#00D4FF',
                opacity: activeTab === tab.name ? 1 : 0.4,
              }}
            >
              {tab.name.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-6 text-right">
          {activeTab === 'Transform' && (
            <>
              <Vec3Field label="Position" value={position} onChange={onPositionChange} />
              <Vec3Field
                label="Rotation"
                value={rotation.map(r => (r * 180 / Math.PI)) as [number, number, number]}
                onChange={(v) => onRotationChange(v.map(d => d * Math.PI / 180) as [number, number, number])}
                suffix="°"
              />
              <Vec3Field label="Scale" value={scale} onChange={onScaleChange} step={0.1} />
            </>
          )}
          {activeTab === 'Geometry' && (
            <div className="font-mono text-xs" style={{ color: '#00D4FF' }}>
              <div className="mb-4">
                <div className="text-[10px] opacity-40 mb-1">TYPE</div>
                <div className="tracking-wider">BOX_GEOMETRY</div>
              </div>
              <div>
                <div className="text-[10px] opacity-40 mb-1">DIMENSIONS</div>
                <div className="text-xs">1.000 × 1.000 × 1.000</div>
              </div>
            </div>
          )}
          {activeTab === 'Material' && (
            <div className="font-mono text-xs" style={{ color: '#00D4FF' }}>
              <div className="mb-4">
                <div className="text-[10px] opacity-40 mb-1">SHADER</div>
                <div className="tracking-wider text-xs">STANDARD_PBR</div>
              </div>
              <div className="mb-4">
                <div className="text-[10px] opacity-40 mb-1">ALBEDO</div>
                <div className="text-xs">#8AD7FF</div>
              </div>
              <div>
                <div className="text-[10px] opacity-40 mb-1">ROUGHNESS</div>
                <div className="text-xs">0.800</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Vec3Field({
  label,
  value,
  onChange,
  suffix,
  step = 0.01,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="font-mono">
      <div className="text-[10px] opacity-40 mb-2 tracking-wider" style={{ color: '#00D4FF' }}>
        {label.toUpperCase()}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis} className="text-right">
            <div className="text-[9px] opacity-50 mb-1" style={{ color: '#00D4FF' }}>{axis}</div>
            <input
              type="number"
              value={value[i].toFixed(2)}
              onChange={(e) => {
                const newVal = [...value] as [number, number, number];
                newVal[i] = parseFloat(e.target.value) || 0;
                onChange(newVal);
              }}
              step={step}
              className="w-full px-2 py-1 text-xs font-mono text-right bg-transparent border-b"
              style={{
                borderColor: 'rgba(0, 212, 255, 0.3)',
                color: '#00D4FF',
                outline: 'none',
              }}
            />
            {suffix && <span className="text-[9px] opacity-40 ml-1">{suffix}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
