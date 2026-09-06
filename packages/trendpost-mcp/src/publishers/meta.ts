import type { PublishResult } from './index';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// Multi-account credential resolution: with `account` given, prefer
// `<BASE>__<ACCOUNT>` (e.g. META_ACCESS_TOKEN__NIXLEVEL) over the bare
// `<BASE>` name, falling back to the bare name if no account-specific
// value is set. This is what actually lets each brand publish through its
// own Instagram/Facebook credentials instead of all posts going out
// through one hardcoded account regardless of which brand they're for —
// the gap flagged live 2026-09-05 when `account` tracking first landed on
// ScheduledPost but publishing itself had no way to use it yet.
function resolveCredential(base: string, account?: string): string | undefined {
  if (account) {
    const scoped = process.env[`${base}__${account.toUpperCase()}`];
    if (scoped) return scoped;
  }
  return process.env[base];
}

function requireCredentials(names: string[], account?: string): Record<string, string> {
  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = resolveCredential(name, account);
    if (value) {
      resolved[name] = value;
    } else {
      missing.push(account ? `${name}__${account.toUpperCase()} (or ${name})` : name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing Meta credentials${account ? ` for account "${account}"` : ''}: ` +
        `${missing.join(', ')}. Set them in .env — see docs/DEPLOYMENT.md's "Getting platform ` +
        `API credentials" section.`
    );
  }
  return resolved;
}

async function graphPost(path: string, params: Record<string, string>): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.id) {
    throw new Error(
      `Meta Graph API request to ${path} failed: ${body.error?.message ?? res.statusText}`
    );
  }
  return { id: body.id };
}

export async function postToFacebook(content: string, account?: string): Promise<PublishResult> {
  const creds = requireCredentials(['META_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID'], account);

  const { id } = await graphPost(`${creds.FACEBOOK_PAGE_ID}/feed`, {
    message: content,
    access_token: creds.META_ACCESS_TOKEN,
  });

  return { platformPostId: id, url: `https://www.facebook.com/${id}` };
}

export async function postToInstagram(content: string, account?: string): Promise<PublishResult> {
  const creds = requireCredentials(
    ['META_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_DEFAULT_IMAGE_URL'],
    account
  );

  // Instagram feed posts require Graph API's two-step flow: create a media
  // container with an image, then publish that container. There's no
  // single-call "just post text" option — unlike Facebook.
  const container = await graphPost(`${creds.INSTAGRAM_ACCOUNT_ID}/media`, {
    image_url: creds.INSTAGRAM_DEFAULT_IMAGE_URL,
    caption: content,
    access_token: creds.META_ACCESS_TOKEN,
  });

  const published = await graphPost(`${creds.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    creation_id: container.id,
    access_token: creds.META_ACCESS_TOKEN,
  });

  return { platformPostId: published.id };
}
