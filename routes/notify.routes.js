import express from 'express';
import { pb } from '../pocketbase.js';
import { sendPush } from '../services/push.service.js';

const router = express.Router();

async function getActiveTokens(userId) {
  const devices = await pb.collection('devices').getFullList({
    filter: `user="${userId}"`,
    requestKey: null,
  });

  return [
    ...new Set(
      devices
        .filter(d => d.active !== false)
        .map(d => d.token)
        .filter(Boolean)
    ),
  ];
}

function getUserId(value) {
  return value?.id || value;
}

async function createNotification({
  userId,
  type,
  title,
  message,
  appointmentId,
  data = {},
}) {
  return await pb.collection('notifications').create({
    userId,
    type,
    title,
    message,
    read: false,
    appointment: appointmentId,
    data: {
      appointmentId,
      type,
      ...data,
    },
  });
}

router.post('/appointments/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);

    if (!professionalId) {
      return res.status(400).json({ error: 'Profesional no asociado a la cita' });
    }

    const title = 'Nueva solicitud de servicio';
    const message = 'Tienes una solicitud pendiente por revisar';
    const url = '/agenda/professional-agenda';

    await createNotification({
      userId: professionalId,
      type: 'NEW_APPOINTMENT',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El profesional no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'NEW_APPOINTMENT',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/notify:', err);
    return res.status(500).json({
      error: 'Error enviando notificación',
      details: err.message,
    });
  }
});

router.post('/push/test-user', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' });
    }

    const tokens = await getActiveTokens(userId);

    if (!tokens.length) {
      return res.json({
        success: false,
        reason: 'Este usuario no tiene tokens activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: {
        title: 'Prueba Klinia',
        body: 'Las notificaciones push ya están funcionando',
      },
      data: {
        type: 'TEST',
        url: '/agenda',
      },
    });

    return res.json({
      success: true,
      tokens: tokens.length,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /push/test-user:', err);
    return res.status(500).json({
      error: err.message,
    });
  }
});

router.post('/appointments/accepted/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Cita aceptada';
    const message = `${professionalName} aceptó tu cita.`;
    const url = '/agenda/patient-agenda';

    await createNotification({
      userId: patientId,
      type: 'APPOINTMENT_ACCEPTED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_ACCEPTED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/accepted/notify:', err);
    return res.status(500).json({
      error: 'Error notificando cita aceptada',
      details: err.message,
    });
  }
});

router.post('/appointments/rejected/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Cita rechazada';
    const message = `${professionalName} no pudo aceptar tu cita.`;
    const url = '/agenda/patient-agenda';

    await createNotification({
      userId: patientId,
      type: 'APPOINTMENT_REJECTED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_REJECTED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error notificando rechazo:', err);
    return res.status(500).json({
      error: 'Error notificando cita rechazada',
      details: err.message,
    });
  }
});

