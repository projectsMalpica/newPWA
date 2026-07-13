import express from 'express';
import PocketBase from 'pocketbase';
import { pb, PB_URL } from '../pocketbase.js';
import { sendPush } from '../services/push.service.js';

const router = express.Router();

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : '';
}

function escapeFilterValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function idOf(value) {
  return value?.id || value || '';
}

function toFirebaseData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
  );
}

async function authenticate(req) {
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

async function getActiveTokens(userId) {
  const cleanUserId = escapeFilterValue(userId);
  const devices = await pb.collection('devices').getFullList({
    filter: `user="${cleanUserId}" && active!=false`,
    requestKey: null,
  });

  return [...new Set(devices.map(device => device.token).filter(Boolean))];
}

async function disableInvalidTokens(tokens = []) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];

  for (const token of uniqueTokens) {
    const cleanToken = escapeFilterValue(token);
    const devices = await pb.collection('devices').getFullList({
      filter: `token="${cleanToken}"`,
      requestKey: null,
    });

    for (const device of devices) {
      await pb.collection('devices').update(device.id, { active: false });
    }
  }
}

async function createNotificationOnce({ userId, fromUser = '', type, title, message, referenceId, data = {} }) {
  const cleanUserId = escapeFilterValue(userId);
  const cleanType = escapeFilterValue(type);
  const cleanReferenceId = escapeFilterValue(referenceId);

  const existing = await pb.collection('notifications')
    .getFirstListItem(`user="${cleanUserId}" && type="${cleanType}" && referenceId="${cleanReferenceId}"`)
    .catch(() => null);

  if (existing) {
    return { record: existing, created: false };
  }

  const payload = {
    user: userId,
    type,
    title,
    message,
    read: false,
    referenceId,
    data: toFirebaseData(data),
  };

  if (fromUser) {
    payload.fromUser = fromUser;
  }

  const record = await pb.collection('notifications').create(payload, { requestKey: null });
  return { record, created: true };
}

async function sendNotificationPush({ userId, title, body, data }) {
  const tokens = await getActiveTokens(userId);

  if (!tokens.length) {
    return { pushSent: false, reason: 'Usuario sin dispositivos activos' };
  }

  try {
    const response = await sendPush(tokens, {
      notification: { title, body },
      data: toFirebaseData(data),
    });

    if (response?.invalidTokens?.length) {
      await disableInvalidTokens(response.invalidTokens);
    }

    return {
      pushSent: true,
      successCount: response?.successCount ?? 0,
      failureCount: response?.failureCount ?? 0,
      invalidTokenCount: response?.invalidTokens?.length ?? 0,
    };
  } catch (error) {
    console.error('Fallo FCM no bloqueante:', error.message);
    return { pushSent: false, fcmError: error.message };
  }
}

async function getUserName(userId) {
  if (!userId) return 'Usuario';

  const user = await pb.collection('users').getOne(userId, { requestKey: null }).catch(() => null);
  return user?.name || user?.username || user?.email || 'Usuario';
}

async function getProfile(collection, id) {
  return pb.collection(collection).getOne(id, { requestKey: null }).catch(() => null);
}

async function getProfileOwnerUserId(profileId) {
  const client = await getProfile('usuariosClient', profileId);
  if (client?.userId) return client.userId;

  const partner = await getProfile('usuariosPartner', profileId);
  if (partner?.userId) return partner.userId;

  const user = await pb.collection('users').getOne(profileId, { requestKey: null }).catch(() => null);
  return user?.id || '';
}

async function getProfileDisplayName(profileId) {
  const client = await getProfile('usuariosClient', profileId);
  if (client) return client.name || client.username || 'Usuario';

  const partner = await getProfile('usuariosPartner', profileId);
  if (partner) return partner.venueName || partner.name || 'Local';

  return getUserName(profileId);
}

function notificationResult(base, pushResult) {
  return {
    success: true,
    notificationCreated: base.created,
    notificationId: base.record.id,
    ...pushResult,
  };
}

