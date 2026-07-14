# Subscription profile migrations

Colecciones: `usuariosClient`, `usuariosPartner`.

Agregar solo si faltan:

- `subscriptionStatus`: select/text.
- `subscriptionPlanId`: text.
- `subscriptionPlanName`: text.
- `subscriptionStartsAt`: date.
- `subscriptionExpiresAt`: date.
- `subscriptionAutoRenew`: bool.
- `pendingSubscriptionStatus`: select/text.
- `pendingSubscriptionPlanId`: text.
- `pendingSubscriptionPlanName`: text.
- `pendingSubscriptionRequestedAt`: date.

Indices:

- `userId` unico en ambos perfiles.
- `subscriptionStatus`.
- `pendingSubscriptionStatus`.

Reglas:

- Usuario edita su propio perfil salvo campos de activacion de suscripcion.
- Solo admin actualiza `subscriptionStatus`, fechas y campos de aprobacion.
- No modificar coleccion `users` salvo campos personalizados confirmados en staging.

