"use client";

import { useState } from "react";

/**
 * A small card thumbnail that pops a larger preview near the cursor on
 * hover. Uses fixed positioning (not CSS scale-on-hover) because these
 * thumbnails sit inside table cells and `overflow-x-auto` containers that
 * would otherwise clip a scaled-up image.
 */
export function CardThumbnail({
  imageUrl,
  className = "h-14 w-10 shrink-0 rounded object-cover",
}: {
  imageUrl: string | null;
  className?: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  if (!imageUrl) return null;

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHover(null)}
    >
      <img src={imageUrl} alt="" loading="lazy" className={className} />
      {hover && (
        <img
          src={imageUrl}
          alt=""
          className="pointer-events-none fixed z-50 w-56 rounded-lg shadow-2xl ring-1 ring-black/10"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 240),
            top: Math.min(hover.y + 16, window.innerHeight - 320),
          }}
        />
      )}
    </div>
  );
}
