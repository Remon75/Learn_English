import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/app';
import { play, playTone } from '../lib/audio';

/**
 * The learning map.
 *
 * The map is the child's home screen. Design rules:
 *  - Every node is at least 96px so a small finger can hit it.
 *  - Locked nodes are visible but dimmed. A child should see the whole
 *    journey, not just the next step.
 *  - Colour comes from the level, so the map reads as a path of worlds.
 *  - The header shows stars, but never as a threat or a countdown.
 */
export function MapScreen() {
  const nodes = useAppStore((s) => s.nodes);
  const totalStars = useAppStore((s) => s.totalStars);
  const nickname = useAppStore((s) => s.nickname);
  const openLesson = useAppStore((s) => s.openLesson);
  const setScreen = useAppStore((s) => s.setScreen);
  const loadMap = useAppStore((s) => s.loadMap);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const node of nodes) {
      const list = map.get(node.levelId) ?? [];
      list.push(node);
      map.set(node.levelId, list);
    }
    return [...map.entries()];
  }, [nodes]);

  const handleOpen = (lessonId: string, title: string) => {
    playTone('tap');
    // Speak the lesson name so a pre-reader knows what they are choosing.
    play(`/media/audio/lesson-${lessonId}.mp3`, 1);
    void openLesson(lessonId);
    void title;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>
            {nickname ? `Hi ${nickname}!` : 'Hello!'}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>
            Where shall we go today?
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <div
            aria-label={`${totalStars} stars collected`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-surface)',
              padding: '10px 18px',
              borderRadius: 'var(--radius-full)',
              boxShadow: 'var(--shadow-sm)',
              fontWeight: 700,
              fontSize: '1.2rem',
            }}
          >
            <span aria-hidden="true">⭐</span>
            {totalStars}
          </div>

          <button
            className="btn btn--ghost"
            onClick={() => setScreen('rewards')}
            aria-label="Open my rewards"
            style={{ minWidth: 64 }}
          >
            <span aria-hidden="true">🏅</span>
          </button>

          <button
            className="btn btn--ghost"
            onClick={() => setScreen('parent')}
            aria-label="Grown-up settings"
            style={{ minWidth: 64 }}
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        </div>
      </header>

      {grouped.map(([levelId, levelNodes]) => {
        const first = levelNodes[0]!;
        return (
          <section key={levelId} style={{ marginBottom: 'var(--space-xl)' }}>
            <h2
              style={{
                fontSize: '1.4rem',
                color: first.levelColor,
                marginBottom: 'var(--space-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 'var(--radius-full)',
                  background: first.levelColor,
                }}
              />
              {first.levelTitle}
            </h2>

            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gap: 'var(--space-md)',
              }}
            >
              {levelNodes.map((node) => {
                const locked = node.status === 'locked';
                const completed = node.status === 'completed';
                const available = node.status === 'available' || node.status === 'in-progress';

                return (
                  <li key={node.id}>
                    <button
                      onClick={() => handleOpen(node.id, node.title)}
                      disabled={locked}
                      aria-label={`${node.title}. ${
                        locked
                          ? 'Locked'
                          : completed
                            ? `Completed with ${node.starsEarned} of ${node.starsPossible} stars`
                            : 'Ready to play'
                      }`}
                      className={available ? 'animate-pop' : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        minHeight: 104,
                        textAlign: 'left',
                        borderRadius: 'var(--radius-lg)',
                        background: locked ? 'var(--color-surface-alt)' : 'var(--color-surface)',
                        boxShadow: locked ? 'none' : 'var(--shadow-md)',
                        borderLeft: `10px solid ${
                          locked ? 'var(--color-border)' : first.levelColor
                        }`,
                        opacity: locked ? 0.6 : 1,
                        cursor: locked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: '3rem',
                          width: 76,
                          height: 76,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-surface-alt)',
                          flexShrink: 0,
                        }}
                      >
                        {locked ? '🔒' : node.icon}
                      </span>

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.3rem',
                          }}
                        >
                          {node.title}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--color-text-muted)',
                            fontSize: '1rem',
                            marginTop: 4,
                          }}
                        >
                          {node.objective}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{ display: 'block', marginTop: 6, fontSize: '1.1rem' }}
                        >
                          {node.starsPossible > 0
                            ? Array.from({ length: node.starsPossible }, (_, i) => (
                                <span
                                  key={i}
                                  style={{
                                    opacity: i < node.starsEarned ? 1 : 0.25,
                                  }}
                                >
                                  ⭐
                                </span>
                              ))
                            : null}
                        </span>
                      </span>

                      {completed && (
                        <span
                          aria-hidden="true"
                          style={{ fontSize: '2rem', color: 'var(--color-success)' }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
