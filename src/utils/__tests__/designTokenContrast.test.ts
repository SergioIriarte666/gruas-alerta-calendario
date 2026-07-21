import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Hsl = [number, number, number];

const css = readFileSync(
  resolve(process.cwd(), 'src/index.css'),
  'utf8',
);

const extractBlock = (selector: ':root' | '.dark') => {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('}', start);

  if (start === -1 || end === -1) {
    throw new Error(`No se encontró el bloque ${selector} en index.css`);
  }

  return css.slice(start, end);
};

const readHslToken = (block: string, token: string): Hsl => {
  const match = block.match(
    new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`),
  );

  if (!match) {
    throw new Error(`El token --${token} no contiene un valor HSL directo`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const hslToRgb = ([hue, saturation, lightness]: Hsl) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = l - chroma / 2;
  let rgb: [number, number, number];

  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  return rgb.map((channel) => channel + offset);
};

const relativeLuminance = (hsl: Hsl) =>
  hslToRgb(hsl)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

const contrastRatio = (first: Hsl, second: Hsl) => {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

describe.each([':root', '.dark'] as const)(
  'contraste de tokens visuales en %s',
  (selector) => {
    const block = extractBlock(selector);
    const states = ['success', 'warning', 'danger', 'info'] as const;

    it.each(states)('mantiene texto AA sobre fondo sólido %s', (state) => {
      const ratio = contrastRatio(
        readHslToken(block, state),
        readHslToken(block, `${state}-foreground`),
      );

      expect(ratio, `${state} sólido tiene contraste ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    it.each(states)('mantiene texto AA sobre fondo suave %s', (state) => {
      const ratio = contrastRatio(
        readHslToken(block, `${state}-soft`),
        readHslToken(block, `${state}-text`),
      );

      expect(ratio, `${state} suave tiene contraste ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    it('mantiene visible el límite de los controles', () => {
      const ratio = contrastRatio(
        readHslToken(block, 'background'),
        readHslToken(block, 'control-border'),
      );

      expect(ratio, `el borde del control tiene contraste ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  },
);
