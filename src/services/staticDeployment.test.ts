import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../data/staticFacilityManifest.json';

describe('production static assets', () => {
  it.each([manifest.dataset, manifest.region])('matches integrity and cache rules for $url', asset => {
    const data = readFileSync('public' + asset.url);
    expect(data.byteLength).toBe(asset.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.headers).toContainEqual({ source: asset.url, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] });
  });
  it('includes attribution and share-alike notice with the downloadable database', () => {
    const notice = readFileSync('public/facilities-local-v1/README.md', 'utf8');
    expect(notice).toContain('OpenStreetMap contributors');
    expect(notice).toContain('offered under ODbL 1.0');
  });
});
