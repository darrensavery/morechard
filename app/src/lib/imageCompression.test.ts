import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper: minimal JPEG with EXIF APP1
function makeJpegWithExif(sizeBytes = 600 * 1024): File {
  const buf = new Uint8Array(sizeBytes);
  buf[0] = 0xFF; buf[1] = 0xD8;  // SOI
  buf[2] = 0xFF; buf[3] = 0xE1;  // APP1 marker
  buf[4] = 0x00; buf[5] = 0x10;  // APP1 length = 16
  buf[6] = 0x45; buf[7] = 0x78; buf[8] = 0x69; buf[9] = 0x66; buf[10] = 0x00; buf[11] = 0x00; // 'Exif\0\0'
  return new File([buf], 'test.jpg', { type: 'image/jpeg' });
}

// Helper: minimal PNG
function makePng(sizeBytes = 600 * 1024): File {
  const buf = new Uint8Array(sizeBytes);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47; // PNG signature
  return new File([buf], 'test.png', { type: 'image/png' });
}

describe('compressImage', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toBlobSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    // Mock createImageBitmap to return a mock ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 2000,
      height: 1500,
      close: vi.fn(),
    }));

    // Mock canvas getContext
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    // Mock canvas toBlob to produce a ~300KB JPEG blob
    toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => {
        const [cb, type] = args as [BlobCallback, string?];
        cb(new Blob([new Uint8Array(300 * 1024)], { type: type ?? 'image/jpeg' }));
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('passes PDF files through unchanged', async () => {
    const { compressImage } = await import('./imageCompression');
    const pdf = new File([new Uint8Array(2 * 1024 * 1024)], 'doc.pdf', { type: 'application/pdf' });
    const result = await compressImage(pdf);
    expect(result).toBe(pdf);
  });

  it('passes images under 500KB through unchanged', async () => {
    const { compressImage } = await import('./imageCompression');
    const small = new File([new Uint8Array(400 * 1024)], 'small.jpg', { type: 'image/jpeg' });
    const result = await compressImage(small);
    expect(result).toBe(small);
  });

  it('throws on files over 10MB after compression', async () => {
    const { compressImage } = await import('./imageCompression');
    // Make toBlob return a blob > 10MB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toBlobSpy.mockImplementation((...args: any[]) => {
      const [cb, type] = args as [BlobCallback, string?];
      cb(new Blob([new Uint8Array(11 * 1024 * 1024)], { type: type ?? 'image/jpeg' }));
    });
    const large = makePng(600 * 1024);
    await expect(compressImage(large)).rejects.toThrow('Image too large after compression');
  });

  it('returns a File object', async () => {
    const { compressImage } = await import('./imageCompression');
    const jpeg = makeJpegWithExif();
    const result = await compressImage(jpeg);
    expect(result).toBeInstanceOf(File);
  });

  it('compresses large JPEG to JPEG type', async () => {
    const { compressImage } = await import('./imageCompression');
    const jpeg = makeJpegWithExif();
    const result = await compressImage(jpeg);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toMatch(/\.jpg$/);
  });

  it('preserves EXIF APP1 from JPEG when compressing', async () => {
    const { compressImage } = await import('./imageCompression');
    const jpeg = makeJpegWithExif();
    const result = await compressImage(jpeg);
    // Read first bytes and check for SOI + APP1 marker
    // Use FileReader because jsdom File doesn't implement .arrayBuffer()
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(result);
    });
    const view = new Uint8Array(buf);
    expect(view[0]).toBe(0xFF);
    expect(view[1]).toBe(0xD8); // SOI
    expect(view[2]).toBe(0xFF);
    expect(view[3]).toBe(0xE1); // APP1 marker
  });

  it('passes HEIC through if createImageBitmap fails', async () => {
    const { compressImage } = await import('./imageCompression');
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported format')));
    const heic = new File([new Uint8Array(600 * 1024)], 'photo.heic', { type: 'image/heic' });
    const result = await compressImage(heic);
    expect(result).toBe(heic);
  });
});
