// app/src/components/dashboard/ReceiptPicker.tsx
import { useRef, useState } from 'react';
import { compressImage } from '../../lib/imageCompression';

type Props = {
  onFile: (file: File) => void;  // called when user picks + compresses a file
  onError: (msg: string) => void;
  existingReceiptKey?: string | null; // if set, show "Replace" copy
};

export function ReceiptPicker({ onFile, onError, existingReceiptKey }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setPreview(url);
      onFile(compressed);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not process image');
    } finally {
      setCompressing(false);
    }
  }

  const isPdf = preview?.includes('pdf') || false; // rough check — we use blob URLs

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {/* Camera button — excludes HEIC via accept attribute */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 border border-[var(--color-border)] rounded-xl py-3 text-sm font-medium text-[var(--color-text)]"
        >
          📷 Take photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 border border-[var(--color-border)] rounded-xl py-3 text-sm font-medium text-[var(--color-text)]"
        >
          🖼 {existingReceiptKey ? 'Replace' : 'Upload'}
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {/* Preview */}
      {compressing && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">Optimising image…</p>
      )}
      {preview && !compressing && (
        <div className="relative rounded-xl overflow-hidden border border-[var(--color-border)]">
          {isPdf ? (
            <div className="flex items-center gap-2 p-4 bg-[var(--color-surface-raised)]">
              <span className="text-2xl">📄</span>
              <span className="text-sm font-medium">PDF receipt ready</span>
            </div>
          ) : (
            <img src={preview} alt="Receipt preview" className="w-full max-h-48 object-cover" />
          )}
        </div>
      )}
    </div>
  );
}
