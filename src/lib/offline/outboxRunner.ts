import { Q } from '@nozbe/watermelondb';
import { database } from '@lib/watermelondb/database';
import Outbox from '@lib/watermelondb/models/Outbox';
import { isOnlineSync, useNetworkStore } from './networkStore';

type Handler = (payload: unknown, ctx: { jobId: string; attempts: number }) => Promise<void>;

const handlers = new Map<string, Handler>();

export function registerHandler(kind: string, handler: Handler): void {
  handlers.set(kind, handler);
}

export interface EnqueueArgs {
  kind: string;
  payload: unknown;
  groupKey?: string | null;
}

export async function enqueueJob(args: EnqueueArgs): Promise<string> {
  let id = '';
  await database.write(async () => {
    const created = await database.get<Outbox>('outbox').create((row) => {
      row.kind = args.kind;
      row.payload = JSON.stringify(args.payload);
      row.status = 'pending';
      row.attempts = 0;
      row.lastError = null;
      row.createdAt = Date.now();
      row.nextAttemptAt = Date.now();
      row.groupKey = args.groupKey ?? null;
    });
    id = created.id;
  });
  void drainOutbox();
  return id;
}

/**
 * Enqueue but first drop any pending (not in-flight) jobs sharing this group
 * key. Use when only the LATEST intent matters — e.g. chat presence flips,
 * where a stale in_chat=false would spuriously trigger the server cleanup.
 */
export async function enqueueLatestJob(
  args: EnqueueArgs & { groupKey: string },
): Promise<string> {
  let id = '';
  await database.write(async () => {
    const stale = await database
      .get<Outbox>('outbox')
      .query(Q.where('group_key', args.groupKey), Q.where('status', 'pending'))
      .fetch();
    for (const row of stale) await row.destroyPermanently();

    const created = await database.get<Outbox>('outbox').create((row) => {
      row.kind = args.kind;
      row.payload = JSON.stringify(args.payload);
      row.status = 'pending';
      row.attempts = 0;
      row.lastError = null;
      row.createdAt = Date.now();
      row.nextAttemptAt = Date.now();
      row.groupKey = args.groupKey;
    });
    id = created.id;
  });
  void drainOutbox();
  return id;
}

function backoffMs(attempts: number): number {
  // 5s, 30s, 2m, 10m, 30m, then 30m cap
  const ladder = [5_000, 30_000, 120_000, 600_000, 1_800_000];
  return ladder[Math.min(attempts, ladder.length - 1)];
}

let draining = false;

async function pickNextJob(): Promise<Outbox | null> {
  const now = Date.now();
  const rows = await database
    .get<Outbox>('outbox')
    .query(Q.where('status', 'pending'), Q.where('next_attempt_at', Q.lte(now)))
    .fetch();
  if (rows.length === 0) return null;
  return rows.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
}

async function runJob(job: Outbox): Promise<void> {
  const handler = handlers.get(job.kind);
  if (!handler) {
    console.warn('[Outbox] No handler for kind:', job.kind);
    await database.write(async () => {
      await job.update((row) => {
        row.status = 'failed';
        row.lastError = 'No handler registered for this job kind';
      });
    });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(job.payload);
  } catch {
    await database.write(async () => {
      await job.update((row) => {
        row.status = 'failed';
        row.lastError = 'Corrupt payload';
      });
    });
    return;
  }

  await database.write(async () => {
    await job.update((row) => {
      row.status = 'in_flight';
    });
  });

  try {
    await handler(payload, { jobId: job.id, attempts: job.attempts });
    await database.write(async () => {
      await job.destroyPermanently();
    });
  } catch (err) {
    const message = describeError(err);
    const isNetwork =
      /network request failed|fetch|timeout|getaddrinfo|ECONN|ENOTFOUND|abort/i.test(message) ||
      !isOnlineSync();
    if (!isNetwork) {
      console.error(
        `[Outbox] ${job.kind} failed (attempts=${job.attempts}):`,
        message,
        err
      );
    }
    await database.write(async () => {
      await job.update((row) => {
        row.status = 'pending';
        row.lastError = message.slice(0, 500);
        if (!isNetwork) {
          row.attempts = job.attempts + 1;
        }
        row.nextAttemptAt = Date.now() + backoffMs(row.attempts);
      });
    });
    if (isNetwork) throw err;
  }
}

/**
 * Supabase errors are plain objects with `message`, `code`, `details`, `hint`.
 * Plain `String(err)` collapses to `[object Object]`, which hides the cause.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(
      Boolean
    );
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return '[unserializable error]';
    }
  }
  return String(err);
}

export async function drainOutbox(): Promise<void> {
  if (draining) return;
  if (!isOnlineSync()) return;
  draining = true;
  try {
    while (isOnlineSync()) {
      const next = await pickNextJob();
      if (!next) break;
      try {
        await runJob(next);
      } catch {
        // network error inside runJob — pause draining; resume on reconnect
        break;
      }
    }
  } finally {
    draining = false;
  }
}

let unsubscribeNetwork: (() => void) | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

export function bootstrapOutbox(): () => void {
  // 1. Drain on online state changes (false → true)
  let prev = isOnlineSync();
  unsubscribeNetwork = useNetworkStore.subscribe((state) => {
    if (state.isOnline && !prev) {
      void drainOutbox();
    }
    prev = state.isOnline;
  });

  // 2. Reset any stuck in_flight on startup (process killed mid-job)
  database
    .write(async () => {
      const stuck = await database
        .get<Outbox>('outbox')
        .query(Q.where('status', 'in_flight'))
        .fetch();
      for (const row of stuck) {
        await row.update((r) => {
          r.status = 'pending';
          r.nextAttemptAt = Date.now();
        });
      }
    })
    .catch(() => {});

  // 3. Initial drain
  void drainOutbox();

  // 4. Periodic backstop
  interval = setInterval(() => {
    void drainOutbox();
  }, 30_000);

  return () => {
    unsubscribeNetwork?.();
    unsubscribeNetwork = null;
    if (interval) clearInterval(interval);
    interval = null;
  };
}
