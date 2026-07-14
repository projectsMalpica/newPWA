# Notifications, chat and matches migrations

Colecciones: `notifications`, `messages`, `matches`, `swipes`, `planningClients`, `planningPartners`, `files`.

## `notifications`

Campos:

- `userId`, `type`, `title`, `body`, `read`, `data`, `created`.

Indices:

- `userId, read, created`
- `type`

Reglas:

- Usuario solo lee/actualiza propias.
- Creacion por server/admin o acciones controladas.

## `messages`

Campos:

- `sender`, `receiver`, `text`, `read`, `created`.

Indices:

- `sender, receiver, created`
- `receiver, read`

Reglas:

- `sender = @request.auth.id || receiver = @request.auth.id`.

## `matches` y `swipes`

Campos:

- `matches`: `clientId`, `partnerId`, `status`, `liked`.
- `swipes`: `fromUserId`, `toUserId`, `direction`.

Indices:

- `clientId, partnerId`
- `fromUserId, toUserId`

Reglas:

- Usuarios relacionados solamente.

