# Profiles gallery migrations

No ejecutar en produccion sin comparar schema actual.

## `usuariosClient`

Agregar solo si faltan:

- `photos`: json o text largo. El frontend actual guarda `JSON.stringify(string[])`.
- `avatar`: text/url o file existente. No cambiar tipo si ya existe.
- Campos de perfil usados: `name`, `address`, `birthday`, `gender`, `orientation`, `interestedIn`, `lookingFor`, `about`, `phone`, `age`, `language`, `interests`, `status`, `userId`, `email`.

Indices:

- unique `userId`
- `status`

## `usuariosPartner`

Agregar solo si faltan:

- `files`: json o text largo. El frontend guarda `JSON.stringify(string[])`.
- `avatar`: file o text/url existente. No cambiar tipo si ya existe.
- `venueName`, `address`, `phone`, `description`, `capacity`, `openingHours`, `lat`, `lng`, `services`, `purchaseLink`, `reservationEnabled`, `ticketsEnabled`, `ticketPrice`, `ticketCurrency`, `ticketCountry`, `paymentMethods`.

Indices:

- unique `userId`
- `venueName`

## `files`

Campos:

- `file`: file.
- `userId`: text/relation.
- `type`: text/select (`avatar`, `profile-photo`, `partner-gallery`, `promo`).

Reglas:

- create: autenticado.
- view: propietario o media publica asociada a perfil.

