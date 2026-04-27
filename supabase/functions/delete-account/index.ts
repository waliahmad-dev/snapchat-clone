// Supabase Edge Function: delete-account
//
// Deploy:   supabase functions deploy delete-account --no-verify-jwt
// Secrets:  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.
//
// Verifies the caller's JWT, then uses the service-role client to delete
// their auth user. The public.users row cascades via the FK in supabase-schema.sql.
//
// We pass --no-verify-jwt because we do the verification manually below
// (so we can return a friendly JSON error instead of the gateway's 401).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResponse({ error: 'missing_token' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return jsonResponse({ error: 'invalid_token' }, 401);

  const userId = userData.user.id;
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) return jsonResponse({ error: deleteErr.message }, 500);

  return jsonResponse({ ok: true });
});
