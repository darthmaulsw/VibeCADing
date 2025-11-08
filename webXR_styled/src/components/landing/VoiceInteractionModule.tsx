import { useEffect, useState } from 'react';

interface Model {
  id: string;
  name: string;
  thumbnail: string;
  created_at: string;
}

interface VoiceInteractionModuleProps {
  onComplete: (action: 'new' | 'edit', model?: Model) => void;
  models?: Model[];
}

export function VoiceInteractionModule({ onComplete, models = [] }: VoiceInteractionModuleProps) {
  const [phase, setPhase] = useState<'greeting' | 'elevated' | 'question'>('greeting');
  const [pulseScale, setPulseScale] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const greetingTimer = setTimeout(() => setPhase('elevated'), 3000);
    const questionTimer = setTimeout(() => setPhase('question'), 4000);

    return () => {
      clearTimeout(greetingTimer);
      clearTimeout(questionTimer);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale(s => s === 1 ? 1.1 : 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % models.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + models.length) % models.length);
  };

  const getVisibleModels = () => {
    if (models.length === 0) return [];
    const visible = [];
    for (let i = -1; i <= 1; i++) {
      const index = (currentIndex + i + models.length) % models.length;
      visible.push({ model: models[index], offset: i });
    }
    return visible;
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto" style={{ background: '#000' }}>
      <div
        className="transition-all duration-1000 ease-out mb-16"
        style={{
          transform: phase === 'greeting' ? 'translateY(0)' : 'translateY(-120px) scale(0.6)',
          opacity: phase === 'question' ? 0.8 : 1,
        }}
      >
        <div className="flex flex-col items-center">
          <div
            className="relative mb-8"
            style={{
              width: '200px',
              height: '200px',
            }}
          >
            <svg className="absolute inset-0" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.2"
              />
              <circle
                cx="100"
                cy="100"
                r="60"
                fill="none"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.3"
                strokeDasharray="5 5"
                style={{ animation: 'spin 4s linear infinite' }}
              />
              <circle
                cx="100"
                cy="100"
                r="40"
                fill="rgba(0, 212, 255, 0.1)"
                stroke="#00D4FF"
                strokeWidth="2"
                style={{
                  transform: `scale(${pulseScale})`,
                  transformOrigin: 'center',
                  transition: 'transform 1s ease-in-out',
                }}
              />
              <circle
                cx="100"
                cy="100"
                r="8"
                fill="#00D4FF"
                style={{
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            </svg>

            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
              const x = 100 + Math.cos((angle * Math.PI) / 180) * 90;
              const y = 100 + Math.sin((angle * Math.PI) / 180) * 90;
              return (
                <svg key={angle} className="absolute inset-0" viewBox="0 0 200 200">
                  <line
                    x1="100"
                    y1="100"
                    x2={x}
                    y2={y}
                    stroke="#00D4FF"
                    strokeWidth="0.5"
                    opacity="0.2"
                  />
                </svg>
              );
            })}
          </div>

          <div
            className="font-mono text-center"
            style={{
              color: '#00D4FF',
            }}
          >
            <div className="text-2xl tracking-wider mb-3">
              {'>'} voice_system_active
            </div>
            <div className="text-xs tracking-widest opacity-60">
              [INITIALIZING AGENTIC INTERFACE]
            </div>
          </div>
        </div>
      </div>

      <div
        className="transition-all duration-1000 ease-out"
        style={{
          opacity: phase === 'question' ? 1 : 0,
          transform: phase === 'question' ? 'translateY(0)' : 'translateY(40px)',
          pointerEvents: phase === 'question' ? 'auto' : 'none',
        }}
      >
        <div className="font-mono text-center mb-8" style={{ color: '#00D4FF' }}>
          <div className="text-xl tracking-wider mb-2">
            {'>'} what_would_you_like_to_do
          </div>
        </div>

        {models.length > 0 ? (
          <div className="relative flex items-center justify-center gap-4">
            {getVisibleModels().map(({ model, offset }) => {
              const isCenter = offset === 0;
              const scale = isCenter ? 1 : 0.7;
              const translateX = offset * 200;
              const opacity = isCenter ? 1 : 0.4;

              return (
                <div
                  key={model.id}
                  className="transition-all duration-500 ease-out cursor-pointer"
                  style={{
                    transform: `translateX(${translateX}px) scale(${scale})`,
                    opacity,
                    position: offset === 0 ? 'relative' : 'absolute',
                    left: offset !== 0 ? '50%' : 'auto',
                    marginLeft: offset !== 0 ? '-90px' : '0',
                    pointerEvents: isCenter ? 'auto' : 'none',
                  }}
                  onClick={() => isCenter && onComplete('edit', model)}
                >
                  <div
                    className="relative overflow-hidden transition-all duration-300"
                    style={{
                      width: '180px',
                      height: '180px',
                      background: '#000',
                      border: isCenter ? '2px solid #00D4FF' : '1px solid #00D4FF',
                    }}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center font-mono text-4xl"
                      style={{ color: '#00D4FF', opacity: 0.3 }}
                    >
                      3D
                    </div>

                    <div
                      className="absolute bottom-0 left-0 right-0 p-3 font-mono"
                      style={{
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: '#00D4FF',
                      }}
                    >
                      <div className="text-xs tracking-wider truncate">{model.name}</div>
                      <div className="text-[8px] tracking-widest opacity-60 mt-1">
                        {new Date(model.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {isCenter && (
                      <>
                        {[0, 90, 180, 270].map((angle) => {
                          const size = 12;
                          let x = '0%';
                          let y = '0%';
                          let transform = '';

                          if (angle === 0) {
                            x = '100%';
                            y = '0%';
                            transform = 'translate(-100%, 0)';
                          } else if (angle === 90) {
                            x = '100%';
                            y = '100%';
                            transform = 'translate(-100%, -100%)';
                          } else if (angle === 180) {
                            x = '0%';
                            y = '100%';
                            transform = 'translate(0, -100%)';
                          } else {
                            x = '0%';
                            y = '0%';
                          }

                          return (
                            <div
                              key={angle}
                              className="absolute"
                              style={{
                                left: x,
                                top: y,
                                width: `${size}px`,
                                height: `${size}px`,
                                transform,
                              }}
                            >
                              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                                <line
                                  x1={angle === 0 || angle === 90 ? size : 0}
                                  y1={angle === 90 || angle === 180 ? size : 0}
                                  x2={angle === 0 || angle === 90 ? size - 4 : 4}
                                  y2={angle === 90 || angle === 180 ? size : 0}
                                  stroke="#00D4FF"
                                  strokeWidth="2"
                                />
                                <line
                                  x1={angle === 0 || angle === 90 ? size : 0}
                                  y1={angle === 90 || angle === 180 ? size : 0}
                                  x2={angle === 0 || angle === 90 ? size : 0}
                                  y2={angle === 90 || angle === 180 ? size - 4 : 4}
                                  stroke="#00D4FF"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {models.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-0 -translate-x-12 p-2 transition-all duration-300"
                  style={{
                    background: '#000',
                    border: '1px solid #00D4FF',
                    color: '#00D4FF',
                    zIndex: 20,
                  }}
                >
                  {'<'}
                </button>

                <button
                  onClick={nextSlide}
                  className="absolute right-0 translate-x-12 p-2 transition-all duration-300"
                  style={{
                    background: '#000',
                    border: '1px solid #00D4FF',
                    color: '#00D4FF',
                    zIndex: 20,
                  }}
                >
                  {'>'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="font-mono text-center" style={{ color: '#00D4FF' }}>
            <div className="text-sm tracking-wider opacity-60">
              [NO PREVIOUS MODELS FOUND]
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
