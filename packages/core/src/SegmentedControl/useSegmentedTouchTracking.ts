// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file useSegmentedTouchTracking.ts
 * @input The radiogroup element, the selection motion controller and whether
 *   the control is enabled
 * @output Exports `useSegmentedTouchTracking`, which tracks a press of any
 *   pointer from landing to lift for the selection motion; and
 *   `segmentTargetAt`, `measureSegments` and `liftTargetAt`, the segment a
 *   pointer counts for
 * @position Internal to SegmentedControl; drives useSegmentedSelectionMotion.ts
 *
 * SYNC: When modified, update:
 * - /packages/core/src/SegmentedControl/useSegmentedSelectionMotion.ts
 * - /packages/core/src/SegmentedControl/__tests__/SegmentedControl.interaction.browser.spec.ts
 */

import {useRef, type RefObject} from 'react';
import {PanGestureRecognizer} from '../gestures/PanGestureRecognizer';
import {useGestureRecognizer} from '../gestures/useGestureRecognizer';
import {usePressTracker} from '../gestures/usePressTracker';
import {
  createActionGroupTracker,
  type ActionGroupTarget,
  type ActionGroupTracker,
} from '../hooks/actionGroupTracker';
import {lockSelection} from '../gestures/selectionLock';
import {useIsomorphicLayoutEffect} from '../hooks/useIsomorphicLayoutEffect';
import {
  SEGMENT_SELECTOR,
  type SegmentedSelectionMotion,
} from './useSegmentedSelectionMotion';

/**
 * How long a tap's lift waits for the browser's own click before the segment
 * is clicked directly, ms. The browser sends that click with the lift's
 * `touchend`, because the track has no double-tap delay. So the wait runs out
 * only for a lift that the browser does not count as a click.
 */
const BROWSER_CLICK_WAIT_MS = 300;

/**
 * Waits for the browser's own click on `segment` after a tap, then reports
 * whether a handler cancelled it. With no click in time, it clicks the segment
 * itself and reports that. Either way the tap activates once. The browser's
 * click stops the wait when it arrives. A browser click that comes after the
 * direct click is swallowed, because a busy main thread held it.
 *
 * The wait stays in `pending` until nothing of it is left. Calling its entry
 * ends it at once, so an unmount leaves no timer or listener behind.
 */
export function awaitBrowserClick(
  segment: HTMLElement,
  onClicked: (isCancelled: boolean) => void,
  pending: Set<() => void>,
): void {
  const view = segment.ownerDocument.defaultView;
  if (view == null) {
    return;
  }
  let isDone = false;
  let stopSwallowing: (() => void) | null = null;
  const end = () => {
    isDone = true;
    view.removeEventListener('click', grab, true);
    view.clearTimeout(timer);
    stopSwallowing?.();
    pending.delete(end);
  };
  const finish = (isCancelled: boolean) => {
    if (isDone) {
      return;
    }
    isDone = true;
    view.removeEventListener('click', grab, true);
    view.clearTimeout(timer);
    onClicked(isCancelled);
  };
  const grab = (event: MouseEvent) => {
    if (!event.isTrusted || !segment.contains(event.target as Node | null)) {
      return;
    }
    // The browser's click is the activation: the segment is not clicked
    // again, even by a wait that ran out while the main thread was busy.
    view.clearTimeout(timer);
    // After every handler has run: was it cancelled?
    view.setTimeout(() => {
      finish(event.defaultPrevented);
      pending.delete(end);
    }, 0);
  };
  const timer = view.setTimeout(() => {
    if (isDone) {
      return;
    }
    view.removeEventListener('click', grab, true);
    finish(clickAndReport(segment));
    stopSwallowing = swallowLateClick(segment, () => pending.delete(end));
  }, BROWSER_CLICK_WAIT_MS);
  view.addEventListener('click', grab, true);
  pending.add(end);
}

/**
 * Whether `event` is the browser's own late click on `segment` for the
 * activation the tracker already ran. A keyboard or assistive technology
 * activation (`detail === 0`) is never one, so it always passes.
 */
export function isLateClick(
  event: Pick<MouseEvent, 'isTrusted' | 'detail' | 'target'>,
  segment: HTMLElement,
): boolean {
  return (
    event.isTrusted &&
    event.detail !== 0 &&
    segment.contains(event.target as Node | null)
  );
}

/**
 * After a direct click, the browser's own click for the same tap can still
 * come. A busy main thread can hold it past the wait. It is the same
 * activation, so it is swallowed before any handler sees it. This lasts only
 * until the next press or key.
 */
