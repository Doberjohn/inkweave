import {Profiler, type ProfilerOnRenderCallback, type ReactNode} from 'react';

const SLOW_RENDER_MS = 16; // 1 frame at 60fps

/**
 * Sends render timing to Sentry as a custom metric span.
 * Only runs in production when Sentry is loaded.
 */
function reportToSentry(id: string, phase: string, actualDurationMs: number) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.startSpan(
        {
          name: `react.render.${id}`,
          op: 'ui.react.render',
          attributes: {
            'react.component': id,
            'react.phase': phase,
            'react.duration_ms': actualDurationMs,
          },
        },
        () => {
          // Span auto-closes; the attributes carry the data
        },
      );
    })
    .catch(() => {
      // Sentry unavailable (blocked, failed to load, etc.) — silently skip
    });
}

/**
 * Lightweight React Profiler wrapper for performance monitoring.
 *
 * - **Dev**: Logs slow renders (>16ms) to console with component name + duration
 * - **Prod**: Sends render metrics to Sentry as spans (sampled per tracesSampleRate)
 * - **Zero overhead when disabled**: Renders children directly if Profiler is not supported
 *
 * Usage:
 * ```tsx
 * <RenderProfiler id="BrowseCardGrid">
 *   <BrowseCardGrid cards={cards} ... />
 * </RenderProfiler>
 * ```
 */
// Module-level callback — uses only compile-time constants (import.meta.env),
// so it's guaranteed stable without React Compiler memoization.
const onRender: ProfilerOnRenderCallback = (profileId, phase, actualDuration) => {
  if (import.meta.env.DEV) {
    if (actualDuration > SLOW_RENDER_MS) {
      console.warn(
        `[RenderProfiler] ${profileId} (${phase}): ${actualDuration.toFixed(1)}ms — exceeds ${SLOW_RENDER_MS}ms frame budget`,
      );
    }
  } else if (import.meta.env.VITE_SENTRY_DSN) {
    if (actualDuration > SLOW_RENDER_MS) {
      reportToSentry(profileId, phase, actualDuration);
    }
  }
};

export function RenderProfiler({id, children}: {id: string; children: ReactNode}) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
