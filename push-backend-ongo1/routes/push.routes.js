import express from 'express';
import PocketBase from 'pocketbase';
import { pb, PB_URL } from '../pocketbase.js';

const router = express.Router();

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : '';
}

function escapeFilterValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const userPb = new PocketBase(PB_URL);
  userPb.authStore.save(token, null);

  try {
    const auth = await userPb.collection('users').authRefresh();
    return auth?.record || userPb.authStore.record || userPb.authStore.model;
  } catch {
    return null;
  }
}

router.post('/push/register-token', async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Falta el token' });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const cleanToken = escapeFilterValue(token);
    const existing = await pb.collection('devices')
      .getFirstListItem(`token="${cleanToken}"`)
      .catch(() => null);

    if (existing) {
      await pb.collection('devices').update(existing.id, {
        user: user.id,
        platform,
        active: true,
      });
    } else {
      await pb.collection('devices').create({
        token,
        user: user.id,
        platform,
        active: true,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error al registrar el token:', err.message);
    res.status(500).json({ error: 'No se pudo registrar el token' });
  }
});

router.post('/push/unregister-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Falta el token' });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const cleanToken = escapeFilterValue(token);
    const existing = await pb.collection('devices')
      .getFirstListItem(`token="${cleanToken}" && user="${escapeFilterValue(user.id)}"`)
      .catch(() => null);

    if (existing) {
      await pb.collection('devices').update(existing.id, {
        active: false,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error al desactivar el token:', err.message);
    res.status(500).json({ error: 'No se pudo desactivar el token' });
  }
});

export default router;
