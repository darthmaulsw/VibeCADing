import { useEffect, useState } from 'react';

interface DataLine {
  id: number;
  text: string;
  opacity: number;
}

export function DataStream() {
  const [lines, setLines] = useState<DataLine[]>([]);

  useEffect(() => {
    const messages = [
      'ANALYZING GEOMETRY...',
      'VERTICES: 8 | EDGES: 12 | FACES: 6',
      'MATERIAL PROPERTIES NOMINAL',
      'TRANSFORM MATRIX UPDATED',
      'COLLISION MESH OPTIMIZED',
      'SPATIAL COORDINATES LOCKED',
      'RENDER PIPELINE ACTIVE',
      'PHYSICS ENGINE STABLE',
    ];

    const interval = setInterval(() => {
      const newLine: DataLine = {
        id: Date.now(),
        text: messages[Math.floor(Math.random() * messages.length)],
        opacity: 1,
      };

      setLines((prev) => {
        const updated = [newLine, ...prev.slice(0, 4)];
        return updated.map((line, idx) => ({
          ...line,
          opacity: Math.max(0, 1 - idx * 0.25),
        }));
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-32 left-6">
      <svg width="400" height="180" className="absolute top-0 left-0 pointer-events-none">
        {lines.map((line, idx) => (
          <g key={`line-${idx}`} opacity={line.opacity * 0.6}>
            <line
              x1="0"
              y1={20 + idx * 35}
              x2="20"
              y2={20 + idx * 35}
              stroke="#00D4FF"
              strokeWidth="1"
            />
            <circle cx="20" cy={20 + idx * 35} r="2" fill="#00D4FF" />
          </g>
        ))}
      </svg>

      <div className="font-mono text-xs" style={{ color: '#00D4FF', marginLeft: '30px' }}>
        {lines.map((line) => (
          <div
            key={line.id}
            className="mb-6 transition-opacity duration-300"
            style={{
              opacity: line.opacity,
            }}
          >
            <div className="text-[10px] tracking-wider">{line.text}</div>
          </div>
        ))}
      </div>

      <div
        className="text-[9px] opacity-50 font-mono tracking-widest mt-4"
        style={{ color: '#00D4FF', marginLeft: '30px' }}
      >
        DATA STREAM
      </div>
    </div>
  );
}