function swallowLateClick(
  segment: HTMLElement,
  onStopped: () => void,
): () => void {
  const view = segment.ownerDocument.defaultView;
  if (view == null) {
    onStopped();
    return () => {};
  }
  const stop = () => {
    view.removeEventListener('click', swallow, true);
    view.removeEventListener('pointerdown', stop, true);
    view.removeEventListener('touchstart', stop, true);
    view.removeEventListener('keydown', stop, true);
    onStopped();
  };
  const swallow = (event: MouseEvent) => {
    if (!isLateClick(event, segment)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
  };
  view.addEventListener('click', swallow, true);
  view.addEventListener('pointerdown', stop, {capture: true, passive: true});
  view.addEventListener('touchstart', stop, {capture: true, passive: true});
  view.addEventListener('keydown', stop, true);
  return stop;
}

/**
 * Clicks `segment` (its activation and every handler run) and reports
 * whether a handler cancelled the click.
 */
function clickAndReport(segment: HTMLElement): boolean {
  const view = segment.ownerDocument.defaultView;
  let clicked: Event | null = null;
  const grab = (event: Event) => {
    if (clicked == null && event.target === segment) {
      clicked = event;
    }
  };
  view?.addEventListener('click', grab, true);
  try {
    segment.click();
  } finally {
    view?.removeEventListener('click', grab, true);
  }
  return (clicked as Event | null)?.defaultPrevented === true;
}

/** A ref to nothing: hooks given it attach nothing. */
const DETACHED: RefObject<HTMLElement | null> = {current: null};

/** The control's box as measured when the finger landed: viewport px. */
export interface ControlBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A segment as measured when the finger landed: its viewport span, px. */
export interface SegmentSpan {
  readonly element: HTMLElement;
  readonly left: number;
  readonly right: number;
}

/** Every segment of `track`, disabled ones included, measured once. */
export function measureSegments(track: HTMLElement): SegmentSpan[] {
  return Array.from(
    track.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR),
    element => {
      const rect = element.getBoundingClientRect();
      return {element, left: rect.left, right: rect.right};
    },
  );
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  );
}

/**
 * The segment a finger at viewport `x` counts for: the one under it, else the
 * nearest. A gap between two segments splits at its middle, as UIKit's
 * segments share an edge. Past the ends, the end segment counts. The result is
 * null when that segment is disabled.
 */
export function segmentTargetAt(
  x: number,
  segments: ReadonlyArray<SegmentSpan>,
): HTMLElement | null {
  let best: SegmentSpan | null = null;
  let distance = Infinity;
  for (const segment of segments) {
    const d = Math.max(segment.left - x, 0, x - segment.right);
    if (d < distance) {
      distance = d;
      best = segment;
    }
  }
  return best != null && !isDisabled(best.element) ? best.element : null;
}

/**
 * The segment a lift at viewport (`x`, `y`) commits: inside the control's
 * `bounds`, the one `segmentTargetAt` counts it for; outside them, none. A
 * press that slides off cancels, because the control selects rather than
 * toggles: a second press would not undo it.
 */
export function liftTargetAt(
  x: number,
  y: number,
  bounds: ControlBounds,
  segments: ReadonlyArray<SegmentSpan>,
): HTMLElement | null {
  if (
    x < bounds.left ||
    x > bounds.right ||
    y < bounds.top ||
    y > bounds.bottom
  ) {
    return null;
  }
  return segmentTargetAt(x, segments);
}

const NO_BOUNDS: ControlBounds = {left: 0, top: 0, right: -1, bottom: -1};

/**
 * Tracks a press on the control as UIKit's segmented control does. The press
 * tracker reports the press from landing to lift. It never claims the
 * pointer, so a vertical drag still scrolls the page. A horizontal pan
 * carries the lens. It claims the pointer only past its slop, and the lift
 * still ends the press.
 *
 * The lift decides the segment, wherever the press began. Inside the control,
 * the segment under the pointer counts, else the nearest one. Outside the
 * control, nothing counts.
 *
 * A tap gets the browser's own click. A drag gets no click from the browser,
 * so the tracker clicks the segment at the lift. Either way the item's
 * `onClick` runs once and can cancel the selection. A mouse and a pen are
 * tracked as a finger is. Keyboard and assistive technology keep the click.
 */
