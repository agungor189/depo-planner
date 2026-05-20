import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'path';
import {defineConfig} from 'vite';

const sharedStateFile = path.resolve(__dirname, 'data', 'warehouse-state.json');

async function readJsonBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function sharedWarehouseStatePlugin() {
  return {
    name: 'shared-warehouse-state',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/warehouse-state', async (req, res, next) => {
        if (!req.url?.startsWith('/')) return next();

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        try {
          if (req.method === 'GET') {
            const content = await fs.readFile(sharedStateFile, 'utf8').catch(() => '');
            res.end(content || JSON.stringify({ activePlanId: null, plans: [] }));
            return;
          }

          if (req.method === 'PUT') {
            const data = await readJsonBody(req);
            if (!data || !Array.isArray(data.plans)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid warehouse state' }));
              return;
            }

            await fs.mkdir(path.dirname(sharedStateFile), { recursive: true });
            await fs.writeFile(sharedStateFile, JSON.stringify(data, null, 2), 'utf8');
            res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [sharedWarehouseStatePlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
