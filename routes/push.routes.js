import express from 'express';
import { pb } from '../pocketbase.js'; // Importa tu instancia de PocketBase

const router = express.Router();

router.post('/register-token', async (req, res) => {
  try {
const { token, userId } = req.body;
    // Verificar si los datos son completos
    if (!token) {
      return res.status(400).json({ error: 'Falta el token' });
    }

    // Verificar si el usuario está autenticado (necesitamos su ID)
    const user = pb.authStore.record; // Aquí obtenemos el usuario autenticado
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Verificar si el token ya está registrado para el usuario
    const existing = await pb.collection('devices')
      .getFirstListItem(`token="${token}"`)
      .catch(() => null);

    if (!existing) {
      // Si el token no existe, lo creamos
      await pb.collection('devices').create({
        token,
        user: user.id,    // Usamos el ID del usuario autenticado
        platform: 'web',   // O el tipo de plataforma que corresponda
      });
    }

    // Responder con éxito
    res.json({ success: true });

  } catch (err) {
    console.error('❌ Error al registrar el token:', err);
    res.status(500).json({ error: 'No se pudo registrar el token' });
  }
});

export default router;