router.post('/notifications/user-profile', async (req, res) => {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return res.status(401).json({ error: 'No autenticado' });

    const { profileId, profileType } = req.body;
    if (!profileId || !['client', 'partner'].includes(profileType)) {
      return res.status(400).json({ error: 'profileId y profileType valido son requeridos' });
    }

    const collection = profileType === 'partner' ? 'usuariosPartner' : 'usuariosClient';
    const profile = await pb.collection(collection).getOne(profileId, { requestKey: null });
    const recipientUserId = profile.userId;

    if (!recipientUserId) {
      return res.status(400).json({ error: 'El perfil no tiene userId asociado' });
    }

    const approved = profile.approved === true || profile.status === 'active';
    const type = approved ? 'profile_approved' : 'profile_pending';
    const title = approved ? 'Perfil aprobado' : 'Perfil recibido';
    const message = approved
      ? 'Tu perfil ya esta activo en ONGO.'
      : 'Tu perfil esta pendiente de revision.';
    const url = profileType === 'partner' ? '/profile-local' : '/profile';

    const notification = await createNotificationOnce({
      userId: recipientUserId,
      fromUser: authUser.id,
      type,
      title,
      message,
      referenceId: profile.id,
      data: { profileId: profile.id, profileType, url },
    });

    const pushResult = await sendNotificationPush({
      userId: recipientUserId,
      title,
      body: message,
      data: { type, profileId: profile.id, profileType, url },
    });

    return res.json(notificationResult(notification, pushResult));
  } catch (err) {
    console.error('Error en /notifications/user-profile:', err.message);
    return res.status(500).json({ error: 'Error notificando usuario', details: err.message });
  }
});

router.post('/notifications/message', async (req, res) => {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return res.status(401).json({ error: 'No autenticado' });

    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId requerido' });

    const messageRecord = await pb.collection('messages').getOne(messageId, {
      expand: 'sender,receiver',
      requestKey: null,
    });

    const senderId = idOf(messageRecord.sender);
    const receiverId = idOf(messageRecord.receiver);

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'Mensaje sin sender o receiver' });
    }

    if (authUser.id !== senderId) {
      return res.status(403).json({ error: 'El usuario autenticado no envio este mensaje' });
    }

    const senderName = messageRecord.expand?.sender?.name || messageRecord.expand?.sender?.username || await getUserName(senderId);
    const text = messageRecord.text || messageRecord.message || 'Tienes un nuevo mensaje en ONGO';
    const title = `Nuevo mensaje de ${senderName}`;
    const url = `/chat-detail/${senderId}`;
    const type = 'message';

    const notification = await createNotificationOnce({
      userId: receiverId,
      fromUser: senderId,
      type,
      title,
      message: text,
      referenceId: messageRecord.id,
      data: { messageId: messageRecord.id, senderId, url },
    });

    const pushResult = await sendNotificationPush({
      userId: receiverId,
      title,
      body: text,
      data: { type, messageId: messageRecord.id, senderId, url },
    });

    return res.json(notificationResult(notification, pushResult));
  } catch (err) {
    console.error('Error en /notifications/message:', err.message);
    return res.status(500).json({ error: 'Error notificando mensaje', details: err.message });
  }
});

router.post('/notifications/match', async (req, res) => {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return res.status(401).json({ error: 'No autenticado' });

    const { matchId } = req.body;
    if (!matchId) return res.status(400).json({ error: 'matchId requerido' });

    const match = await pb.collection('matches').getOne(matchId, { requestKey: null });
    const userAAuthId = match.userAAuthId || await getProfileOwnerUserId(match.userA);
    const userBAuthId = match.userBAuthId || await getProfileOwnerUserId(match.userB);

    let recipientUserId = '';
    let otherProfileId = '';

    if (authUser.id === userAAuthId) {
      recipientUserId = userBAuthId;
      otherProfileId = match.userA;
    } else if (authUser.id === userBAuthId) {
      recipientUserId = userAAuthId;
      otherProfileId = match.userB;
    } else {
      return res.status(403).json({ error: 'El usuario autenticado no pertenece al match' });
    }

    if (!recipientUserId) {
      return res.status(400).json({ error: 'No se pudo determinar el destinatario del match' });
    }

    const senderName = await getProfileDisplayName(otherProfileId);
    const type = 'match';
    const title = 'Nuevo match';
    const message = `Hiciste match con ${senderName}.`;
    const url = '/my-matches';

    const notification = await createNotificationOnce({
      userId: recipientUserId,
      fromUser: authUser.id,
      type,
      title,
      message,
      referenceId: match.id,
      data: { matchId: match.id, url },
    });

    const pushResult = await sendNotificationPush({
      userId: recipientUserId,
      title,
      body: message,
      data: { type, matchId: match.id, url },
    });

    return res.json(notificationResult(notification, pushResult));
  } catch (err) {
    console.error('Error en /notifications/match:', err.message);
    return res.status(500).json({ error: 'Error notificando match', details: err.message });
  }
});

