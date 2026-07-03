import {useState} from 'react';

// Keep the historical key so a token saved from reveal-admin is reused by the
// image tool with no re-entry. Renaming it would silently drop saved tokens.
const KEY = 'inkweave.reveal-admin.gh-token';

export interface UseGithubToken {
  token: string | null;
  setToken: (t: string) => void;
  clearToken: () => void;
}

export function useGithubToken(): UseGithubToken {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  const setToken = (t: string) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable — keep in memory only */
    }
    setTokenState(t);
  };

  const clearToken = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setTokenState(null);
  };

  return {token, setToken, clearToken};
}
