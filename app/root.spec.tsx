import { describe, expect, it } from 'vitest';
import { createSecurityHeaders } from './lib/security';

describe('Security Headers', () => {
  it('creates robust CSP security headers', () => {
    const headers = createSecurityHeaders();
    const csp = headers['Content-Security-Policy'];

    expect(csp).toContain('script-src');
    expect(csp).toContain('connect-src');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
