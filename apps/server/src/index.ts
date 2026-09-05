import { createArenaServer } from './server.ts';
try {
  process.loadEnvFile('.env');
} catch {}
const app = createArenaServer();
const port = Number(process.env.PORT ?? 8787);
app.server.listen(port, process.env.HOST ?? '0.0.0.0', () =>
  console.log(`Board Arena listening on ${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void app.close().then(() => {
      app.store.close();
      process.exit(0);
    });
  });
