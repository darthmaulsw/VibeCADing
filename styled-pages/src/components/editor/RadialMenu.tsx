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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
      setRotation1((r) => (r + 0.5) % 360);
      setRotation2((r) => (r - 0.8) % 360);
      setRotation3((r) => (r + 0.3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen && !animating) return null;

  const innerRadius = 80;
  const outerRadius = 184;
  const segmentAngle = 360 / ITEMS.length;
  const padding = 80;
  const totalSize = (outerRadius + padding) * 2;
  const centerX = outerRadius + padding;
  const centerY = outerRadius + padding;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width: totalSize,
        height: totalSize,
        transform: 'translate(-50%, -50%)',
        opacity: isOpen ? 1 : 0,
        transition: isOpen ? 'opacity 240ms linear' : 'opacity 180ms linear',
      }}
    >
      <svg
        width={totalSize}
        height={totalSize}
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        className="absolute inset-0"
      >
        <g style={{ transform: `rotate(${rotation1}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}>
          <circle
            cx={centerX}
            cy={centerY}
            r={outerRadius + 20}
            fill="none"
            stroke="#00D4FF"
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
                fill="#00D4FF"
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
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.3"
            strokeDasharray="10 20"
          />
          {[0, 120, 240].map((angle) => {
            const x = centerX + Math.cos((angle * Math.PI) / 180) * (outerRadius + 45);
            const y = centerY + Math.sin((angle * Math.PI) / 180) * (outerRadius + 45);
            return (
              <g key={`ring2-${angle}`}>
                <circle cx={x} cy={y} r="4" fill="#00D4FF" opacity="0.5" />
                <circle cx={x} cy={y} r="6" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
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
            stroke="#00D4FF"
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
                fill="#00D4FF"
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
          stroke="#00D4FF"
          strokeWidth="0.5"
          opacity="0.2"
        />

        <circle
          cx={centerX}
          cy={centerY}
          r={outerRadius + 60}
          fill="none"
          stroke="#00D4FF"
          strokeWidth="0.5"
          opacity="0.15"
          strokeDasharray="2 4"
        />
      </svg>

      <svg
        width={totalSize}
        height={totalSize}
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        className="absolute inset-0"
      >
        {ITEMS.map((item, i) => {
          const startAngle = i * segmentAngle - 90;
          const endAngle = (i + 1) * segmentAngle - 90;
          const isHovered = hoveredIndex === i;
          return (
            <g key={item}>
              <Arc
                cx={centerX}
                cy={centerY}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                isHovered={isHovered}
                onClick={() => onSelect(item)}
                onHover={() => setHoveredIndex(i)}
                onLeave={() => setHoveredIndex(null)}
              />
              <text
                x={centerX + Math.cos((startAngle + segmentAngle / 2) * Math.PI / 180) * ((innerRadius + outerRadius) / 2)}
                y={centerY + Math.sin((startAngle + segmentAngle / 2) * Math.PI / 180) * ((innerRadius + outerRadius) / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-medium pointer-events-none transition-all"
                style={{
                  fill: isHovered ? '#FFFFFF' : '#00D4FF',
                  fontSize: isHovered ? '14px' : '12px',
                  filter: isHovered ? 'drop-shadow(0 0 4px #00D4FF)' : 'none',
                }}
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
  isHovered,
  onClick,
  onHover,
  onLeave,
}: {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  isHovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const expandAmount = isHovered ? 8 : 0;
  const actualInnerRadius = innerRadius - expandAmount;
  const actualOuterRadius = outerRadius + expandAmount;

  const x1 = cx + Math.cos(toRadians(startAngle)) * actualInnerRadius;
  const y1 = cy + Math.sin(toRadians(startAngle)) * actualInnerRadius;
  const x2 = cx + Math.cos(toRadians(startAngle)) * actualOuterRadius;
  const y2 = cy + Math.sin(toRadians(startAngle)) * actualOuterRadius;
  const x3 = cx + Math.cos(toRadians(endAngle)) * actualOuterRadius;
  const y3 = cy + Math.sin(toRadians(endAngle)) * actualOuterRadius;
  const x4 = cx + Math.cos(toRadians(endAngle)) * actualInnerRadius;
  const y4 = cy + Math.sin(toRadians(endAngle)) * actualInnerRadius;

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  const path = `
    M ${x1} ${y1}
    L ${x2} ${y2}
    A ${actualOuterRadius} ${actualOuterRadius} 0 ${largeArc} 1 ${x3} ${y3}
    L ${x4} ${y4}
    A ${actualInnerRadius} ${actualInnerRadius} 0 ${largeArc} 0 ${x1} ${y1}
  `;

  return (
    <path
      d={path}
      fill={isHovered ? 'rgba(130, 209, 255, 0.15)' : 'rgba(14, 18, 36, 0.7)'}
      stroke="#00D4FF"
      strokeWidth={isHovered ? 2.5 : 1.5}
      strokeDasharray="4 4"
      style={{
        cursor: 'pointer',
        pointerEvents: 'auto',
        transition: 'all 200ms ease-out',
        filter: isHovered ? 'drop-shadow(0 0 8px rgba(130, 209, 255, 0.6))' : 'none',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    />
  );
}
