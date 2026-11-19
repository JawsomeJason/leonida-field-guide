// Dev-only: draws the app icons into public/icons/. Not part of the build; the PNGs are committed.
// Usage: CHROME="/path/to/Google Chrome for Testing" node scripts/make-icons.mjs
// The mark is the sunset dome over two bars from public/favicon.svg, on the night background.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME;
if (!chrome) throw new Error('Set CHROME to a Chrome or Chromium binary.');

const mark = `
  <path d="M12 40a20 20 0 0 1 40 0z" fill="url(#s)"/>
  <rect x="8" y="44" width="48" height="4" rx="2" fill="#a3acd0"/>
  <rect x="16" y="51" width="32" height="4" rx="2" fill="#a3acd0"/>`;
const defs = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6f91"/><stop offset="1" stop-color="#3ee6e0"/></linearGradient></defs>`;

// "any": rounded tile, mark fills most of it. "maskable": full bleed, mark inside the central safe circle.
const any = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">${defs}<rect width="64" height="64" rx="14" fill="#0b1020"/>${mark}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="#0b1020"/><g transform="translate(76.8 46) scale(5.6)">${mark}</g></svg>`;

const dir = mkdtempSync(join(tmpdir(), 'icons-'));
mkdirSync('public/icons', { recursive: true });
const shoot = (svg, size, out) => {
  const src = join(dir, `${out}.svg`);
  writeFileSync(src, svg.replace('width="512" height="512"', `width="${size}" height="${size}"`));
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${size},${size}`,
    `--screenshot=public/icons/${out}.png`, `file://${src}`,
  ], { stdio: 'ignore' });
};
shoot(any, 192, 'icon-192');
shoot(any, 512, 'icon-512');
shoot(maskable, 512, 'icon-maskable-512');
