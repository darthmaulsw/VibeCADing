import { useEffect, useState } from 'react';

interface RadialMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onSelect: (item: string) => void;
}

const ITEMS = ['Select', 'Move', 'Rotate', 'Scale', 'Color', 'Subdivide', 'Material', 'Export'];

export function RadialMenu({ isOpen, x, y, onSelect }: RadialMenuProps) {
  const [animating, setAnimating] = useState(false);
  const [rotation1, setRotation1] = useState(0);
  const [rotation2, setRotation2] = useState(0);
  const [rotation3, setRotation3] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAnimating(true);
    } else {
      const timer = setTimeout(() => setAnimating(false), 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRotation1((r) => (r + 2) % 360);
      setRotation2((r) => (r - 3) % 360);
      setRotation3((r) => (r + 1.5) % 360);
    }, 20);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen && !animating) return null;

  const innerRadius = 80;
  const outerRadius = 184;
  const segmentAngle = 360 / ITEMS.length;
  const centerX = outerRadius;
  const centerY = outerRadius;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width: outerRadius * 2,
        height: outerRadius * 2,
        transform: 'translate(-50%, -50%)',
        opacity: isOpen ? 1 : 0,
        transition: isOpen ? 'opacity 240ms linear' : 'opacity 180ms linear',
      }}
    >
      <svg
        width={outerRadius * 2}
        height={outerRadius * 2}
        viewBox={`0 0 ${outerRadius * 2} ${outerRadius * 2}`}
        className="absolute inset-0"
      >
        <g style={{ transform: `rotate(${rotation1}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
          <circle
            cx={centerX}
            cy={centerY}
            r={outerRadius + 20}
            fill="none"
            stroke="#82D1FF"
            strokeWidth="2"
            opacity="0.4"
            strokeDasharray="15 15"
          />
          {[0, 90, 180, 270].map((angle) => {
            const x = centerX + Math.cos((angle * Math.PI) / 180) * (outerRadius + 20);
            const y = centerY + Math.sin((angle * Math.PI) / 180) * (outerRadius + 20);
            return (
              <circle
                key={`ring1-${angle}`}
                cx={x}
                cy={y}
                r="3"
                fill="#82D1FF"
                opacity="0.6"
              />
            );
          })}
        </g>

        <g style={{ transform: `rotate(${rotation2}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
          <circle
            cx={centerX}
            cy={centerY}
            r={outerRadius + 45}
            fill="none"
            stroke="#82D1FF"
            strokeWidth="1.5"
            opacity="0.3"
            strokeDasharray="10 20"
          />
          {[0, 120, 240].map((angle) => {
            const x = centerX + Math.cos((angle * Math.PI) / 180) * (outerRadius + 45);
            const y = centerY + Math.sin((angle * Math.PI) / 180) * (outerRadius + 45);
            return (
              <g key={`ring2-${angle}`}>
                <circle cx={x} cy={y} r="4" fill="#82D1FF" opacity="0.5" />
                <circle cx={x} cy={y} r="6" fill="none" stroke="#82D1FF" strokeWidth="1" opacity="0.3" />
              </g>
            );
          })}
        </g>

        <g style={{ transform: `rotate(${rotation3}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
          <circle
            cx={centerX}
            cy={centerY}
            r={outerRadius + 32}
            fill="none"
            stroke="#82D1FF"
            strokeWidth="1"
            opacity="0.35"
            strokeDasharray="5 10"
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const x = centerX + Math.cos((angle * Math.PI) / 180) * (outerRadius + 32);
            const y = centerY + Math.sin((angle * Math.PI) / 180) * (outerRadius + 32);
            return (
              <circle
                key={`ring3-${angle}`}
                cx={x}
                cy={y}
                r="2"
                fill="#82D1FF"
                opacity="0.5"
              />
            );
          })}
        </g>

        <circle
          cx={centerX}
          cy={centerY}
          r={outerRadius + 10}
          fill="none"
          stroke="#82D1FF"
          strokeWidth="0.5"
          opacity="0.2"
        />

        <circle
          cx={centerX}
          cy={centerY}
          r={outerRadius + 60}
          fill="none"
          stroke="#82D1FF"
          strokeWidth="0.5"
          opacity="0.15"
          strokeDasharray="2 4"
        />
      </svg>

      <svg
        width={outerRadius * 2}
        height={outerRadius * 2}
        viewBox={`0 0 ${outerRadius * 2} ${outerRadius * 2}`}
        className="absolute inset-0"
      >
        {ITEMS.map((item, i) => {
          const startAngle = i * segmentAngle - 90;
          const endAngle = (i + 1) * segmentAngle - 90;
          return (
            <g key={item}>
              <Arc
                cx={outerRadius}
                cy={outerRadius}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                onClick={() => onSelect(item)}
              />
              <text
                x={outerRadius + Math.cos((startAngle + segmentAngle / 2) * Math.PI / 180) * ((innerRadius + outerRadius) / 2)}
                y={outerRadius + Math.sin((startAngle + segmentAngle / 2) * Math.PI / 180) * ((innerRadius + outerRadius) / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-medium pointer-events-none"
                style={{ fill: '#82D1FF' }}
              >
                {item}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Arc({
  cx,
  cy,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  onClick,
}: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const x1 = cx + Math.cos(toRadians(startAngle)) * innerRadius;
  const y1 = cy + Math.sin(toRadians(startAngle)) * innerRadius;
  const x2 = cx + Math.cos(toRadians(startAngle)) * outerRadius;
  const y2 = cy + Math.sin(toRadians(startAngle)) * outerRadius;
  const x3 = cx + Math.cos(toRadians(endAngle)) * outerRadius;
  const y3 = cy + Math.sin(toRadians(endAngle)) * outerRadius;
  const x4 = cx + Math.cos(toRadians(endAngle)) * innerRadius;
  const y4 = cy + Math.sin(toRadians(endAngle)) * innerRadius;

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  const path = `
    M ${x1} ${y1}
    L ${x2} ${y2}
    A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}
    L ${x4} ${y4}
    A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}
  `;

  return (
    <path
      d={path}
      fill="rgba(14, 18, 36, 0.7)"
      stroke="#82D1FF"
      strokeWidth={hovered ? 2 : 1.5}
      strokeDasharray="4 4"
      style={{ cursor: 'pointer', pointerEvents: 'auto', transition: 'stroke-width 100ms' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    />
  );
}
