import { useEffect, useState } from 'react';

export function VoiceBot() {
  const [pulseScale, setPulseScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isListening] = useState(true);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseScale((prev) => {
        const newScale = prev + 0.05;
        return newScale > 1.3 ? 1 : newScale;
      });
    }, 50);

    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    const rotateInterval = setInterval(() => {
      setRotation((r) => (r + 1) % 360);
    }, 30);

    return () => clearInterval(rotateInterval);
  }, []);

  return (
    <div className="absolute bottom-32 left-6">
      <svg width="120" height="120" className="absolute bottom-0 left-0">
        <circle cx="60" cy="60" r="2" fill="#00D4FF" opacity="0.8" />
        <line x1="60" y1="60" x2="60" y2="0" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
        <line x1="60" y1="60" x2="0" y2="60" stroke="#00D4FF" strokeWidth="1" opacity="0.3" />
      </svg>

      <div className="relative w-20 h-20 ml-5 mb-5">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          className="absolute inset-0"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
          }}
        >
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="1"
            opacity="0.2"
            strokeDasharray="4 4"
          />
          <circle
            cx="40"
            cy="40"
            r="28"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="1"
            opacity="0.3"
          />
          <circle
            cx="40"
            cy="40"
            r="20"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="1.5"
            opacity="0.5"
          />

          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="40"
              y1="40"
              x2={40 + Math.cos((angle * Math.PI) / 180) * 35}
              y2={40 + Math.sin((angle * Math.PI) / 180) * 35}
              stroke="#00D4FF"
              strokeWidth="0.5"
              opacity="0.2"
            />
          ))}
        </svg>

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `scale(${pulseScale})`,
            transition: 'transform 50ms linear',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="15" fill="rgba(130, 209, 255, 0.2)" />
            <circle
              cx="20"
              cy="20"
              r="12"
              fill="none"
              stroke="#00D4FF"
              strokeWidth="2"
              opacity="0.6"
            />
            <circle cx="20" cy="20" r="6" fill="#00D4FF" opacity="0.8" />
          </svg>
        </div>

        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          className="absolute inset-0"
          style={{
            transform: `rotate(${-rotation * 1.5}deg)`,
            transformOrigin: 'center',
          }}
        >
          {[0, 120, 240].map((angle) => {
            const x = 40 + Math.cos((angle * Math.PI) / 180) * 30;
            const y = 40 + Math.sin((angle * Math.PI) / 180) * 30;
            return (
              <circle
                key={angle}
                cx={x}
                cy={y}
                r="2"
                fill="#00D4FF"
                opacity="0.6"
              />
            );
          })}
        </svg>
      </div>

      <div
        className="font-mono text-[9px] opacity-50 tracking-widest text-center mt-2"
        style={{ color: '#00D4FF' }}
      >
        {isListening ? 'VOICE INTERFACE' : 'STANDBY'}
      </div>

      <div className="flex items-center justify-center gap-1 mt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: isListening ? `${8 + Math.sin(Date.now() / 100 + i) * 4}px` : '4px',
              background: '#00D4FF',
              opacity: 0.6,
              transition: 'height 100ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}
