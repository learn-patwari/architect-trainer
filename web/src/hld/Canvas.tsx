import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

/**
 * A minimal structural slice of the Excalidraw imperative API — typed locally so
 * this file doesn't depend on the package's own (frequently-moved) type export
 * paths. Only the handful of methods actually used here.
 */
interface ExcalidrawAPI {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
}

export interface CanvasHandle {
  getElements: () => readonly unknown[];
  /** A PNG of the current scene, base64-encoded with no data: prefix, or null if there's nothing to export. */
  exportImageBase64: () => Promise<string | null>;
}

interface Props {
  initialElements: unknown[];
  onChange: (elements: readonly unknown[]) => void;
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas({ initialElements, onChange }, ref) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  useImperativeHandle(ref, () => ({
    getElements: () => apiRef.current?.getSceneElements() ?? [],
    exportImageBase64: async () => {
      const api = apiRef.current;
      if (!api) return null;
      try {
        const elements = api.getSceneElements();
        if (elements.length === 0) return null;
        const blob = await exportToBlob({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          elements: elements as any,
          appState: { ...api.getAppState(), exportBackground: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          files: api.getFiles() as any,
          mimeType: 'image/png',
        });
        return await blobToBase64(blob);
      } catch {
        return null;
      }
    },
  }));

  return (
    <div className="canvas-wrap">
      <Excalidraw
        excalidrawAPI={(a) => {
          apiRef.current = a as unknown as ExcalidrawAPI;
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialData={{ elements: initialElements as any }}
        onChange={(elements) => onChange(elements)}
      />
    </div>
  );
});

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