router.post('/notifications/gift', async (req, res) => {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return res.status(401).json({ error: 'No autenticado' });

    const { giftId } = req.body;
    if (!giftId) return res.status(400).json({ error: 'giftId requerido' });

    const order = await pb.collection('product_orders').getOne(giftId, { requestKey: null });

    if (order.orderType && order.orderType !== 'gift') {
      return res.status(400).json({ error: 'La orden no corresponde a un regalo' });
    }

    if (authUser.id !== order.buyerUserId && authUser.id !== order.receiverUserId) {
      return res.status(403).json({ error: 'El usuario autenticado no pertenece al regalo' });
    }

    const recipients = [];
    if (order.receiverUserId && order.receiverUserId !== order.buyerUserId) {
      recipients.push({ userId: order.receiverUserId, role: 'receiver' });
    }

    const partner = order.partnerId ? await getProfile('usuariosPartner', order.partnerId) : null;
    if (partner?.userId) {
      recipients.push({ userId: partner.userId, role: 'partner' });
    }

    const uniqueRecipients = [...new Map(recipients.map(item => [item.userId, item])).values()];

    if (!uniqueRecipients.length) {
      return res.status(400).json({ error: 'No se encontraron destinatarios reales para el regalo' });
    }

    const results = [];
    for (const recipient of uniqueRecipients) {
      const type = recipient.role === 'partner' ? 'gift_order' : 'gift_received';
      const title = recipient.role === 'partner' ? 'Nuevo regalo vendido' : 'Recibiste un regalo';
      const message = recipient.role === 'partner'
        ? `Producto: ${order.productName || 'Regalo'}. Codigo: ${order.redeemCode || ''}`
        : `Te enviaron ${order.productName || 'un regalo'} en ONGO.`;
      const url = recipient.role === 'partner' ? '/home-local' : '/my-orders';

      const notification = await createNotificationOnce({
        userId: recipient.userId,
        fromUser: order.buyerUserId || authUser.id,
        type,
        title,
        message,
        referenceId: order.id,
        data: { giftId: order.id, orderId: order.id, url },
      });

      const pushResult = await sendNotificationPush({
        userId: recipient.userId,
        title,
        body: message,
        data: { type, giftId: order.id, orderId: order.id, url },
      });

      results.push(notificationResult(notification, pushResult));
    }

    return res.json({ success: true, results });
  } catch (err) {
    console.error('Error en /notifications/gift:', err.message);
    return res.status(500).json({ error: 'Error notificando regalo', details: err.message });
  }
});

router.post('/notifications/transaction', async (req, res) => {
  try {
    const authUser = await authenticate(req);
    if (!authUser) return res.status(401).json({ error: 'No autenticado' });

    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: 'transactionId requerido' });

    let transaction = await pb.collection('wallet_transactions').getOne(transactionId, { requestKey: null }).catch(() => null);
    let recipientUserId = transaction?.userId || '';
    let type = 'wallet_transaction';
    let title = 'Movimiento de billetera';
    let message = transaction ? `${transaction.description || 'Tu billetera fue actualizada.'}` : '';
    let url = '/wallet-history';

    if (!transaction) {
      transaction = await pb.collection('partner_wallet_transactions').getOne(transactionId, { requestKey: null });
      const partner = transaction.partnerId ? await getProfile('usuariosPartner', transaction.partnerId) : null;
      recipientUserId = partner?.userId || '';
      type = 'partner_wallet_transaction';
      title = 'Movimiento de billetera del local';
      message = transaction.description || 'La billetera de tu local fue actualizada.';
      url = '/wallet-partner';
    }

    if (!recipientUserId) {
      return res.status(400).json({ error: 'No se pudo determinar el usuario de la transaccion' });
    }

    if (authUser.id !== recipientUserId) {
      return res.status(403).json({ error: 'El usuario autenticado no pertenece a la transaccion' });
    }

    const notification = await createNotificationOnce({
      userId: recipientUserId,
      fromUser: authUser.id,
      type,
      title,
      message,
      referenceId: transaction.id,
      data: { transactionId: transaction.id, amount: transaction.amount ?? '', status: transaction.status ?? '', url },
    });

    const pushResult = await sendNotificationPush({
      userId: recipientUserId,
      title,
      body: message,
      data: { type, transactionId: transaction.id, amount: transaction.amount ?? '', status: transaction.status ?? '', url },
    });

    return res.json(notificationResult(notification, pushResult));
  } catch (err) {
    console.error('Error en /notifications/transaction:', err.message);
    return res.status(500).json({ error: 'Error notificando transaccion', details: err.message });
  }
});

export default router;
