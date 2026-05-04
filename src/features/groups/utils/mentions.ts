import type { DbUser } from '@/types/database';

export interface MentionMember {
  id: string;
  username: string;
  display_name: string;
}

export interface MentionToken {
  type: 'text' | 'mention';
  text: string;
  userId?: string;
}

const MENTION_RE = /@([a-z0-9._]{1,30})/gi;

/**
 * Resolve all `@username` substrings in `content` against `members`.
 * Returns the unique set of matched user IDs in mention-order.
 */
export function parseMentions(
  content: string,
  members: MentionMember[]
): string[] {
  const byUsername = new Map(members.map((m) => [m.username.toLowerCase(), m.id]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(content)) !== null) {
    const id = byUsername.get(match[1].toLowerCase());
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Tokenise text for rendering mentions inline. Each token is either a
 * plain text run or a resolved mention (with the user's id attached so the
 * UI can make it tappable).
 */
export function tokenizeForRender(
  content: string,
  members: MentionMember[]
): MentionToken[] {
  const byUsername = new Map(members.map((m) => [m.username.toLowerCase(), m]));
  const tokens: MentionToken[] = [];
  let cursor = 0;
  MENTION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(content)) !== null) {
    const start = match.index;
    if (start > cursor) {
      tokens.push({ type: 'text', text: content.slice(cursor, start) });
    }
    const username = match[1];
    const member = byUsername.get(username.toLowerCase());
    if (member) {
      tokens.push({ type: 'mention', text: `@${username}`, userId: member.id });
    } else {
      tokens.push({ type: 'text', text: match[0] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < content.length) {
    tokens.push({ type: 'text', text: content.slice(cursor) });
  }
  return tokens;
}

/**
 * Detect a partial `@token` immediately before the caret (for autocomplete).
 * Returns the token (without `@`) when the caret sits inside one.
 */
export function activeMentionPrefix(text: string, caret: number): string | null {
  const upTo = text.slice(0, caret);
  const at = upTo.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && /\S/.test(upTo[at - 1])) return null;
  const token = upTo.slice(at + 1);
  if (!/^[a-z0-9._]*$/i.test(token)) return null;
  return token;
}

export function userToMentionMember(u: DbUser): MentionMember {
  return { id: u.id, username: u.username, display_name: u.display_name };
}
