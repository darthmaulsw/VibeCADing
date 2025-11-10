import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { supabase } from '../../lib/supabase';

interface LandingScreenProps {
  onSelectMode: (mode: 'photo' | 'agentic') => void;
}

export function LandingScreen({ onSelectMode }: LandingScreenProps) {
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<'welcome' | 'init' | 'menu' | 'login' | 'signup' | 'authenticated'>('welcome');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputMode, setInputMode] = useState<'username' | 'password' | 'none'>('none');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showVimWindow, setShowVimWindow] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const initializedRef = useRef(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const userId = localStorage.getItem('3d_system_user_id');
    const storedUsername = localStorage.getItem('3d_system_username');

    const fullWelcome = userId && storedUsername
      ? `Welcome back, ${storedUsername}`
      : 'Welcome to Suzanne';

    let currentIndex = 0;
    const typeWelcome = () => {
      if (currentIndex < fullWelcome.length) {
        setWelcomeText(fullWelcome.substring(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeWelcome, 50);
      } else {
        setTimeout(() => {
          setShowVimWindow(true);
          setTimeout(() => {
            if (userId && storedUsername) {
              typeLines([
                '~  3D System - Session Restored',
                '~',
                `~  User: ${storedUsername}`,
                '~',
                '~  [1] Create from Photo',
                '~  [2] Agentic Creation',
                '~  [3] Logout',
                '~',
              ], () => setMode('authenticated'));
            } else {
              typeLines([
                '~  3D Modeling System v2.0',
                '~',
                '~  [1] Login',
                '~  [2] Sign Up',
                '~',
              ], () => setMode('menu'));
            }
          }, 300);
        }, 800);
      }
    };

    typeWelcome();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (overlayContainerRef.current) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '0';
    overlay.style.background = 'transparent';
    document.body.prepend(overlay);
    overlayContainerRef.current = overlay;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.background = 'transparent';
    renderer.domElement.style.zIndex = '0';
    overlay.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const tint = document.createElement('div');
    tint.style.position = 'absolute';
    tint.style.top = '0';
    tint.style.left = '0';
    tint.style.width = '100%';
    tint.style.height = '100%';
    tint.style.background = 'rgba(10, 14, 28, 0.68)';
    tint.style.pointerEvents = 'none';
    tint.style.zIndex = '1';
    overlay.appendChild(tint);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const keyLight = new THREE.DirectionalLight(0x7fb5ff, 0.9);
    keyLight.position.set(5, 6, 6);
    const rimLight = new THREE.DirectionalLight(0xff8bb4, 0.5);
    rimLight.position.set(-4, -3, -6);
    scene.add(ambient, keyLight, rimLight);

    const loader = new GLTFLoader();
    loader.load(
      '/suzanne.glb',
      (gltf) => {
        const mesh = gltf.scene.clone(true);
        mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const childMesh = child as THREE.Mesh;
            childMesh.castShadow = false;
            childMesh.receiveShadow = false;
            if (Array.isArray(childMesh.material)) {
              childMesh.material.forEach((mat) => {
                if ((mat as THREE.MeshStandardMaterial).metalness !== undefined) {
                  const std = mat as THREE.MeshStandardMaterial;
                  std.metalness = 0.2;
                  std.roughness = 0.35;
                  std.emissive = new THREE.Color(0x1a2540);
                  std.emissiveIntensity = 0.2;
                }
              });
            } else if ((childMesh.material as THREE.MeshStandardMaterial).metalness !== undefined) {
              const std = childMesh.material as THREE.MeshStandardMaterial;
              std.metalness = 0.2;
              std.roughness = 0.35;
              std.emissive = new THREE.Color(0x1a2540);
              std.emissiveIntensity = 0.2;
            }
          }
        });
        mesh.scale.setScalar(2.6);
        mesh.position.set(0, -0.05, 0);
        scene.add(mesh);
        modelRef.current = mesh;
        console.info('[Suzanne Overlay] GLB loaded');
      },
      undefined,
      () => {
        const fallback = new THREE.Mesh(
          new THREE.SphereGeometry(2.7, 48, 48),
          new THREE.MeshNormalMaterial({ flatShading: true })
        );
        fallback.position.set(0, -0.3, 0);
        scene.add(fallback);
        modelRef.current = fallback;
        console.warn('[Suzanne Overlay] GLB load failed; using fallback sphere');
      }
    );

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.0025;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      console.info('[Suzanne Overlay] Resize', width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (modelRef.current) {
        modelRef.current.traverse?.((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const meshChild = child as THREE.Mesh;
            meshChild.geometry.dispose();
            if (Array.isArray(meshChild.material)) {
              meshChild.material.forEach((mat) => mat.dispose());
            } else {
              meshChild.material.dispose();
            }
          }
        });
        modelRef.current = null;
      }
      cameraRef.current = null;
      sceneRef.current = null;
      if (overlayContainerRef.current) {
        overlayContainerRef.current.remove();
        overlayContainerRef.current = null;
      }
    };
  }, []);
  const typeLines = (lines: string[], callback?: () => void) => {
    setIsTyping(true);
    let lineIndex = 0;
    let charIndex = 0;

    const typeNextChar = () => {
      if (lineIndex >= lines.length) {
        setIsTyping(false);
        if (callback) callback();
        return;
      }

      const line = lines[lineIndex];

      if (charIndex < line.length) {
        setCurrentLine(line.substring(0, charIndex + 1));
        charIndex++;
        typingTimeoutRef.current = setTimeout(typeNextChar, line[charIndex - 1] === ' ' ? 15 : 25);
      } else {
        setCurrentLine('');
        setTerminalLines(prev => [...prev, line]);
        lineIndex++;
        charIndex = 0;
        typingTimeoutRef.current = setTimeout(typeNextChar, 50);
      }
    };

    typeNextChar();
  };

  const addLine = (line: string) => {
    setTerminalLines(prev => [...prev, line]);
  };

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleAuth = async () => {
    if (!inputUsername || !inputPassword) return;

    addLine(`Username: ${inputUsername}`);
    addLine(`Password: ${'*'.repeat(inputPassword.length)}`);
    addLine('');

    if (mode === 'login') {
      addLine('-- AUTHENTICATING --');
    } else {
      addLine('-- CREATING ACCOUNT --');
    }

    setInputMode('none');

    try {
      const hashedPassword = await hashPassword(inputPassword);

      if (mode === 'login') {
        const { data, error: queryError } = await supabase
          .from('users')
          .select('id, username, password')
          .eq('username', inputUsername)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!data) {
          addLine('E: Invalid username or password');
          addLine('');
          setInputUsername('');
          setInputPassword('');
          setInputMode('username');
          return;
        }

        const passwordMatch = data.password === hashedPassword || data.password === inputPassword;
        if (!passwordMatch) {
          addLine('E: Invalid username or password');
          addLine('');
          setInputUsername('');
          setInputPassword('');
          setInputMode('username');
          return;
        }

        localStorage.setItem('3d_system_user_id', data.id);
        localStorage.setItem('3d_system_username', data.username);

        typeLines([
          '-- LOGIN SUCCESSFUL --',
          '',
          `~  Welcome, ${data.username}`,
          '~',
          '~  [1] Create from Photo',
          '~  [2] Agentic Creation',
          '~  [3] Logout',
          '~',
        ], () => setMode('authenticated'));

      } else if (mode === 'signup') {
        const { data: existing } = await supabase
          .from('users')
          .select('username')
          .eq('username', inputUsername)
          .maybeSingle();

        if (existing) {
          addLine('E: Username already exists');
          addLine('');
          setInputUsername('');
          setInputPassword('');
          setInputMode('username');
          return;
        }

        const { data, error: insertError } = await supabase
          .from('users')
          .insert([{ username: inputUsername, password: hashedPassword }])
          .select('id, username')
          .single();

        if (insertError) throw insertError;

        localStorage.setItem('3d_system_user_id', data.id);
        localStorage.setItem('3d_system_username', data.username);

        typeLines([
          '-- ACCOUNT CREATED --',
          '',
          `~  Welcome, ${data.username}`,
          '~',
          '~  [1] Create from Photo',
          '~  [2] Agentic Creation',
          '~  [3] Logout',
          '~',
        ], () => setMode('authenticated'));
      }

      setInputUsername('');
      setInputPassword('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      addLine(`E: ${errorMessage}`);
      addLine('');
      setInputUsername('');
      setInputPassword('');
      setInputMode('username');
    }
  };

  const handleAuthRef = useRef(handleAuth);
  handleAuthRef.current = handleAuth;

  const startLogin = () => {
    setMode('login');
    setInputMode('username');
  };

  const startSignup = () => {
    setMode('signup');
    setInputMode('username');
  };

  // Focus inputs when switching modes
  useEffect(() => {
    if (inputMode === 'username' && usernameInputRef.current) {
      setTimeout(() => usernameInputRef.current?.focus(), 100);
    } else if (inputMode === 'password' && passwordInputRef.current) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [inputMode]);

  useEffect(() => {
    if (isTyping) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip keyboard handling if an input is focused (let the input handle it)
      if (inputMode !== 'none' && (e.target instanceof HTMLInputElement)) {
        return;
      }

      if (mode === 'menu') {
        if (e.key === '1') {
          setSelectedIndex(0);
          startLogin();
        } else if (e.key === '2') {
          setSelectedIndex(1);
          startSignup();
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex(0);
        } else if (e.key === 'ArrowDown') {
          setSelectedIndex(1);
        } else if (e.key === 'Enter') {
          if (selectedIndex === 0) startLogin();
          else startSignup();
        }
      } else if (mode === 'authenticated') {
        if (e.key === '1') {
          onSelectMode('photo');
        } else if (e.key === '2') {
          onSelectMode('agentic');
        } else if (e.key === '3') {
          handleLogoutRef.current?.();
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowDown') {
          setSelectedIndex(prev => Math.min(2, prev + 1));
        } else if (e.key === 'Enter') {
          if (selectedIndex === 0) onSelectMode('photo');
          else if (selectedIndex === 1) onSelectMode('agentic');
          else if (selectedIndex === 2) handleLogoutRef.current?.();
        }
      } else if (mode === 'login' || mode === 'signup') {
        if (inputMode === 'username') {
          if (e.key === 'Enter') {
            if (inputUsername.length > 0) {
              setInputMode('password');
            }
          } else if (e.key === 'Backspace') {
            setInputUsername(prev => prev.slice(0, -1));
          } else if (e.key.length === 1 && /^[a-zA-Z0-9_]$/.test(e.key)) {
            setInputUsername(prev => prev + e.key);
          }
        } else if (inputMode === 'password') {
          if (e.key === 'Enter') {
            if (inputPassword.length > 0) {
              handleAuthRef.current?.();
            }
          } else if (e.key === 'Backspace') {
            setInputPassword(prev => prev.slice(0, -1));
          } else if (e.key.length === 1) {
            setInputPassword(prev => prev + e.key);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, inputMode, inputUsername, inputPassword, selectedIndex, isTyping, onSelectMode]);

  const getOptionLines = () => {
    if (mode === 'menu') {
      const lines = terminalLines;
      const loginIndex = lines.findIndex(l => l.includes('[1] Login'));
      const signupIndex = lines.findIndex(l => l.includes('[2] Sign Up'));
      return [loginIndex, signupIndex];
    } else if (mode === 'authenticated') {
      const lines = terminalLines;
      const photoIndex = lines.findIndex(l => l.includes('[1] Create from Photo'));
      const agenticIndex = lines.findIndex(l => l.includes('[2] Agentic Creation'));
      const logoutIndex = lines.findIndex(l => l.includes('[3] Logout'));
      return [photoIndex, agenticIndex, logoutIndex];
    }
    return [];
  };

  const handleLogout = () => {
    localStorage.removeItem('3d_system_user_id');
    localStorage.removeItem('3d_system_username');
    setTerminalLines([]);
    setCurrentLine('');
    setSelectedIndex(0);
    typeLines([
      '~  3D Modeling System v2.0',
      '~',
      '~  [1] Login',
      '~  [2] Sign Up',
      '~',
    ], () => setMode('menu'));
  };

  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;

  const handleLineClick = (index: number) => {
    if (isTyping) return;

    const optionLines = getOptionLines();
    if (optionLines[0] === index) {
      setSelectedIndex(0);
      if (mode === 'menu') startLogin();
      else if (mode === 'authenticated') onSelectMode('photo');
    } else if (optionLines[1] === index) {
      setSelectedIndex(1);
      if (mode === 'menu') startSignup();
      else if (mode === 'authenticated') onSelectMode('agentic');
    } else if (optionLines[2] === index) {
      setSelectedIndex(2);
      if (mode === 'authenticated') handleLogoutRef.current?.();
    }
  };

  const getLineColor = (line: string) => {
    if (line.startsWith('~')) return '#4A90E2';
    if (line.startsWith('E:')) return '#FF6B6B';
    if (line.startsWith('--')) return '#50FA7B';
    if (line.includes('[1]') || line.includes('[2]') || line.includes('[3]')) return '#FFD700';
    if (line.startsWith('Username:') || line.startsWith('Password:')) return '#BD93F9';
    return '#F8F8F2';
  };

  const shouldHighlight = (line: string) => {
    return line.includes('[1]') || line.includes('[2]') || line.includes('[3]');
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        background: 'transparent',
        fontFamily: "'Space Mono', monospace",
        zIndex: 2147483647,
        isolation: 'isolate',
      }}
    >
      {mode === 'welcome' && (
        <div
          style={{
            fontSize: '32px',
            color: '#4A90E2',
            textAlign: 'center',
            fontWeight: '600',
            letterSpacing: '0.05em',
          }}
        >
          {welcomeText}
          <span
            style={{
              display: 'inline-block',
              width: '3px',
              height: '32px',
              background: '#50FA7B',
              marginLeft: '4px',
              verticalAlign: 'middle',
              opacity: showCursor ? 0.8 : 0,
            }}
          />
        </div>
      )}

      {showVimWindow && (
        <div
          className="flex flex-col pointer-events-auto"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: showVimWindow ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.9)',
            width: '90%',
            maxWidth: '800px',
            height: '80%',
          maxHeight: '600px',
            opacity: showVimWindow ? 1 : 0,
            transition: 'all 0.3s ease-out',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(130, 209, 255, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'rgba(8, 12, 24, 0.92)',
          zIndex: 2147483647,
          }}
        >
          <div
            className="w-full px-2 py-1 flex items-center justify-between"
            style={{
              background: '#1A1A1A',
              borderBottom: '1px solid #333333',
              fontSize: '12px',
              color: '#CCCCCC',
            }}
          >
            <div className="flex items-center gap-6">
              <span style={{ color: '#50FA7B' }}>-- INSERT --</span>
              <span>3dsystem.vim</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{terminalLines.length + 1},{(currentLine?.length || 0) + 1}</span>
              <span>All</span>
            </div>
          </div>

      <div
        className="flex-1 p-4 overflow-auto"
        style={{
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {terminalLines.map((line, index) => {
          const optionLines = getOptionLines();
          const isOption = optionLines.includes(index);
          const isOption1 = optionLines[0] === index;
          const isOption2 = optionLines[1] === index;
          const isOption3 = optionLines[2] === index;
          const isSelected = (isOption1 && selectedIndex === 0) || (isOption2 && selectedIndex === 1) || (isOption3 && selectedIndex === 2);
          const isClickable = isOption && !isTyping;
          const lineColor = getLineColor(line);
          const isHighlightable = shouldHighlight(line);

          return (
            <div
              key={index}
              className={isClickable ? 'cursor-pointer' : ''}
              style={{
                color: lineColor,
                background: isSelected && isClickable ? 'rgba(80, 250, 123, 0.15)' : isHighlightable ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                padding: isClickable ? '2px 8px' : '2px 0',
                transition: 'all 150ms',
                fontWeight: isHighlightable ? '600' : '400',
              }}
              onClick={() => handleLineClick(index)}
              onMouseEnter={() => {
                if (isClickable) {
                  setSelectedIndex(isOption1 ? 0 : isOption2 ? 1 : 2);
                }
              }}
            >
              {line}
            </div>
          );
        })}
        {currentLine && (
          <div style={{ color: getLineColor(currentLine) }}>
            {currentLine}
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '18px',
                background: '#50FA7B',
                marginLeft: '2px',
                verticalAlign: 'middle',
                opacity: showCursor ? 0.8 : 0,
              }}
            />
          </div>
        )}
        {!currentLine && inputMode !== 'none' && (
          <div style={{ color: '#BD93F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {inputMode === 'username' && (
              <>
                <span style={{ color: '#8BE9FD' }}>Username:</span>
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputUsername.length > 0) {
                      e.preventDefault();
                      setInputMode('password');
                    }
                  }}
                  onClick={(e) => e.currentTarget.focus()}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#BD93F9',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '14px',
                    padding: '4px 8px',
                    minWidth: '200px',
                    minHeight: '24px',
                    caretColor: '#50FA7B',
                    cursor: 'text',
                    borderRadius: '2px',
                  }}
                  placeholder=""
                />
              </>
            )}
            {inputMode === 'password' && (
              <>
                <span style={{ color: '#8BE9FD' }}>Password:</span>
                <input
                  ref={passwordInputRef}
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputPassword.length > 0) {
                      e.preventDefault();
                      handleAuthRef.current?.();
                    }
                  }}
                  onClick={(e) => e.currentTarget.focus()}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#BD93F9',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '14px',
                    padding: '4px 8px',
                    minWidth: '200px',
                    minHeight: '24px',
                    caretColor: '#50FA7B',
                    cursor: 'text',
                    borderRadius: '2px',
                  }}
                  placeholder=""
                />
              </>
            )}
          </div>
        )}
      </div>

          <div
            className="w-full px-2 py-1"
            style={{
              background: '#1A1A1A',
              borderTop: '1px solid #333333',
              fontSize: '11px',
              color: '#888888',
            }}
          >
            <div className="flex items-center gap-4">
              <span style={{ color: '#50FA7B' }}>●</span>
              <span>3D System</span>
              <span>•</span>
              <span>{mode === 'menu' ? 'Auth Menu' : mode === 'authenticated' ? 'Mode Select' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
