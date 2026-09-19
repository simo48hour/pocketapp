const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class GitLabCache {
  private _cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, duration = CACHE_DURATION): void {
    const timestamp = Date.now();
    this._cache.set(key, {
      data,
      timestamp,
      expiresAt: timestamp + duration,
    });
  }

  get<T>(key: string): T | null {
    const entry = this._cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this._cache.clear();
  }

  isExpired(key: string): boolean {
    const entry = this._cache.get(key);
    return !entry || Date.now() > entry.expiresAt;
  }
}

export const gitlabCache = new GitLabCache();

export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) and rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt === maxRetries) {
          return response;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('fetchWithRetry failed unexpectedly');
}
