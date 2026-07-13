import express from 'express';
import cors from 'cors';

import pushRoutes from './routes/push.routes.js';
import appointmentRoutes from './routes/appointments.routes.js';
import notifyRoutes from './routes/notify.routes.js';

import { startReminderWorker } from './services/reminder.service.js';
import { startAvailabilityWorker } from './services/availability.service.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use(pushRoutes);
app.use(appointmentRoutes);
app.use(notifyRoutes);

app.listen(3001, '0.0.0.0', () => {
  console.log('🚀 Backend escuchando en http://localhost:3001');

  startReminderWorker();
  startAvailabilityWorker();
});