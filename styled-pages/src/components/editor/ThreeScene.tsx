import { useEffect, useRef } from 'react';
import { setupScene } from '../../three/sceneSetup';
import { InteractionManager } from '../../three/interactions';

declare global {
  interface Window { VIBECAD_LAST_GLB_URL?: string }
}

export function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    cleanup: () => void;
    interactionManager: InteractionManager;
    loadModelFromUrl?: (url: string) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { cleanup, interactionManager, loadModelFromUrl } = setupScene(containerRef.current);
    sceneRef.current = { cleanup, interactionManager, loadModelFromUrl };

    // If there is a last URL stored globally, load it immediately
    const lastUrl = window.VIBECAD_LAST_GLB_URL;
    if (lastUrl && sceneRef.current.loadModelFromUrl) {
      sceneRef.current.loadModelFromUrl(lastUrl).catch((err) => {
        console.error('Failed to load initial GLB into scene:', err);
      });
    }

    const onLoadGlb = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url?: string } | undefined;
      const url = detail?.url;
      if (url && sceneRef.current?.loadModelFromUrl) {
        sceneRef.current.loadModelFromUrl(url).catch((err) => {
          console.error('Failed to load GLB into scene:', err);
        });
      }
    };

    window.addEventListener('vibecad:load-glb', onLoadGlb as EventListener);

    return () => {
      window.removeEventListener('vibecad:load-glb', onLoadGlb as EventListener);
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
