import { useEffect, useState } from 'react';

interface LandingScreenProps {
  onSelectMode: (mode: 'photo' | 'agentic') => void;
}

export function LandingScreen({ onSelectMode }: LandingScreenProps) {
  const [textLines, setTextLines] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);

  const fullText = [
    '> jarvis_3d_system --init',
    '',
    'JARVIS 3D Modeling System v2.0',
    'Initializing...',
    '',
    'Select mode:',
    '',
    '  [1] Create from Photo',
    '  [2] Agentic Creation',
    '',
    '> _',
  ];

  useEffect(() => {
    let currentLine = 0;
    let currentChar = 0;

    const typeNextChar = () => {
      if (currentLine >= fullText.length) {
        setAnimationComplete(true);
        return;
      }

      const line = fullText[currentLine];

      if (currentChar <= line.length) {
        setTextLines((prev) => {
          const newLines = [...prev];
          newLines[currentLine] = line.substring(0, currentChar);
          return newLines;
        });
        currentChar++;

        const delay = currentChar === line.length + 1 ? 100 : (line[currentChar - 1] === ' ' ? 30 : 50);
        setTimeout(typeNextChar, delay);
      } else {
        currentLine++;
        currentChar = 0;
        setTextLines((prev) => [...prev, '']);
        setTimeout(typeNextChar, 200);
      }
    };

    const timer = setTimeout(typeNextChar, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!animationComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        onSelectMode('photo');
      } else if (e.key === '2') {
        onSelectMode('agentic');
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(0);
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(1);
      } else if (e.key === 'Enter') {
        onSelectMode(selectedIndex === 0 ? 'photo' : 'agentic');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [animationComplete, selectedIndex, onSelectMode]);

  const handleOptionClick = (index: number) => {
    if (!animationComplete) return;
    setSelectedIndex(index);
    setTimeout(() => {
      onSelectMode(index === 0 ? 'photo' : 'agentic');
    }, 150);
  };

  return (
    <div className="absolute inset-0 flex items-start justify-start p-8 pointer-events-auto" style={{ background: '#000' }}>
      <div
        className="w-full h-full"
        style={{
          fontFamily: "'Space Mono', monospace",
          color: '#00D4FF',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        {textLines.map((line, index) => {
          const isOption1 = index === 7;
          const isOption2 = index === 8;
          const isSelected = (isOption1 && selectedIndex === 0) || (isOption2 && selectedIndex === 1);
          const isClickable = (isOption1 || isOption2) && animationComplete;
          const isCursorLine = index === textLines.length - 1;

          return (
            <div
              key={index}
              className={isClickable ? 'cursor-pointer' : ''}
              style={{
                background: isSelected && isClickable ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                padding: isClickable ? '2px 4px' : '0',
                transition: 'background 150ms',
              }}
              onClick={() => isClickable && handleOptionClick(isOption1 ? 0 : 1)}
              onMouseEnter={() => isClickable && setSelectedIndex(isOption1 ? 0 : 1)}
            >
              {line}
              {isCursorLine && !animationComplete && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '16px',
                    background: '#00D4FF',
                    marginLeft: '2px',
                    verticalAlign: 'middle',
                    opacity: showCursor ? 1 : 0,
                  }}
                />
              )}
              {isCursorLine && animationComplete && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '16px',
                    background: '#00D4FF',
                    marginLeft: '-10px',
                    verticalAlign: 'middle',
                    opacity: showCursor ? 1 : 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
