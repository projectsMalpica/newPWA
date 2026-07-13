import admin from '../firebase/firebase.js';

export async function sendPush(tokens, payload = {}) {
  const cleanTokens = [...new Set((tokens || []).filter(Boolean))];

  if (!cleanTokens.length) {
    return {
      successCount: 0,
      failureCount: 0,
    };
  }

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'OnGo';

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    'Nueva notificación';

  const data = Object.fromEntries(
    Object.entries(payload.data || {}).map(([key, value]) => [
      key,
      String(value ?? ''),
    ])
  );

  const url = data.url || '/maps';

  const message = {
    tokens: cleanTokens,

    notification: {
      title,
      body,
    },

    data,

    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'ongo_notifications',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },

    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },

    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title,
        body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-192x192.png',
        vibrate: [300, 120, 300],
        silent: false,
        requireInteraction: true,
        data,
      },
      fcmOptions: {
        link: url,
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log('✅ Push OnGo enviados:', response.successCount);
    console.log('❌ Push OnGo fallidos:', response.failureCount);

    if (response.failureCount > 0) {
      response.responses.forEach((result, index) => {
        if (!result.success) {
          console.error('❌ Token fallido:', cleanTokens[index]);
          console.error('Motivo:', result.error?.message);
        }
      });
    }

    return response;
  } catch (err) {
    console.error('❌ Error al enviar push OnGo:', err);
    throw err;
  }
}