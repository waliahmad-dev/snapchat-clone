import { supabase } from '@lib/supabase/client';

export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/;
export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
export const USERNAME_CHANGES_PER_YEAR = 3;
export const MIN_AGE_YEARS = 16;

export type PasswordStrength = {
  ok: boolean;
  reasons: string[];
};

export function validatePassword(pw: string): PasswordStrength {
  const reasons: string[] = [];
  if (pw.length < 8) reasons.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) reasons.push('One uppercase letter');
  if (!/[a-z]/.test(pw)) reasons.push('One lowercase letter');
  if (!/[0-9]/.test(pw)) reasons.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) reasons.push('One symbol');
  return { ok: reasons.length === 0, reasons };
}

export function ageFromIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dob = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Re-verifies the current user's password by attempting a fresh sign-in.
 * Throws on bad password. Used as a guard before email/password/delete.
 */
export async function reauthenticate(currentPassword: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getUser();
  const email = sessionData.user?.email;
  if (!email) throw new Error('No email on current session');
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) throw new Error('Incorrect password');
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  return !data;
}

export async function checkPhoneAvailable(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  return !data;
}

/**
 * Returns how many username changes the user has left in the rolling 12-month window.
 * Allowance is `USERNAME_CHANGES_PER_YEAR`.
 */
export async function getUsernameChangesRemaining(userId: string): Promise<number> {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('username_changes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('changed_at', since);
  if (error) throw error;
  const used = count ?? 0;
  return Math.max(0, USERNAME_CHANGES_PER_YEAR - used);
}

export async function updateUsername(
  userId: string,
  oldUsername: string,
  newUsername: string,
): Promise<void> {
  if (!USERNAME_REGEX.test(newUsername)) {
    throw new Error('Username must be 3–20 chars: lowercase letters, numbers, dot or underscore.');
  }
  if (newUsername === oldUsername) throw new Error('That is already your username.');

  const remaining = await getUsernameChangesRemaining(userId);
  if (remaining <= 0) {
    throw new Error('You have used all 3 username changes for this year.');
  }

  const available = await checkUsernameAvailable(newUsername);
  if (!available) throw new Error('That username is taken.');

  const { error } = await supabase
    .from('users')
    .update({ username: newUsername })
    .eq('id', userId);
  if (error) throw error;

  await supabase.from('username_changes').insert({
    user_id: userId,
    old_username: oldUsername,
    new_username: newUsername,
  });
}

export async function updatePhone(userId: string, phone: string | null): Promise<void> {
  if (phone) {
    const compact = phone.replace(/\s+/g, '');
    if (!PHONE_REGEX.test(compact)) {
      throw new Error('Enter a valid number (digits only, optional leading +).');
    }
    const available = await checkPhoneAvailable(compact);
    if (!available) {
      throw new Error('That number is in use on another account.');
    }
    const { error } = await supabase.from('users').update({ phone: compact }).eq('id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('users').update({ phone: null }).eq('id', userId);
    if (error) throw error;
  }
}

export async function updateEmail(currentPassword: string, newEmail: string): Promise<void> {
  await reauthenticate(currentPassword);
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const strength = validatePassword(newPassword);
  if (!strength.ok) {
    throw new Error('Password is too weak: ' + strength.reasons.join(', '));
  }
  await reauthenticate(currentPassword);
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function deleteAccount(currentPassword: string): Promise<void> {
  await reauthenticate(currentPassword);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('No active session');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  await supabase.auth.signOut();
}
