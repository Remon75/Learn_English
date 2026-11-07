import { useEffect, useRef, useState } from 'react';

/**
 * Reward celebration.
 *
 * A small WebGL particle burst, rendered by PixiJS on a canvas layered over
 * the lesson. PixiJS is loaded lazily with a dynamic import: it is by far
 * the heaviest dependency in the app, and a child should not wait for it
 * before the first lesson renders.
 *
 * The burst is deliberately cheap (about fifty sprites). If WebGL is
 * unavailable the component silently does nothing - the celebration still
 * works through the CSS text and the synthesised sound.
 */
export function StarBurst({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<{ destroy: (removeView?: boolean, options?: unknown) => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    let disposed = false;

    const setup = async () => {
      try {
        const PIXI = await import('pixi.js');
        if (disposed || !canvasRef.current) return;

        const app = new PIXI.Application();
        await app.init({
          canvas: canvasRef.current,
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: 0,
          antialias: true,
          preference: 'webgl',
        });

        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }

        appRef.current = app as unknown as { destroy: (removeView?: boolean, options?: unknown) => void };
        runBurst(app, PIXI);
      } catch {
        // No WebGL (or blocked): the celebration still has sound and text.
        setFailed(true);
      }
    };

    void setup();

    const timer = window.setTimeout(() => {
      onDone();
    }, 2200);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
    >
      {!failed && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
}

const STAR_COLORS = ['#FFB300', '#FF6F00', '#AB47BC', '#26A69A', '#42A5F5'];

type PixiModule = typeof import('pixi.js');

function runBurst(app: import('pixi.js').Application, PIXI: PixiModule): void {
  const stage = app.stage;

  const texture = PIXI.Texture.from(starSvg());
  const container = new PIXI.Container();

  for (let i = 0; i < 48; i += 1) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = 18 + Math.random() * 26;
    sprite.height = sprite.width;
    sprite.tint = Number(STAR_COLORS[i % STAR_COLORS.length]!.replace('#', '0x'));
    sprite.position.set(app.renderer.width / 2, app.renderer.height / 2);
    sprite.alpha = 1;

    const angle = (Math.PI * 2 * i) / 48 + Math.random() * 0.4;
    const speed = 4 + Math.random() * 7;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed - 3;

    app.ticker.add((ticker) => {
      const dt = ticker.deltaTime;
      vy += 0.22 * dt;
      sprite.x += vx * dt;
      sprite.y += vy * dt;
      sprite.rotation += 0.08 * dt;
      sprite.alpha -= 0.012 * dt;
    });

    container.addChild(sprite);
  }

  // A soft ring behind the burst.
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, 90).stroke({ width: 8, color: 0xffb300, alpha: 0.7 });
  ring.position.set(app.renderer.width / 2, app.renderer.height / 2);
  ring.scale.set(0.2);

  app.ticker.add((ticker) => {
    ring.scale.set(ring.scale.x + 0.012 * ticker.deltaTime);
    ring.alpha = Math.max(0, 1 - (ring.scale.x - 0.2) / 1.2);
  });

  stage.addChild(ring, container);
}

/** A vector star drawn in code, so no external image is required. */
function starSvg(): string {
  const points = 5;
  const outer = 24;
  const inner = 10;
  let path = '';

  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = 24 + Math.cos(angle) * radius;
    const y = 24 + Math.sin(angle) * radius;
    path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  path += 'Z';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="${path}" fill="#ffffff"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
