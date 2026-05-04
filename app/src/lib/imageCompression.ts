const SIZE_THRESHOLD = 500 * 1024;       // 500 KB
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Compress an image File:
 *  - PDF → pass through
 *  - < 500 KB → pass through
 *  - HEIC → try createImageBitmap; on failure pass through (up to 10 MB cap)
 *  - JPEG / PNG / WebP > 500 KB → resize longest edge ≤ 1600 px, re-encode as JPEG @ 0.82
 *  - JPEG inputs: splice original EXIF APP1 back into the output
 *  - Result > 10 MB → throw
 *
 * TODO: offload to Web Worker for files > 2 MB (nice-to-have for UI smoothness)
 */
export async function compressImage(file: File): Promise<File> {
  // PDF — pass through
  if (file.type === 'application/pdf') return file;

  // Small file — pass through
  if (file.size < SIZE_THRESHOLD) return file;

  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic');

  if (isHeic) {
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      // createImageBitmap can't decode HEIC in most browsers — pass through
      return file;
    }
    return runPipeline(file, bmp);
  }

  // Everything else (JPEG, PNG, WebP, …)
  const bmp = await createImageBitmap(file);
  return runPipeline(file, bmp);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function runPipeline(originalFile: File, bmp: ImageBitmap): Promise<File> {
  const isJpeg =
    originalFile.type === 'image/jpeg' ||
    originalFile.type === 'image/jpg';

  // Grab EXIF before we do anything else (reads first 64 KB)
  let app1Bytes: Uint8Array | null = null;
  if (isJpeg) {
    app1Bytes = await extractApp1(originalFile);
  }

  // Resize
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (typeof bmp.close === 'function') bmp.close();

  // Encode
  const resultBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });

  if (resultBlob === null) throw new Error('Canvas toBlob returned null');
  if (resultBlob.size > MAX_OUTPUT_SIZE) {
    throw new Error('Image too large after compression — try a smaller photo.');
  }

  // Splice EXIF back in for JPEG inputs
  const finalBlob = isJpeg && app1Bytes
    ? await spliceApp1(app1Bytes, resultBlob)
    : resultBlob;

  const outName = originalFile.name.replace(/\.[^.]+$/, '.jpg');
  return new File([finalBlob], outName, { type: 'image/jpeg' });
}

/** Read a Blob as an ArrayBuffer using FileReader (compatible with jsdom). */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Read the first 64 KB of a JPEG and extract the APP1 segment (marker + length
 * field + data) if it immediately follows the SOI marker.
 *
 * Returns the raw bytes of [FF E1 <len-hi> <len-lo> <data...>], or null if not
 * found.
 */
async function extractApp1(file: File): Promise<Uint8Array | null> {
  const header = await blobToArrayBuffer(file.slice(0, 65536));
  const view = new Uint8Array(header);

  // Must start with SOI (FF D8)
  if (view[0] !== 0xFF || view[1] !== 0xD8) return null;

  // APP1 marker should be at offset 2
  if (view[2] !== 0xFF || view[3] !== 0xE1) return null;

  // APP1 length is big-endian at bytes 4-5; includes the 2 length bytes but
  // NOT the 2-byte marker.
  const app1DataLen = (view[4] << 8) | view[5]; // includes its own 2 bytes
  const totalBytes = 2 /* marker */ + app1DataLen;

  if (totalBytes > view.length) return null;

  return view.slice(2, 2 + totalBytes);
}

/**
 * Build a new JPEG by inserting app1Bytes right after the SOI marker of
 * compressedBlob.
 */
async function spliceApp1(app1Bytes: Uint8Array, compressedBlob: Blob): Promise<Blob> {
  const compressedBuf = await blobToArrayBuffer(compressedBlob);
  const compressed = new Uint8Array(compressedBuf);

  // SOI (2 bytes) + APP1 + rest of compressed stream (skip SOI in compressed)
  const totalLen = 2 + app1Bytes.length + (compressed.length - 2);
  const out = new Uint8Array(totalLen);
  let offset = 0;

  // SOI
  out[offset++] = 0xFF;
  out[offset++] = 0xD8;

  // APP1 bytes
  out.set(app1Bytes, offset);
  offset += app1Bytes.length;

  // Rest of compressed stream, skipping its own SOI
  out.set(compressed.slice(2), offset);

  return new Blob([out], { type: 'image/jpeg' });
}
