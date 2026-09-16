import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { handleGeminiRequest } from './server/gemini-server.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'gemini-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/gemini', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });

            req.on('end', async () => {
              try {
                const parsedBody = JSON.parse(body || '{}');
                const result = await handleGeminiRequest(parsedBody, geminiApiKey);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify(result));
              } catch (error) {
                console.error('[Gemini Server Middleware Error]:', error?.message || error);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = error?.status || 500;
                res.end(JSON.stringify({
                  error: error?.message || 'Server-side Gemini processing failed'
                }));
              }
            });
          });
        }
      }
    ],
  };
});
