import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getLesson } from '@sparkle/shared';
import { ListenActivity } from '../src/components/activities/ListenActivity';

/**
 * Render tests for the listening activity.
 *
 * The reported defect was a lesson that could not be left: the activity
 * rendered an empty grid because it had no options to show. These tests
 * pin the two properties that prevent that from happening again.
 */

function render(activity: Parameters<typeof ListenActivity>[0]['activity']): string {
  return renderToStaticMarkup(
    createElement(ListenActivity, {
      activity,
      onResult: () => {},
      onNext: () => {},
    }),
  );
}

describe('ListenActivity', () => {
  it('renders a tap target for every option', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const activity = lesson.activities.find((a) => a.kind === 'listen')!;

    const html = render(activity);
    expect(html).toContain('A waving hand');
    expect(html).toContain('An open hand');
    expect(html).toContain('A foot');
  });

  it('never leaves the child without a way forward', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const activity = lesson.activities.find((a) => a.kind === 'listen')!;

    // A listen activity without options used to render an empty screen.
    const html = render({ ...activity, options: [] });
    expect(html).toContain('I heard it');
  });

  it('does not show the transcript, which is the answer', () => {
    const lesson = getLesson('l1-u1-s1')!;
    const activity = lesson.activities.find((a) => a.kind === 'listen')!;
    expect(activity.stimulus?.transcript).toBeTruthy();

    const html = render(activity);
    expect(html).not.toContain(activity.stimulus!.transcript!);
  });
});
