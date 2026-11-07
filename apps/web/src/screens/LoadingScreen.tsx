export function LoadingScreen() {
  return (
    <div
      className="animate-fade"
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-md)',
      }}
    >
      <div className="animate-bounce" style={{ fontSize: '5rem' }} aria-hidden="true">
        ✨
      </div>
      <p style={{ fontSize: '1.3rem', color: 'var(--color-text-muted)' }}>Loading…</p>
    </div>
  );
}
