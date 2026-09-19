import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTrackedObjectURL,
  revokeTrackedObjectURL,
  revokeAllObjectURLs,
} from './objectUrl';

describe('objectUrl utility', () => {
  beforeEach(() => {
    // Ensure URL mocks
    if (typeof globalThis.URL.createObjectURL !== 'function') {
      globalThis.URL.createObjectURL = vi.fn((blob: any) => `blob:http://localhost/${Math.random().toString(36).slice(2)}`);
    } else {
      vi.spyOn(globalThis.URL, 'createObjectURL');
    }

    if (typeof globalThis.URL.revokeObjectURL !== 'function') {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, 'revokeObjectURL');
    }
  });

  it('tracks created object URLs and revokes them explicitly', () => {
    const dummyBlob = new Blob(['hello world'], { type: 'text/plain' });
    const url = createTrackedObjectURL(dummyBlob);

    expect(url).toContain('blob:');
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();

    revokeTrackedObjectURL(url);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('bulk revokes all tracked object URLs on purge', () => {
    const blob1 = new Blob(['1'], { type: 'text/plain' });
    const blob2 = new Blob(['2'], { type: 'text/plain' });

    const url1 = createTrackedObjectURL(blob1);
    const url2 = createTrackedObjectURL(blob2);

    expect(url1).toContain('blob:');
    expect(url2).toContain('blob:');

    revokeAllObjectURLs();

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(url1);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(url2);
  });
});
