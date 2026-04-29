import { LogBox } from 'react-native';

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : (err as { message?: string }).message;
  if (!msg) return false;
  return (
    /network request failed/i.test(msg) ||
    /failed to fetch/i.test(msg) ||
    /load failed/i.test(msg) ||
    /timeout/i.test(msg) ||
    /aborted/i.test(msg) ||
    /networkerror/i.test(msg) ||
    /enotfound|econnrefused|econnreset|etimedout/i.test(msg) ||
    /no internet|offline/i.test(msg) ||
    /the internet connection appears to be offline/i.test(msg)
  );
}

let installed = false;

export function installNetworkErrorSilencer(): void {
  if (installed) return;
  installed = true;

  LogBox.ignoreLogs([
    /Network request failed/i,
    /Possible Unhandled Promise Rejection.*Network request failed/i,
    /TypeError: Network request failed/i,
    /Failed to fetch/i,
    /Load failed/i,
    /AbortError/i,
    /The internet connection appears to be offline/i,
  ]);

  patchConsole('warn');
  patchConsole('error');
  patchConsoleMessageBased('log');
}

type ConsoleMethod = 'log' | 'warn' | 'error';

function patchConsole(method: 'warn' | 'error'): void {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    if (args.some(isNetworkError)) return;
    if (
      args.some(
        (a) =>
          typeof a === 'string' && /network request failed|failed to fetch|load failed/i.test(a)
      )
    ) {
      return;
    }
    original(...args);
  };
}

function patchConsoleMessageBased(method: ConsoleMethod): void {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === 'string' &&
      /network request failed|possible unhandled promise rejection.*network/i.test(first)
    ) {
      return;
    }
    original(...args);
  };
}

/** Run an async function and swallow network errors silently. */
export async function silentNetwork<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (isNetworkError(err)) return null;
    throw err;
  }
}
