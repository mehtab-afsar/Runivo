/**
 * Forwards recovered sync failures (reportSyncError) to the app's error tracker via
 * errorReporting.ts, so production sync problems reach Sentry instead of dying in a log.
 *
 * errorReporting already does the safety work: `extra` is reduced to flat primitives with
 * coordinate/token-like keys redacted, repeats are throttled, and nothing leaves the device
 * in development. The reporter itself (Sentry) is registered by the app via setErrorReporter.
 */
import { captureHandledError } from '../errorReporting';
import { setSyncErrorListener, type SyncErrorReport } from './syncQueue';

/** 'scoreRun' → 'score-run': errorReporting wants short, stable, kebab-case operation names. */
function toOperation(scope: string): string {
  return scope.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The listener itself, exported so it can be tested without touching global state. */
export function forwardSyncError(report: SyncErrorReport): void {
  captureHandledError(report.error, {
    domain: 'sync',
    operation: toOperation(report.scope),
    extra: report.context,
  });
}

/** Call once at app start. Returns a function that restores the default (console) behaviour. */
export function forwardSyncErrorsToErrorReporting(): () => void {
  setSyncErrorListener(forwardSyncError);
  return () => setSyncErrorListener(null);
}
