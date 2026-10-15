import type { Plugin } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import walkingTrialAccess from '../api/walking-trial-access';
import overpass from '../api/overpass';

// Development only. Never forwards to a deployed API or calls paid Routes.
export function localApi(): Plugin {
  return {
    name: 'machi-local-api', apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if(path === '/api/walking-trial-access'){const reply={status(code:number){res.statusCode=code;return reply;},json(data:unknown){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return reply;},setHeader(name:string,value:string){res.setHeader(name,value);return reply;}};await walkingTrialAccess({method:req.method,headers:req.headers} as VercelRequest,reply as unknown as VercelResponse);return;}
        if (path !== '/api/overpass' && path !== '/api/walking-distance' && path !== '/api/diagnostics') return next();
        res.setHeader('X-Machi-API-Environment', 'local');
        res.setHeader('Cache-Control', 'no-store');
        const reply = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        if (path === '/api/diagnostics') return reply(200, { environment: 'local', overpass: 'local-handler', walkingDistance: 'disabled-no-paid-calls' });
        if (path === '/api/walking-distance') return reply(503, { error: 'LOCAL_ROUTES_DISABLED', message: 'ローカルでは課金防止のため徒歩距離APIを無効にしています。' });
        if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
        try {
          let body = ''; let size = 0;
          for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 65536) { reply(413, { error: 'Request too large' }); return; } body += chunk; }
          let parsed: unknown;
          try { parsed = JSON.parse(body); } catch { return reply(400, { error: 'Invalid JSON' }); }
          const response = { status(code: number) { res.statusCode = code; return response; }, json(data: unknown) { reply(res.statusCode, data); return response; }, setHeader(name: string, value: string) { res.setHeader(name, value); return response; } };
          await overpass({ method: req.method, body: parsed } as VercelRequest, response as unknown as VercelResponse);
        } catch { if (!res.writableEnded) reply(500, { error: 'Local API failed' }); }
      });
    },
  };
}
