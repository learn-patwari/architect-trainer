import { existsSync } from 'node:fs';
import { createApp } from './app.ts';
import { DATA_DIR } from './store.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

// Deliberately not PORT: dev tools often set PORT for the web server, which would collide.
const port = Number(process.env.API_PORT || 5379);
const app = createApp();

app.listen(port, '127.0.0.1', (err?: Error) => {
  if (err) {
    console.error(`Could not start on port ${port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Architect Trainer API on http://localhost:${port} (data in ${DATA_DIR})`);
});
