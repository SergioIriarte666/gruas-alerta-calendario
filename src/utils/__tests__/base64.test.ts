import { describe, expect, it } from 'vitest';
import { arrayBufferToBase64 } from '@/utils/base64';

describe('arrayBufferToBase64', () => {
  it('codifica un adjunto grande sin desbordar la pila y conserva sus bytes', () => {
    // 2 MB supera ampliamente el límite de argumentos que hacía fallar el spread anterior.
    const bytes = new Uint8Array(2 * 1024 * 1024);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;

    const encoded = arrayBufferToBase64(bytes.buffer);
    const decoded = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));

    expect(decoded).toHaveLength(bytes.length);
    expect(decoded[0]).toBe(bytes[0]);
    expect(decoded[1_000_000]).toBe(bytes[1_000_000]);
    expect(decoded[bytes.length - 1]).toBe(bytes[bytes.length - 1]);
  });
});
