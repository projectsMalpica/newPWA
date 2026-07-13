import fetch from 'node-fetch';

export async function sendPush(token, title, body, data = {}) {
  const response = await fetch(
    'https://fcm.googleapis.com/fcm/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
        },
        data, // datos extras (ej: serviceId)
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}
