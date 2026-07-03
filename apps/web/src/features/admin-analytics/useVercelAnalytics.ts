import {useEffect, useState} from 'react';
import type {VercelAnalytics} from './vercelAnalyticsTypes';

const VERCEL_ANALYTICS_PATH = '/data/vercel-analytics.json';

export interface UseVercelAnalyticsReturn {
  data: VercelAnalytics | null;
  loading: boolean;
  error: Error | null;
}

/** Fetch the build-time Vercel Web Analytics artifact once on mount. */
export function useVercelAnalytics(): UseVercelAnalyticsReturn {
  const [data, setData] = useState<VercelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(VERCEL_ANALYTICS_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`vercel-analytics fetch failed: ${res.status}`);
        return res.json();
      })
      .then((json: VercelAnalytics) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {data, loading, error};
}
