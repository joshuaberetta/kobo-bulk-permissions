import { createServer } from 'node:http';
import { createServerAdapter } from '@whatwg-node/server';
import worker from './src/index.js';

const fetchHandler = (request) => {
  const env = process.env;
  const ctx = {
    waitUntil: (promise) => Promise.resolve(promise),
    passThroughOnException: () => {}
  };
  return worker.fetch(request, env, ctx);
};

const service = createServerAdapter(fetchHandler);
const server = createServer(service);

const port = process.env.PORT || 3000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
