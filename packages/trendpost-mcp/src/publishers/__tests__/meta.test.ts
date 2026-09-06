import { postToFacebook, postToInstagram } from '../meta';

describe('postToFacebook()', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'meta-token';
    process.env.FACEBOOK_PAGE_ID = 'page-1';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('posts to the page feed endpoint with message + access_token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fb-123' }),
    });

    const result = await postToFacebook('hello world');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/page-1/feed');
    expect(opts.method).toBe('POST');
    const params = new URLSearchParams(opts.body);
    expect(params.get('message')).toBe('hello world');
    expect(params.get('access_token')).toBe('meta-token');
    expect(result).toEqual({ platformPostId: 'fb-123', url: 'https://www.facebook.com/fb-123' });
  });

  it('throws a clear error when a required credential is missing', async () => {
    delete process.env.FACEBOOK_PAGE_ID;
    await expect(postToFacebook('hello')).rejects.toThrow(/FACEBOOK_PAGE_ID/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws with the Graph API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Invalid OAuth access token' } }),
    });

    await expect(postToFacebook('hello')).rejects.toThrow(/Invalid OAuth access token/);
  });

  it('prefers an account-scoped credential over the bare one when both exist', async () => {
    process.env.FACEBOOK_PAGE_ID__NIXLEVEL = 'nixlevel-page';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fb-nixlevel' }),
    });

    await postToFacebook('hello', 'nixlevel');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/nixlevel-page/feed');
  });

  it('falls back to the bare credential when no account-scoped one is set', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fb-fallback' }),
    });

    await postToFacebook('hello', 'techtrendwire');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/page-1/feed');
  });

  it('names the account in the error when a scoped credential is missing entirely', async () => {
    delete process.env.FACEBOOK_PAGE_ID;
    await expect(postToFacebook('hello', 'nixlevel')).rejects.toThrow(
      /for account "nixlevel".*FACEBOOK_PAGE_ID__NIXLEVEL/
    );
  });
});

describe('postToInstagram()', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'meta-token';
    process.env.INSTAGRAM_ACCOUNT_ID = 'ig-1';
    process.env.INSTAGRAM_DEFAULT_IMAGE_URL = 'https://example.com/brand.png';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('performs the two-step container-then-publish flow, wiring the container id through', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-media-1' }) });

    const result = await postToInstagram('hello world');

    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [firstUrl, firstOpts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(firstUrl).toBe('https://graph.facebook.com/v19.0/ig-1/media');
    const firstParams = new URLSearchParams(firstOpts.body);
    expect(firstParams.get('image_url')).toBe('https://example.com/brand.png');
    expect(firstParams.get('caption')).toBe('hello world');

    const [secondUrl, secondOpts] = (global.fetch as jest.Mock).mock.calls[1];
    expect(secondUrl).toBe('https://graph.facebook.com/v19.0/ig-1/media_publish');
    const secondParams = new URLSearchParams(secondOpts.body);
    // The critical wiring assertion: the second call's creation_id must be
    // the first call's returned container id, not a hardcoded/blank value.
    expect(secondParams.get('creation_id')).toBe('container-1');

    expect(result).toEqual({ platformPostId: 'ig-media-1' });
  });

  it('throws before making any request when INSTAGRAM_DEFAULT_IMAGE_URL is missing', async () => {
    delete process.env.INSTAGRAM_DEFAULT_IMAGE_URL;
    await expect(postToInstagram('hello')).rejects.toThrow(/INSTAGRAM_DEFAULT_IMAGE_URL/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not attempt media_publish if the container-creation call fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Invalid image URL' } }),
    });

    await expect(postToInstagram('hello')).rejects.toThrow(/Invalid image URL/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('publishes through the account-scoped Instagram ID when one is set for that account', async () => {
    process.env.INSTAGRAM_ACCOUNT_ID__NIXLEVEL = 'ig-nixlevel';
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-nixlevel' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ig-media-nixlevel' }) });

    await postToInstagram('hello', 'nixlevel');

    const [firstUrl] = (global.fetch as jest.Mock).mock.calls[0];
    expect(firstUrl).toBe('https://graph.facebook.com/v19.0/ig-nixlevel/media');
  });

  it('two different accounts with their own credentials publish independently', async () => {
    process.env.INSTAGRAM_ACCOUNT_ID__NIXLEVEL = 'ig-nixlevel';
    process.env.INSTAGRAM_ACCOUNT_ID__TECHTRENDWIRE = 'ig-techtrendwire';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) });

    await postToInstagram('post one', 'nixlevel');
    await postToInstagram('post two', 'techtrendwire');

    const urls = (global.fetch as jest.Mock).mock.calls
      .filter((c) => c[0].endsWith('/media'))
      .map((c) => c[0]);
    expect(urls).toEqual([
      'https://graph.facebook.com/v19.0/ig-nixlevel/media',
      'https://graph.facebook.com/v19.0/ig-techtrendwire/media',
    ]);
  });
});
