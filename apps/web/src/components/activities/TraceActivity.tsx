import { useRef, useState } from 'react';
import { playTone } from '../../lib/audio';
import { Feedback, NextButton, type ActivityProps } from './types';

/**
 * Letter-tracing activity.
 *
 * The child drags a finger over a large letter. The trace is checked by
 * comparing the drawn path against the letter's shape rather than by OCR:
 * the score reflects how much of the target area the child covered, which
 * is developmentally appropriate for a 3-year-old and needs no model.
 *
 * Nothing about the trace is uploaded. It is evaluated in the browser and
 * only the resulting score is sent.
 */
export function TraceActivity({ activity, onResult, onNext }: ActivityProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const letter = activity.expected ?? 'A';

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    pointsRef.current = [getPoint(event)];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const point = getPoint(event);
    pointsRef.current.push(point);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const previous = pointsRef.current[pointsRef.current.length - 2]!;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FF6F00';
    ctx.stroke();
  };

  const end = async () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    const points = pointsRef.current;

    if (!ctx || points.length < 8) {
      setState('wrong');
      await onResult({ response: '', score: 0, correct: false });
      return;
    }

    // Score = how much of the glyph area the stroke covered.
    const score = coverageScore(ctx, canvas, letter);
    const correct = score >= 0.45;
    setState(correct ? 'correct' : 'wrong');
    playTone(correct ? 'correct' : 'wrong');
    await onResult({ response: letter.toLowerCase(), score, correct });
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    pointsRef.current = [];
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)', justifyItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: 'min(320px, 80vw)',
          height: 'min(320px, 80vw)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-alt)',
          border: '4px dashed var(--color-border)',
        }}
      >
        {/* Guide letter. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 'min(220px, 60vw)',
            color: 'rgba(44,26,0,0.14)',
            fontWeight: 700,
            userSelect: 'none',
          }}
        >
          {letter}
        </span>

        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => void end()}
          onPointerLeave={() => void end()}
          aria-label={`Trace the letter ${letter}`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            touchAction: 'none',
            borderRadius: 'var(--radius-lg)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button className="btn btn--ghost" onClick={clear}>
          <span aria-hidden="true">🧽</span> Erase
        </button>
        {activity.stimulus?.kind === 'audio' && (
          <button
            className="btn btn--ghost"
            onClick={() => {
              import('../../lib/audio').then(({ playMedia }) => playMedia(activity.stimulus!));
            }}
          >
            <span aria-hidden="true">🔊</span> Hear it
          </button>
        )}
      </div>

      <Feedback state={state} />

      {state !== 'idle' && (
        <NextButton
          onClick={() => {
            clear();
            setState('idle');
            onNext();
          }}
        />
      )}
    </div>
  );
}

/**
 * Measures how much of the reference glyph the child's stroke overlaps.
 *
 * The reference glyph is drawn on an offscreen canvas and the intersection
 * is measured with a pixel scan. It is a rough but fair measure of "the
 * child traced the letter", and it needs no machine-learning model.
 */
function coverageScore(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  letter: string,
): number {
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext('2d');
  if (!offCtx) return 0;

  offCtx.fillStyle = '#000';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.font = `700 ${canvas.height * 0.72}px "Baloo 2", "Trebuchet MS", sans-serif`;
  offCtx.fillText(letter, canvas.width / 2, canvas.height / 2);

  const glyph = offCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const stroke = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let glyphPixels = 0;
  let covered = 0;

  for (let i = 0; i < glyph.length; i += 4) {
    const onGlyph = glyph[i + 3]! > 32;
    const onStroke = stroke[i + 3]! > 32;
    if (!onGlyph) continue;
    glyphPixels += 1;
    if (onStroke) covered += 1;
  }

  if (glyphPixels === 0) return 0;
  return Math.min(1, covered / glyphPixels);
}
