export function CornerBrackets() {
  const cornerStyle = {
    position: 'absolute' as const,
    width: '60px',
    height: '60px',
    borderColor: 'rgba(130, 209, 255, 0.4)',
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div
        style={{
          ...cornerStyle,
          top: '24px',
          left: '24px',
          borderTop: '2px solid',
          borderLeft: '2px solid',
        }}
      />
      <div
        style={{
          ...cornerStyle,
          top: '24px',
          right: '24px',
          borderTop: '2px solid',
          borderRight: '2px solid',
        }}
      />
      <div
        style={{
          ...cornerStyle,
          bottom: '24px',
          left: '24px',
          borderBottom: '2px solid',
          borderLeft: '2px solid',
        }}
      />
      <div
        style={{
          ...cornerStyle,
          bottom: '24px',
          right: '24px',
          borderBottom: '2px solid',
          borderRight: '2px solid',
        }}
      />
    </div>
  );
}
