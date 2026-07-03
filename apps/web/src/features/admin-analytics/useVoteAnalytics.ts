import {useEffect, useState} from 'react';
import type {VoteAnalytics} from './voteAnalyticsTypes';

const ANALYTICS_PATH = '/data/vote-analytics.json';

export interface UseVoteAnalyticsReturn {
  data: VoteAnalytics | null;
  loading: boolean;
  error: Error | null;
}

/** Fetch the build-time vote-analytics artifact once on mount. */
export function useVoteAnalytics(): UseVoteAnalyticsReturn {
  const [data, setData] = useState<VoteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ANALYTICS_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`vote-analytics fetch failed: ${res.status}`);
        return res.json();
      })
      .then((json: VoteAnalytics) => {
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
