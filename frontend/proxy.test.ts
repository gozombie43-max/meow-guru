// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy } from './proxy';

describe('monitoring access through the proxy', () => {
  it.each(['/monitoring', '/monitoring/', '/monitoring?o=1&p=2'])('allows unauthenticated tunnel requests to %s', path => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(false);
    const response = proxy(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/play', '/monitoring-other'])('retains the access gate on %s', path => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
    expect(proxy(new NextRequest(`http://localhost${path}`)).headers.get('location')).toBe('http://localhost/access-code');
  });
});
