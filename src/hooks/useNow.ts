import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * One ticker per `intervalMs` is shared across every subscriber, so 50
 * conversation rows on the chat list don't spin 50 separate intervals.
 */
const tickers = new Map<number, Ticker>();

interface Ticker {
  now: number;
  subscribers: Set<(now: number) => void>;
  timer: ReturnType<typeof setInterval> | null;
}

function getTicker(intervalMs: number): Ticker {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { now: Date.now(), subscribers: new Set(), timer: null };
    tickers.set(intervalMs, t);
  }
  return t;
}

function startTicker(t: Ticker, intervalMs: number): void {
  if (t.timer) return;
  t.now = Date.now();
  t.subscribers.forEach((fn) => fn(t.now));
  t.timer = setInterval(() => {
    t.now = Date.now();
    t.subscribers.forEach((fn) => fn(t.now));
  }, intervalMs);
}

function stopTicker(t: Ticker): void {
  if (!t.timer) return;
  clearInterval(t.timer);
  t.timer = null;
}

let appStateSub: { remove: () => void } | null = null;
let appStateRefcount = 0;

function subscribeAppState(): () => void {
  appStateRefcount += 1;
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        for (const [interval, t] of tickers) {
          if (t.subscribers.size > 0) startTicker(t, interval);
        }
      } else {
        for (const t of tickers.values()) stopTicker(t);
      }
    });
  }
  return () => {
    appStateRefcount -= 1;
    if (appStateRefcount === 0) {
      appStateSub?.remove();
      appStateSub = null;
    }
  };
}

/**
 * Re-renders the caller every `intervalMs` so time-derived UI ("just now",
 * "1m", etc.) advances on its own without depending on user actions or new
 * data. Pauses when the app is backgrounded and re-syncs on foreground.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = getTicker(intervalMs);
    t.subscribers.add(setNow);
    if (t.subscribers.size === 1 && AppState.currentState === 'active') {
      startTicker(t, intervalMs);
    } else {
      setNow(t.now);
    }

    const unsubAppState = subscribeAppState();

    return () => {
      t.subscribers.delete(setNow);
      if (t.subscribers.size === 0) {
        stopTicker(t);
        tickers.delete(intervalMs);
      }
      unsubAppState();
    };
  }, [intervalMs]);

  return now;
}