export function useSegmentedTouchTracking(
  trackRef: RefObject<HTMLElement | null>,
  motion: SegmentedSelectionMotion,
  isEnabled: boolean,
): void {
  const isEnabledRef = useRef(isEnabled);
  useIsomorphicLayoutEffect(() => {
    isEnabledRef.current = isEnabled;
  });
  /** The horizontal pan began for this touch: it is a drag, not a tap. */
  const isDraggingRef = useRef(false);
  /** The segments as the finger found them (disabled ones too). */
  const segmentsRef = useRef<SegmentSpan[]>([]);
  /** The control's box as the finger found it: a lift outside it cancels. */
  const boundsRef = useRef<ControlBounds>(NO_BOUNDS);
  const trackerRef = useRef<ActionGroupTracker | null>(null);
  const tracker = (trackerRef.current ??= createActionGroupTracker(() => ({
    roots: () => [trackRef.current],
    itemSelector: SEGMENT_SELECTOR,
    highlightExpansion: 0,
    // The press controller writes the shared press paint on the touched
    // segment, as everywhere under a finger. The tracker paints nothing of its
    // own. A held lens shows the selected face.
    paintsHighlight: false,
    resolveTarget: (
      x: number,
      y: number,
      _targets: ReadonlyArray<ActionGroupTarget>,
    ) => liftTargetAt(x, y, boundsRef.current, segmentsRef.current),
    onActivated: (item, cancelled) => {
      const track = trackRef.current;
      const value = item.dataset.value;
      if (track != null && value != null) {
        motion.clicked(track, value, cancelled);
      }
    },
    swallowsNativeClick: true,
  })));
  /** Click waits still running: an unmount ends them. */
  const pendingClicksRef = useRef<Set<() => void>>(new Set());
  // Ends the tracker's window listeners and any click wait on unmount.
  useIsomorphicLayoutEffect(() => {
    const pendingClicks = pendingClicksRef.current;
    return () => {
      tracker.dispose();
      for (const end of [...pendingClicks]) {
        end();
      }
    };
  }, [tracker]);

  // Every pointer type is tracked. A disabled control attaches nothing.
  const attachRef = isEnabled ? trackRef : DETACHED;
  usePressTracker(attachRef, {
    isEnabled: () => isEnabledRef.current,
    onControlEvent: (event, touch) => {
      const track = trackRef.current;
      if (track == null) {
        return;
      }
      switch (event) {
        case 'touchDown': {
          isDraggingRef.current = false;
          segmentsRef.current = measureSegments(track);
          const rect = track.getBoundingClientRect();
          boundsRef.current = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
          tracker.begin(touch.x, touch.y);
          motion.begin(track, tracker.beganOn);
          break;
        }
        case 'touchUpInside':
        case 'touchUpOutside': {
          // The lift decides, wherever the press began. A lift outside the
          // control commits nothing.
          tracker.move(touch.x, touch.y);
          const lifted = tracker.highlighted;
          const isTap =
            event === 'touchUpInside' &&
            !isDraggingRef.current &&
            lifted != null &&
            lifted === tracker.beganOn;
          const value = motion.release(lifted);
          if (value != null && isTap && lifted != null) {
            // A tap: the browser's own click commits it.
            tracker.cancel();
            awaitBrowserClick(
              lifted,
              isCancelled => motion.clicked(track, value, isCancelled),
              pendingClicksRef.current,
            );
          } else if (value != null) {
            // No click comes from the browser for a drag: the segment's own
            // click, inside the lift's event; its onClick may veto it.
            tracker.end();
          } else {
            tracker.cancel();
          }
          break;
        }
        case 'touchCancel':
          tracker.cancel();
          motion.cancel();
          break;
        case 'touchDragInside':
        case 'touchDragOutside':
        case 'touchDragEnter':
        case 'touchDragExit':
          // The horizontal pan carries the lens.
          break;
      }
    },
  });
  useGestureRecognizer(
    attachRef,
    () =>
      new PanGestureRecognizer({
        name: 'segmented-control-drag',
        direction: 'horizontal',
        cancelsTouchesInView: false,
        // No title is selectable under a held finger, as in UIKit. A hold on
        // the track does something: a drag carries the lens and commits where
        // it lifts. So this recognizer brings the lock, and the host turns off
        // text selection and the callout on the track while a finger is down.
        selectionLock: lockSelection,
      }),
    recognizer => {
      if (recognizer.state === 'began') {
        isDraggingRef.current = true;
      }
      if (recognizer.state === 'began' || recognizer.state === 'changed') {
        const {x, y} = recognizer.location();
        // The lens chases the finger, then the tracker moves the highlight.
        motion.drag(x);
        tracker.move(x, y);
      }
    },
    {isEnabled},
  );
}
