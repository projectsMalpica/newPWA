import express from 'express';
import cors from 'cors';

import pushRoutes from './routes/push.routes.js';
import notifyRoutes from './routes/notify.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ongo-push-backend' });
});

app.use(pushRoutes);
app.use(notifyRoutes);

app.listen(3001, '0.0.0.0', () => {
  console.log('Backend ONGO escuchando en http://localhost:3001');
});
