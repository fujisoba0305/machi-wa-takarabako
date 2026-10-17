import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNearbyCafes } from './overpass';

describe('getNearbyCafes', () => {
afterEach(() => {
vi.unstubAllGlobals();
vi.restoreAllMocks();
});

it('sends the minimal cafe query as JSON to the fallback proxy', async () => {
vi.stubGlobal('window', {
location: { hostname: 'localhost' },
});
const fetchMock = vi.fn().mockResolvedValue({
ok: true,
json: async () => ({ elements: [] }),
});
vi.stubGlobal('fetch', fetchMock);

await getNearbyCafes(35.681236, 139.767125, 4000);

expect(fetchMock).toHaveBeenCalledOnce();
const [url, options] = fetchMock.mock.calls[0];
expect(url).toBe('/api/overpass');
expect(options).toMatchObject({
method: 'POST',
headers: { 'Content-Type': 'application/json' },
});

const payload = JSON.parse(options.body);
expect(payload.query).toContain('[out:json][timeout:12]');
expect(payload.query).toContain(
'node["amenity"="cafe"][name](around:4000,35.681236,139.767125);'
);
expect(payload.query).toContain('out center;');
expect(payload.query).not.toContain('way[');
expect(payload.query).not.toContain('relation[');
});
});

it('filters inactive facilities before reusing a successful response',async()=>{
 const closed={type:'node',id:701,tags:{name:'店(閉業)',amenity:'cafe'}},open={type:'node',id:702,tags:{name:'営業未確認カフェ',amenity:'cafe'}};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[closed,open]})}));
 expect(await getNearbyCafes(35.12345,139.12345,1234)).toEqual([open]);expect(await getNearbyCafes(35.12345,139.12345,1234)).toEqual([open]);vi.unstubAllGlobals();
});
