import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { page: 'dashboard' }
  | { page: 'board'; boardId: string };

function parseHash(hash: string): Route {
  const match = hash.match(/^#\/board\/(.+)$/);
  if (match) {
    return { page: 'board', boardId: match[1] };
  }
  return { page: 'dashboard' };
}

function routeToHash(route: Route): string {
  if (route.page === 'board') {
    return `#/board/${route.boardId}`;
  }
  return '#/';
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);

  return { route, navigateTo };
}
