import { useState, useCallback } from 'react';

export interface PreviewState {
  images: string[];
  idx: number;
}

/**
 * Shared image preview state management.
 *
 * Usage:
 *   const { preview, openPreview, closePreview } = useImagePreview();
 *
 *   // Trigger
 *   <Thumbnail onPress={() => openPreview(imageUrls, 0)} />
 *
 *   // Render (once, at bottom of component)
 *   <ImagePreview
 *     images={preview.images}
 *     initialIdx={preview.idx}
 *     visible={preview !== null}
 *     onClose={closePreview}
 *   />
 */
export function useImagePreview() {
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const openPreview = useCallback((images: string[], idx: number = 0) => {
    if (!images || images.length === 0) return;
    setPreview({ images, idx });
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  return { preview, openPreview, closePreview };
}
