
const BASE = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL ?? '';
const TOKEN = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN ?? '';

async function cmd<T>(...args: (string | number)[]): Promise<T> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result as T;
}

export const redis = {
  get: <T = string>(key: string) => cmd<T | null>('GET', key),

  set: (
    key: string,
    value: string | number,
    opts?: { ex?: number; px?: number }
  ): Promise<string> => {
    const args: (string | number)[] = ['SET', key, String(value)];
    if (opts?.ex) args.push('EX', opts.ex);
    if (opts?.px) args.push('PX', opts.px);
    return cmd<string>(...args);
  },

  del: (...keys: string[]) => cmd<number>('DEL', ...keys),

  ttl: (key: string) => cmd<number>('TTL', key),

  exists: (...keys: string[]) => cmd<number>('EXISTS', ...keys),
};
