import type { Platform } from '../storage';
import { postToTwitter } from './twitter';
import { postToLinkedin } from './linkedin';
import { postToFacebook, postToInstagram } from './meta';

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

export async function publishToPlatform(
  platform: Platform,
  content: string,
  // Which specific brand/account to publish as — only Meta (Facebook/
  // Instagram) credentials are account-scoped today, since that's the
  // actual multi-brand need (see meta.ts's resolveCredential). Twitter/
  // LinkedIn still publish through one single global account regardless
  // of this value; accepted here anyway so every platform has the same
  // call signature rather than a special case for two of them.
  account?: string
): Promise<PublishResult> {
  switch (platform) {
    case 'twitter':
      return postToTwitter(content);
    case 'linkedin':
      return postToLinkedin(content);
    case 'facebook':
      return postToFacebook(content, account);
    case 'instagram':
      return postToInstagram(content, account);
    case 'threads':
      // Threads' API requires a separate, more restrictive Meta app
      // approval process not covered by the credentials this package
      // reads — fail clearly rather than silently dropping the post.
      throw new Error('Unsupported platform for publishing: threads');
  }
}

export { postToTwitter } from './twitter';
export { postToLinkedin } from './linkedin';
export { postToFacebook, postToInstagram } from './meta';
