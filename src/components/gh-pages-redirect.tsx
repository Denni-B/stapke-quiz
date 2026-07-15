"use client";

import { useEffect } from "react";

export function GhPagesRedirect() {
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if (!basePath) {
      return;
    }

    const match = window.location.search.match(/^\?\/?(.*)/);
    if (!match) {
      return;
    }

    const restoredPath = match[1].replace(/~and~/g, "&");
    const nextPath = `${basePath}/${restoredPath}${window.location.hash}`;
    window.history.replaceState(null, "", nextPath);
  }, []);

  return null;
}
