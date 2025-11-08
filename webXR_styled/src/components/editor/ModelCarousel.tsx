import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  thumbnail: string;
  created_at: string;
}

interface ModelCarouselProps {
  models: Model[];
  onSelectModel: (model: Model) => void;
}

export function ModelCarousel({ models, onSelectModel }: ModelCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % models.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + models.length) % models.length);
  };

  if (models.length === 0) {
    return (
      <div className="font-mono text-center" style={{ color: '#00D4FF' }}>
        <div className="text-sm tracking-wider opacity-60">
          NO PREVIOUS MODELS FOUND
        </div>
      </div>
    );
  }

  const getVisibleModels = () => {
    const visible = [];
    for (let i = -2; i <= 2; i++) {
      const index = (currentIndex + i + models.length) % models.length;
      visible.push({ model: models[index], offset: i });
    }
    return visible;
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      <div className="font-mono text-center mb-8" style={{ color: '#00D4FF' }}>
        <div className="text-xl tracking-wider mb-2">YOUR CREATIONS</div>
        <div className="text-[10px] tracking-widest opacity-60">
          SELECT A MODEL TO EDIT
        </div>
      </div>

      <div className="relative h-80 flex items-center justify-center overflow-visible">
        {getVisibleModels().map(({ model, offset }) => {
          const isCenter = offset === 0;
          const scale = isCenter ? 1 : 0.7 - Math.abs(offset) * 0.1;
          const translateX = offset * 280;
          const opacity = isCenter ? 1 : 0.4 - Math.abs(offset) * 0.1;
          const blur = isCenter ? 0 : Math.abs(offset) * 2;

          return (
            <div
              key={model.id}
              className="absolute transition-all duration-500 ease-out cursor-pointer"
              style={{
                transform: `translateX(${translateX}px) scale(${scale})`,
                opacity,
                filter: `blur(${blur}px)`,
                zIndex: isCenter ? 10 : 5 - Math.abs(offset),
                pointerEvents: isCenter ? 'auto' : 'none',
              }}
              onClick={() => isCenter && onSelectModel(model)}
            >
              <div
                className="relative overflow-hidden transition-all duration-300"
                style={{
                  width: '240px',
                  height: '240px',
                  background: 'rgba(14, 18, 36, 0.9)',
                  border: isCenter ? '2px solid rgba(130, 209, 255, 0.6)' : '1px solid rgba(130, 209, 255, 0.3)',
                  borderRadius: '12px',
                  boxShadow: isCenter
                    ? '0 0 40px rgba(130, 209, 255, 0.3)'
                    : '0 0 20px rgba(130, 209, 255, 0.1)',
                }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{ color: '#00D4FF', opacity: 0.3 }}
                >
                  3D
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 p-4 font-mono"
                  style={{
                    background: 'linear-gradient(to top, rgba(14, 18, 36, 0.95), transparent)',
                    color: '#00D4FF',
                  }}
                >
                  <div className="text-sm tracking-wider truncate">{model.name}</div>
                  <div className="text-[9px] tracking-widest opacity-60 mt-1">
                    {new Date(model.created_at).toLocaleDateString()}
                  </div>
                </div>

                {isCenter && (
                  <svg className="absolute inset-0 pointer-events-none">
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      fill="none"
                      stroke="#00D4FF"
                      strokeWidth="1"
                      strokeDasharray="8 8"
                      opacity="0.4"
                      style={{ animation: 'dash 20s linear infinite' }}
                    />
                  </svg>
                )}

                {isCenter && (
                  <>
                    {[0, 90, 180, 270].map((angle) => {
                      const size = 8;
                      const offset = 0;
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
                              x2={angle === 0 || angle === 90 ? size - 3 : 3}
                              y2={angle === 90 || angle === 180 ? size : 0}
                              stroke="#00D4FF"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={angle === 0 || angle === 90 ? size : 0}
                              y1={angle === 90 || angle === 180 ? size : 0}
                              x2={angle === 0 || angle === 90 ? size : 0}
                              y2={angle === 90 || angle === 180 ? size - 3 : 3}
                              stroke="#00D4FF"
                              strokeWidth="1.5"
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
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-8 top-1/2 -translate-y-1/2 p-3 transition-all duration-300 group"
        style={{
          background: 'rgba(14, 18, 36, 0.9)',
          border: '1px solid rgba(130, 209, 255, 0.4)',
          borderRadius: '50%',
          color: '#00D4FF',
          boxShadow: '0 0 20px rgba(130, 209, 255, 0.1)',
        }}
      >
        <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-8 top-1/2 -translate-y-1/2 p-3 transition-all duration-300 group"
        style={{
          background: 'rgba(14, 18, 36, 0.9)',
          border: '1px solid rgba(130, 209, 255, 0.4)',
          borderRadius: '50%',
          color: '#00D4FF',
          boxShadow: '0 0 20px rgba(130, 209, 255, 0.1)',
        }}
      >
        <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      <div className="flex justify-center gap-2 mt-8">
        {models.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className="transition-all duration-300"
            style={{
              width: currentIndex === index ? '32px' : '8px',
              height: '8px',
              background: currentIndex === index ? '#00D4FF' : 'rgba(130, 209, 255, 0.3)',
              borderRadius: '4px',
              boxShadow: currentIndex === index ? '0 0 8px #00D4FF' : 'none',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -160; }
        }
      `}</style>
    </div>
  );
}
