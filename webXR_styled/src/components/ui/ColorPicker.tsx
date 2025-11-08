import { useEffect, useState } from 'react';

interface ColorPickerProps {
  isOpen: boolean;
  x: number;
  y: number;
  onSelect: (color: string) => void;
  onClose: () => void;
}

export function ColorPicker({ isOpen, x, y, onSelect, onClose }: ColorPickerProps) {
  const [animating, setAnimating] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedHue, setSelectedHue] = useState<number>(200);
  const [saturation, setSaturation] = useState(80);
  const [lightness, setLightness] = useState(60);
  const [showSliders, setShowSliders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnimating(true);
    } else {
      setShowSliders(false);
      const timer = setTimeout(() => setAnimating(false), 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRotation((r) => (r + 0.4) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const color = `hsl(${selectedHue}, ${saturation}%, ${lightness}%)`;
    onSelect(color);
  }, [selectedHue, saturation, lightness, onSelect]);

  if (!isOpen && !animating) return null;

  const radius = 140;
  const centerX = radius;
  const centerY = radius;
  const spectrumSegments = 36;

  const saturationPanelX = x - 250;
  const saturationPanelY = y - 120;
  const lightnessPanelX = x + 250;
  const lightnessPanelY = y + 120;

  const handleSpectrumClick = (hue: number) => {
    setSelectedHue(hue);
    setShowSliders(true);
  };

  return (
    <>
      <div
        className="absolute pointer-events-auto z-50"
        style={{
          left: x,
          top: y,
          width: radius * 2,
          height: radius * 2,
          transform: 'translate(-50%, -50%)',
          opacity: isOpen ? 1 : 0,
          transition: isOpen ? 'opacity 240ms linear' : 'opacity 180ms linear',
        }}
      >
        <svg
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="absolute inset-0 pointer-events-none"
        >
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
            <circle
              cx={centerX}
              cy={centerY}
              r={radius - 10}
              fill="none"
              stroke="#00D4FF"
              strokeWidth="1"
              opacity="0.3"
              strokeDasharray="5 10"
            />
          </g>

          <g style={{ transform: `rotate(${-rotation * 1.5}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
            <circle
              cx={centerX}
              cy={centerY}
              r={radius - 25}
              fill="none"
              stroke="#00D4FF"
              strokeWidth="0.5"
              opacity="0.2"
              strokeDasharray="3 6"
            />
          </g>

          {Array.from({ length: spectrumSegments }).map((_, i) => {
            const angle = (i / spectrumSegments) * 360;
            const x1 = centerX + Math.cos((angle * Math.PI) / 180) * 35;
            const y1 = centerY + Math.sin((angle * Math.PI) / 180) * 35;
            const x2 = centerX + Math.cos((angle * Math.PI) / 180) * 90;
            const y2 = centerY + Math.sin((angle * Math.PI) / 180) * 90;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#00D4FF"
                strokeWidth="0.5"
                opacity="0.15"
              />
            );
          })}
        </svg>

        <svg
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="absolute inset-0"
        >
          {Array.from({ length: spectrumSegments }).map((_, i) => {
            const hue = (i / spectrumSegments) * 360;
            const startAngle = ((i / spectrumSegments) * 360 - 90) * (Math.PI / 180);
            const endAngle = (((i + 1) / spectrumSegments) * 360 - 90) * (Math.PI / 180);
            const innerR = 62;
            const outerR = 90;

            const x1 = centerX + Math.cos(startAngle) * innerR;
            const y1 = centerY + Math.sin(startAngle) * innerR;
            const x2 = centerX + Math.cos(startAngle) * outerR;
            const y2 = centerY + Math.sin(startAngle) * outerR;
            const x3 = centerX + Math.cos(endAngle) * outerR;
            const y3 = centerY + Math.sin(endAngle) * outerR;
            const x4 = centerX + Math.cos(endAngle) * innerR;
            const y4 = centerY + Math.sin(endAngle) * innerR;

            const color = `hsl(${hue}, 80%, 60%)`;
            const isSelected = Math.abs(selectedHue - hue) < 10;

            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 0 0 ${x1} ${y1}`}
                  fill={color}
                  stroke={isSelected ? '#00D4FF' : 'rgba(130, 209, 255, 0.2)'}
                  strokeWidth={isSelected ? 2 : 0.5}
                  className="cursor-pointer transition-all"
                  style={{
                    filter: isSelected ? `drop-shadow(0 0 8px ${color})` : 'none',
                    pointerEvents: 'auto',
                  }}
                  onClick={() => handleSpectrumClick(hue)}
                />
              </g>
            );
          })}
        </svg>

        <button
          onClick={onClose}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full font-mono text-xs transition-all z-10"
          style={{
            background: `hsl(${selectedHue}, ${saturation}%, ${lightness}%)`,
            border: '2px solid rgba(130, 209, 255, 0.6)',
            color: lightness > 50 ? '#0E1224' : '#00D4FF',
            boxShadow: `0 0 20px hsl(${selectedHue}, ${saturation}%, ${lightness}%)`,
          }}
        >
          ✕
        </button>

        <div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 font-mono text-[9px] opacity-50 tracking-widest whitespace-nowrap"
          style={{ color: '#00D4FF' }}
        >
          COLOR SPECTRUM
        </div>
      </div>

      {showSliders && (
        <>
          <svg
            className="absolute inset-0 pointer-events-none z-40"
            style={{ width: '100vw', height: '100vh', left: 0, top: 0 }}
          >
            <line
              x1={x}
              y1={y}
              x2={saturationPanelX + 100}
              y2={saturationPanelY + 60}
              stroke="#00D4FF"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.4"
            />
            <circle cx={saturationPanelX + 100} cy={saturationPanelY + 60} r="3" fill="#00D4FF" opacity="0.6" />

            <line
              x1={x}
              y1={y}
              x2={lightnessPanelX + 100}
              y2={lightnessPanelY + 60}
              stroke="#00D4FF"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.4"
            />
            <circle cx={lightnessPanelX + 100} cy={lightnessPanelY + 60} r="3" fill="#00D4FF" opacity="0.6" />
          </svg>

          <div
            className="absolute pointer-events-auto z-50"
            style={{
              left: saturationPanelX,
              top: saturationPanelY,
              opacity: isOpen ? 1 : 0,
              transition: 'opacity 300ms linear 100ms',
            }}
          >
            <div
              className="p-5 font-mono"
              style={{
                background: 'rgba(14, 18, 36, 0.95)',
                border: '1px solid rgba(130, 209, 255, 0.3)',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(130, 209, 255, 0.1)',
                width: '200px',
              }}
            >
              <div className="text-[10px] tracking-widest mb-4 opacity-50" style={{ color: '#00D4FF' }}>
                SATURATION
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] opacity-50" style={{ color: '#00D4FF' }}>
                    {saturation}%
                  </span>
                </div>
                <div className="relative h-1" style={{ background: 'rgba(130, 209, 255, 0.1)' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="absolute left-0 top-0 h-full transition-all"
                    style={{
                      width: `${saturation}%`,
                      background: '#00D4FF',
                      boxShadow: '0 0 8px #00D4FF',
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all pointer-events-none"
                    style={{
                      left: `${saturation}%`,
                      transform: 'translate(-50%, -50%)',
                      background: '#00D4FF',
                      border: '1px solid rgba(14, 18, 36, 0.8)',
                      boxShadow: '0 0 8px #00D4FF',
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t" style={{ borderColor: 'rgba(130, 209, 255, 0.2)' }}>
                <div className="text-[8px] tracking-wider opacity-50 mb-2" style={{ color: '#00D4FF' }}>
                  PREVIEW
                </div>
                <div
                  className="w-full h-6 rounded"
                  style={{
                    background: `hsl(${selectedHue}, ${saturation}%, 60%)`,
                    border: '1px solid rgba(130, 209, 255, 0.3)',
                    boxShadow: `0 0 12px hsl(${selectedHue}, ${saturation}%, 60%)`,
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className="absolute pointer-events-auto z-50"
            style={{
              left: lightnessPanelX,
              top: lightnessPanelY,
              opacity: isOpen ? 1 : 0,
              transition: 'opacity 300ms linear 200ms',
            }}
          >
            <div
              className="p-5 font-mono"
              style={{
                background: 'rgba(14, 18, 36, 0.95)',
                border: '1px solid rgba(130, 209, 255, 0.3)',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(130, 209, 255, 0.1)',
                width: '200px',
              }}
            >
              <div className="text-[10px] tracking-widest mb-4 opacity-50" style={{ color: '#00D4FF' }}>
                LIGHTNESS
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] opacity-50" style={{ color: '#00D4FF' }}>
                    {lightness}%
                  </span>
                </div>
                <div className="relative h-1" style={{ background: 'rgba(130, 209, 255, 0.1)' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lightness}
                    onChange={(e) => setLightness(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="absolute left-0 top-0 h-full transition-all"
                    style={{
                      width: `${lightness}%`,
                      background: '#00D4FF',
                      boxShadow: '0 0 8px #00D4FF',
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all pointer-events-none"
                    style={{
                      left: `${lightness}%`,
                      transform: 'translate(-50%, -50%)',
                      background: '#00D4FF',
                      border: '1px solid rgba(14, 18, 36, 0.8)',
                      boxShadow: '0 0 8px #00D4FF',
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t" style={{ borderColor: 'rgba(130, 209, 255, 0.2)' }}>
                <div className="text-[8px] tracking-wider opacity-50 mb-2" style={{ color: '#00D4FF' }}>
                  PREVIEW
                </div>
                <div
                  className="w-full h-6 rounded"
                  style={{
                    background: `hsl(${selectedHue}, 80%, ${lightness}%)`,
                    border: '1px solid rgba(130, 209, 255, 0.3)',
                    boxShadow: `0 0 12px hsl(${selectedHue}, 80%, ${lightness}%)`,
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
