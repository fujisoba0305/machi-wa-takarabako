import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config.js';

describe('development API proxy', () => {
it('routes Overpass requests through the deployed fallback proxy', () => {
const proxy = viteConfig.server?.proxy?.['/api/overpass'];

expect(proxy).toMatchObject({
target: 'https://machi-wa-takarabako.vercel.app',
});
expect(proxy).not.toHaveProperty('rewrite');
});

it('routes walking-distance requests to the deployed serverless API', () => {
expect(viteConfig.server?.proxy).toHaveProperty('/api/walking-distance');
});
});
