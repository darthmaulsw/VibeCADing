export function ScanLines() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            rgba(130, 209, 255, 0.03) 0px,
            rgba(130, 209, 255, 0.03) 1px,
            transparent 1px,
            transparent 2px
          )`,
          animation: 'scan 8s linear infinite',
        }}
      />
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
