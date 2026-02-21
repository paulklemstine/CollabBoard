/** In-memory cache of board preview blobs as object URLs.
 *  Survives navigation within the SPA but naturally expires on page refresh. */

const cache = new Map<string, string>();

/** Store a preview blob and return its object URL. Revokes any previous URL for this board. */
export function setPreviewBlob(boardId: string, blob: Blob): string {
  const prev = cache.get(boardId);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  cache.set(boardId, url);
  return url;
}

/** Get the cached object URL for a board's preview, if any. */
export function getPreviewUrl(boardId: string): string | undefined {
  return cache.get(boardId);
}

/** Remove and revoke the cached preview for a board. */
export function clearPreview(boardId: string): void {
  const url = cache.get(boardId);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(boardId);
  }
}
