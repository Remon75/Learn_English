import { useEffect } from 'react';
import { useAppStore } from './store/app';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { MapScreen } from './screens/MapScreen';
import { LessonScreen } from './screens/LessonScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { ParentScreen } from './screens/ParentScreen';
import { LoadingScreen } from './screens/LoadingScreen';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setError = useAppStore((s) => s.setError);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Reflect connectivity so the caregiver can see when the device is offline.
  useEffect(() => {
    const online = () => useAppStore.setState({ isOnline: true });
    const offline = () => useAppStore.setState({ isOnline: false });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return (
    <div className="app-shell">
      {!useAppStore.getState().isOnline && (
        <div
          role="status"
          style={{
            background: 'var(--color-surface-alt)',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: '6px',
            fontSize: '0.9rem',
          }}
        >
          Offline mode - your progress is saved on this device
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            background: '#ffebee',
            color: 'var(--color-error)',
            padding: 'var(--space-sm) var(--space-md)',
            display: 'flex',
            gap: 'var(--space-sm)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span>{error}</span>
          <button className="btn btn--ghost" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      )}

      {screen === 'loading' && <LoadingScreen />}
      {screen === 'welcome' && <WelcomeScreen />}
      {screen === 'map' && <MapScreen />}
      {screen === 'lesson' && <LessonScreen />}
      {screen === 'rewards' && <RewardsScreen />}
      {screen === 'parent' && <ParentScreen />}
    </div>
  );
}