router.post('/appointments/cancelled/notify', async (req, res) => {
  try {
    const { appointmentId, cancelledBy } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Cita cancelada';
    const message =
      cancelledBy === 'professional'
        ? `${professionalName} canceló tu cita.`
        : 'Tu cita fue cancelada.';

    const url = '/agenda/patient-agenda';

    await createNotification({
      userId: patientId,
      type: 'APPOINTMENT_CANCELLED',
      title,
      message,
      appointmentId: appointment.id,
      data: {
        cancelledBy: cancelledBy || 'professional',
        url,
      },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_CANCELLED',
        cancelledBy: String(cancelledBy || 'professional'),
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/cancelled/notify:', err);
    return res.status(500).json({
      error: 'Error notificando cita cancelada',
      details: err.message,
    });
  }
});

router.post('/appointments/cancelled-by-patient/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);

    if (!professionalId) {
      return res.status(400).json({ error: 'Profesional no asociado a la cita' });
    }

    const patientName =
      appointment.expand?.patient?.name ||
      appointment.expand?.patient?.username ||
      'El paciente';

    const title = 'Cita cancelada';
    const message = `${patientName} canceló la cita.`;
    const url = '/agenda/professional-agenda';

    await createNotification({
      userId: professionalId,
      type: 'APPOINTMENT_CANCELLED_BY_PATIENT',
      title,
      message,
      appointmentId: appointment.id,
      data: {
        cancelledBy: 'patient',
        url,
      },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El profesional no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_CANCELLED_BY_PATIENT',
        cancelledBy: 'patient',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/cancelled-by-patient/notify:', err);
    return res.status(500).json({
      error: 'Error notificando cancelación por paciente',
      details: err.message,
    });
  }
});

router.post('/appointments/rescheduled/notify', async (req, res) => {
  try {
    const { appointmentId, rescheduledBy } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);
    const professionalId = getUserId(appointment.professional);

    const patientName =
      appointment.expand?.patient?.name ||
      appointment.expand?.patient?.username ||
      'El paciente';

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const targetUserId = rescheduledBy === 'patient' ? professionalId : patientId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Usuario destino no encontrado' });
    }

    const url =
      rescheduledBy === 'patient'
        ? '/agenda/professional-agenda'
        : '/agenda/patient-agenda';

    const message =
      rescheduledBy === 'patient'
        ? `${patientName} reprogramó la cita.`
        : `${professionalName} reprogramó tu cita.`;

    const title = 'Cita reprogramada';

    await createNotification({
      userId: targetUserId,
      type: 'APPOINTMENT_RESCHEDULED',
      title,
      message,
      appointmentId: appointment.id,
      data: {
        rescheduledBy: rescheduledBy || '',
        url,
      },
    });

    const tokens = await getActiveTokens(targetUserId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'Usuario sin dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_RESCHEDULED',
        rescheduledBy: String(rescheduledBy || ''),
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/rescheduled/notify:', err);
    return res.status(500).json({
      error: 'Error notificando reprogramación',
      details: err.message,
    });
  }
});

router.post('/appointments/on-the-way/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Profesional en camino';
    const message = `${professionalName} va en camino a tu domicilio.`;
    const url = `/map-tracking/${appointment.id}`;

    await createNotification({
      userId: patientId,
      type: 'PROFESSIONAL_ON_THE_WAY',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'PROFESSIONAL_ON_THE_WAY',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/on-the-way/notify:', err);
    return res.status(500).json({
      error: 'Error notificando profesional en camino',
      details: err.message,
    });
  }
});

router.post('/appointments/payment-pending/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);

    const title = 'Nuevo paciente interesado';
    const message = 'Un paciente inició el proceso de reserva.';
    const url = '/agenda';

    await createNotification({
      userId: professionalId,
      type: 'PAYMENT_PENDING',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({ success: true, pushSent: false });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'PAYMENT_PENDING',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error payment-pending:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/payment-confirmed/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);

    const title = 'Pago confirmado';
    const message = 'La cita fue pagada. Puedes aceptarla o rechazarla.';
    const url = '/agenda';

    await createNotification({
      userId: professionalId,
      type: 'PAYMENT_CONFIRMED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({ success: true, pushSent: false });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'PAYMENT_CONFIRMED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error payment-confirmed:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/started/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Consulta iniciada';

    const message =
      `${professionalName} inició la consulta. Ingresa a Klinia y valida el código de seguridad.`;

    const url = '/agenda/patient-agenda';

    await createNotification({
      userId: patientId,
      type: 'APPOINTMENT_STARTED',
      title,
      message,
      appointmentId: appointment.id,
      data: {
        url,
      },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: {
        title,
        body: message,
      },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_STARTED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/started/notify:', err);

    return res.status(500).json({
      error: 'Error notificando inicio de consulta',
      details: err.message,
    });
  }
});
router.post('/appointments/completed/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    if (!patientId) {
      return res.status(400).json({ error: 'Paciente no asociado a la cita' });
    }

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Atención finalizada';
    const message = `${professionalName} finalizó la cita. Cuéntanos cómo fue tu experiencia.`;
    const url = '/agenda';

    await createNotification({
      userId: patientId,
      type: 'APPOINTMENT_COMPLETED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El paciente no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'APPOINTMENT_COMPLETED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /appointments/completed/notify:', err);
    return res.status(500).json({
      error: 'Error notificando cita finalizada',
      details: err.message,
    });
  }
});
router.post('/appointments/review-received/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);
    const patientName =
      appointment.expand?.patient?.name ||
      appointment.expand?.patient?.username ||
      'Un paciente';

    const title = 'Nueva reseña recibida';
    const message = `${patientName} calificó tu atención.`;
    const url = '/agenda';

    await createNotification({
      userId: professionalId,
      type: 'REVIEW_RECEIVED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({ success: true, pushSent: false });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'REVIEW_RECEIVED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error review-received:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/tip-received/notify', async (req, res) => {
  try {
    const { appointmentId, tipAmount } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const professionalId = getUserId(appointment.professional);
    const patientName =
      appointment.expand?.patient?.name ||
      appointment.expand?.patient?.username ||
      'Un paciente';

    const title = 'Propina recibida';
    const message = `${patientName} te dejó una propina${tipAmount ? ` de $${Number(tipAmount).toLocaleString('es-CO')} COP` : ''}.`;
    const url = '/agenda';

    await createNotification({
      userId: professionalId,
      type: 'TIP_RECEIVED',
      title,
      message,
      appointmentId: appointment.id,
      data: {
        url,
        tipAmount: tipAmount ? String(tipAmount) : '',
      },
    });

    const tokens = await getActiveTokens(professionalId);

    if (!tokens.length) {
      return res.json({ success: true, pushSent: false });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'TIP_RECEIVED',
        tipAmount: tipAmount ? String(tipAmount) : '',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error tip-received:', err);
    return res.status(500).json({ error: err.message });
  }
});
router.post('/appointments/teleconsultation-started/notify', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId requerido' });
    }

    const appointment = await pb.collection('appointments').getOne(appointmentId, {
      expand: 'professional,patient,service',
    });

    const patientId = getUserId(appointment.patient);

    const professionalName =
      appointment.expand?.professional?.name ||
      appointment.expand?.professional?.businessName ||
      'El profesional';

    const title = 'Teleconsulta iniciada';
    const message = `${professionalName} inició la teleconsulta. Puedes ingresar a la videollamada.`;
    const url = '/agenda';

    await createNotification({
      userId: patientId,
      type: 'TELECONSULTATION_STARTED',
      title,
      message,
      appointmentId: appointment.id,
      data: { url },
    });

    const tokens = await getActiveTokens(patientId);

    if (!tokens.length) {
      return res.json({ success: true, pushSent: false });
    }

    const response = await sendPush(tokens, {
      notification: { title, body: message },
      data: {
        appointmentId: String(appointment.id),
        type: 'TELECONSULTATION_STARTED',
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error teleconsultation-started:', err);
    return res.status(500).json({ error: err.message });
  }
});
router.post('/chat/notify', async (req, res) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId requerido' });
    }

    const messageRecord = await pb.collection('messages').getOne(messageId, {
      expand: 'sender,receiver,appointment',
      requestKey: null,
    });

    const receiverId = getUserId(messageRecord.receiver);
    const senderId = getUserId(messageRecord.sender);

    if (!receiverId) {
      return res.status(400).json({ error: 'Receptor no asociado al mensaje' });
    }

    const senderName =
      messageRecord.expand?.sender?.name ||
      messageRecord.expand?.sender?.username ||
      'Klinia';

    const title = `Nuevo mensaje de ${senderName}`;
    const body = messageRecord.messages || 'Tienes un nuevo mensaje en Klinia';

    const appointmentId = messageRecord.appointment || '';
    const url = `/chat-detail/${senderId}?appointmentId=${appointmentId}`;

    await createNotification({
      userId: receiverId,
      type: 'CHAT_MESSAGE',
      title,
      message: body,
      appointmentId: appointmentId || null,
      data: {
        url,
        messageId: messageRecord.id,
        senderId,
      },
    });

    const tokens = await getActiveTokens(receiverId);

    if (!tokens.length) {
      return res.json({
        success: true,
        pushSent: false,
        reason: 'El receptor no tiene dispositivos activos',
      });
    }

    const response = await sendPush(tokens, {
      notification: {
        title,
        body,
      },
      data: {
        type: 'CHAT_MESSAGE',
        messageId: String(messageRecord.id),
        senderId: String(senderId || ''),
        appointmentId: String(appointmentId || ''),
        url,
      },
    });

    return res.json({
      success: true,
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
    });

  } catch (err) {
    console.error('❌ Error en /chat/notify:', err);

    return res.status(500).json({
      error: 'Error notificando mensaje de chat',
      details: err.message,
    });
  }
});
export default router;