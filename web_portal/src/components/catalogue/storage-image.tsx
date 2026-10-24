"use client";

import React, { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

const isUrl = (s: string) => /^(https?:|data:|blob:)/.test(s);

/**
 * Shows an image from Firebase Storage. Each source is a full URL or a Storage path
 * (e.g. `products/tiles/X_face1.jpeg`); they are tried in order until one resolves.
 */
export function StorageImage({
  sources,
  alt,
  className,
  fallback,
}: {
  sources: string[];
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const key = sources.join("|");
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl("");
    setFailed(false);
    (async () => {
      for (const src of sources.filter(Boolean)) {
        if (isUrl(src)) {
          if (!cancelled) setUrl(src);
          return;
        }
        try {
          const u = await getDownloadURL(ref(storage, src));
          if (!cancelled) setUrl(u);
          return;
        } catch {
          // try the next candidate
        }
      }
      if (!cancelled) setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!url) return <>{failed ? fallback : null}</>;
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}

/** Storage path of the webp thumbnail generated for a `products/tiles/...` image. */
export function tileThumbnailPath(path: string): string {
  const m = path.match(/^products\/tiles\/(.+)\.[A-Za-z0-9]+$/);
  return m ? `products/thumbnails/tiles/${m[1]}.webp` : "";
}
