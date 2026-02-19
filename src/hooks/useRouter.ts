import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { page: 'dashboard' }
  | { page: 'board'; boardId: string };

function parsePath(pathname: string): Route {
  // Support both new path-based (/boardId) and legacy hash-based (#/board/boardId) routes
  const match = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
  if (match) {
    return { page: 'board', boardId: match[1] };
  }
  return { page: 'dashboard' };
}

function parseLocation(): Route {
  // Check hash first for backward compatibility with old URLs
  const hash = window.location.hash;
  if (hash) {
    const hashMatch = hash.match(/^#\/board\/(.+)$/);
    if (hashMatch) {
      // Redirect legacy hash URL to clean path
      const boardId = hashMatch[1];
      window.history.replaceState(null, '', `/${boardId}`);
      return { page: 'board', boardId };
    }
  }
  return parsePath(window.location.pathname);
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseLocation());

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((r: Route) => {
    const path = r.page === 'board' ? `/${r.boardId}` : '/';
    window.history.pushState(null, '', path);
    setRoute(r);
  }, []);

  return { route, navigateTo };
}
