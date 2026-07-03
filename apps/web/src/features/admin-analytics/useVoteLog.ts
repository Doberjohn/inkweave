import {useEffect, useState} from 'react';
import type {VoteLog} from './voteLogTypes';

const VOTE_LOG_PATH = '/data/vote-log.json';

export interface UseVoteLogReturn {
  data: VoteLog | null;
  loading: boolean;
  error: Error | null;
}

/** Fetch the build-time vote-log artifact once on mount. */
export function useVoteLog(): UseVoteLogReturn {
  const [data, setData] = useState<VoteLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(VOTE_LOG_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`vote-log fetch failed: ${res.status}`);
        return res.json();
      })
      .then((json: VoteLog) => {
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
