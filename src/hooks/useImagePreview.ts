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
    // Filter out PDFs — they're handled by PdfPreviewPage (matches iOS)
    const filtered = images.filter(u => !/\.pdf(\?|$)/i.test(String(u)));
    if (filtered.length === 0) return;
    // Shift index: count PDFs before original idx
    let pdfsBefore = 0;
    for (let i = 0; i <= idx && i < images.length; i++) {
      if (/\.pdf(\?|$)/i.test(String(images[i]))) pdfsBefore++;
    }
    setPreview({ images: filtered, idx: Math.max(0, idx - pdfsBefore) });
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  return { preview, openPreview, closePreview };
}
