import express from 'express';
import { pb } from '../pocketbase.js';
import { sendPush } from '../services/push.service.js';

const router = express.Router();

router.post('/appointments', async (req, res) => {
  try {

    const { patientId, professionalId } = req.body;


    // 1. Crear solicitud de cita
    const appointment = await pb.collection('appointments').create({
      patient: patientId,
      professional: professionalId,
      status: 'pending'
    });


    // 2. Crear notificación interna en PocketBase
    await pb.collection('notifications').create({

      user: professionalId,

      type: 'appointment_request',

      title: 'Nueva solicitud de servicio',

      message: 'Tienes una nueva solicitud pendiente',

      read: false,

      appointment: appointment.id,

      data: {
        appointmentId: appointment.id
      }

    });



    // 3. Buscar dispositivos del profesional
    const tokensRes = await pb.collection('devices')
      .getFullList({
        filter: `user="${professionalId}"`
      });


    const tokens = tokensRes.map(t => t.token);



    // 4. Enviar push externo
    await sendPush(tokens, {

      notification: {

        title: 'Nueva solicitud de servicio',

        body: 'Tienes una nueva solicitud pendiente'

      },


      data: {

        appointmentId: appointment.id,

        type: 'appointment_request'

      }

    });



    res.json({
      success:true,
      appointment
    });


  } catch(err){

    console.error(err);

    res.status(500)
    .json({
      error:'Error creando cita'
    });

  }
});


export default router;