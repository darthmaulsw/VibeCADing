import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { setupScene } from '../three/sceneSetup';
import { InteractionManager } from '../three/interactions';

export function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    cleanup: () => void;
    interactionManager: InteractionManager;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { cleanup, interactionManager } = setupScene(containerRef.current);
    sceneRef.current = { cleanup, interactionManager };

    return () => {
      cleanup();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: 'default' }}
    />
  );
}
