import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'loading';
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (type !== 'loading' && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, type, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    loading: <Loader2 className="w-5 h-5 animate-spin" />,
  };

  const colors = {
    success: '#00FF00',
    error: '#FF4444',
    loading: '#00D4FF',
  };

  return (
    <div
      className="fixed bottom-6 right-6 flex items-center gap-3 px-6 py-4 font-mono text-sm transition-all duration-300 z-50"
      style={{
        background: 'rgba(14, 18, 36, 0.95)',
        border: `1px solid ${colors[type]}`,
        borderRadius: '8px',
        color: colors[type],
        boxShadow: `0 0 20px ${colors[type]}40`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      {icons[type]}
      <span className="tracking-wider">{message}</span>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'loading' }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

