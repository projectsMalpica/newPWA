# ONGO selective merge plan

Fecha: 2026-07-14

## Inspeccion inicial

- `pwd`: `/home/bunsen/projects/ongoPWA1`
- `git status`: limpio antes de iniciar; Git requirio `-c safe.directory=/home/bunsen/projects/ongoPWA1` por propiedad dudosa.
- `git diff`: sin cambios antes de iniciar.
- `git log --oneline -10`: `7cacc2d registro y login actualizado`, `cac700a env`, `cc1cff4 conecion con push`, `f855c8f first commit`, `0540b1d first commit`.
- Inventario `src/app`: `ongoPWA` 159 archivos, `ongoPWA1` 145 archivos.
- `rsync -ainc`: simulacion solamente; no se ejecuto copia completa.

## Solo existen en ongoPWA

Copiados selectivamente:

- `src/app/components/admin-payments/*`: panel administrativo para comprobantes de suscripcion y recargas wallet. Se copio porque no existia en destino y aporta listado, filtros, aprobacion, rechazo y visualizacion de comprobantes.
- `src/app/components/partner-pending-orders/*`: panel de partner para aprobar/rechazar comprobantes de productos, promociones y entradas. Se copio porque no existia en destino y aporta realtime, filtros y previsualizacion de comprobantes.
- `src/app/components/admin-clientes/*`: componente placeholder. Copiado por paridad de rutas, sin logica funcional.
- `src/app/components/admin-locales/*`: componente placeholder. Copiado por paridad de rutas, sin logica funcional.

Descartados:

- Servicio `notifications.service.ts` de `ongoPWA`: descartado para no interferir con `NotificationsService.service.ts`, Firebase Messaging y tokens FCM actuales de `ongoPWA1`.
- Cambios de `login`, `register`, `authPocketbase.service.ts`, `firebase-messaging.service.ts`, `NotificationsService.service.ts`, `app.ts`, `firebase-messaging-sw.js`: no integrados por restriccion explicita.
- Archivo suelto fuente `h origin main --force-with-lease`: descartado; parece residuo accidental.

## Solo existen en ongoPWA1

Conservados:

- `.env`, `.nvmrc`, `amplify.yml`, `fcm.js`, `pocketbase.js`, `public/robots.txt`, `public/sitemap.xml`.
- `src/app/services/firebase-messaging.service.ts`, `src/app/services/push-api.service.ts`.
- `src/app/environments/environment.local.ts`.
- Implementacion actual de login, registro, Google OAuth, restauracion de sesion, logout, FCM y notificaciones.

## Existen en ambos e identicos

No requirieron cambios los componentes base sin diferencias funcionales detectadas por `diff -qr`, por ejemplo `chat`, `detailpromo`, `explorer`, `favorites`, `forgot-password`, `maps`, `my-matches`, `orders-partner`, `privacy`, `reset-password`, `terms`, `wallet-partner` y multiples specs.

## Existen en ambos pero son diferentes

### `src/app/components/wallet/*`

- Proposito: recarga de wallet cliente.
- Diferencias funcionales: `ongoPWA1` tenia Wompi con `credits`, `price` y `bonus`; `ongoPWA` tenia pago manual Binance, comprobante, estado pendiente y `wallet_recharge_proofs`.
- Diferencias visuales: `ongoPWA` agregaba boton Binance, modal de comprobante, tarjeta de recarga pendiente y estilos para upload.
- PocketBase: `wallet`, `wallet_recharge_proofs`.
- Formularios: file input para `proofImage`, textarea `adminNotes`.
- Validaciones: tipo de archivo JPG/PNG/WEBP/PDF, wallet y usuario requeridos, bloqueo durante subida.
- Version mas completa: fusion manual. Se conservo Wompi de `ongoPWA1` y se recupero manual Binance de `ongoPWA`.
- Riesgo: medio; depende de que `wallet_recharge_proofs` tenga campos `credits`, `priceUsd`, `proofImage`.

### `src/app/components/admin-payments/*`

- Proposito: revision administrativa de pagos manuales.
- Diferencias funcionales: componente ausente en destino.
- PocketBase: `client_payment_proofs`, `partner_payment_proofs`, `wallet_recharge_proofs`, `usuariosClient`, `usuariosPartner`, `wallet`, `wallet_transactions`.
- Formularios: confirmacion SweetAlert de aprobacion/rechazo y motivo de rechazo.
- Estados: `loading`, `processingId`, `target`, `status`, paginacion.
- Integracion: copiado y ajustado para acreditar `proof.credits || proof.amount || proof.price || proof.amountPaid`.
- Riesgo: medio-alto; usa colecciones de pagos que deben existir y reglas admin correctas.

### `src/app/components/partner-pending-orders/*`

- Proposito: revision por partner de comprobantes de productos/promos/entradas.
- Diferencias funcionales: componente ausente en destino.
- PocketBase: `usuariosPartner`, `product_payment_proofs`, `ticket_payment_proofs`.
- Estados: `loading`, `processingId`, `activeFilter`, realtime subscribe, preview modal.
- Integracion: copiado sin reemplazar autenticacion; usa `AuthPocketbaseService` actual.
- Riesgo: medio; requiere reglas por `partnerId`.

### `src/app/app.routes.ts`

- Proposito: rutas standalone.
- Diferencias: fuente tenia rutas de admin adicionales y partner pending orders.
- Integracion: se agregaron solo `admin-clientes`, `admin-locales`, `admin-payments`, `partner-pending-orders`.
- Riesgo: bajo; lazy loading y rutas no reemplazan rutas existentes.

### Compartidos revisados sin fusion completa

- `home`, `detailprofile`, `detailprofilelocal`, `profile`, `profile-local`, `checkout-promo`, `my-orders`, `chat-detail`, `header`, `menubar`, `sidebar`, servicios global/chat/swipes`: contienen diferencias, pero `ongoPWA1` ya tenia flujos mas recientes de wallet, partner wallet, productos, ordenes, suscripciones o autenticacion. No se reemplazaron completos para evitar regresiones.

## Rutas agregadas

- `/admin-clientes`
- `/admin-locales`
- `/admin-payments`
- `/partner-pending-orders`

## Dependencias

- No se agregaron dependencias. `sweetalert2` ya existia en `ongoPWA1`.
- No se cambiaron Angular, TypeScript, PocketBase ni Firebase.

## Builds por grupo

- Grupo componentes faltantes + rutas: `npm run build` con Node 22.17.1: OK.
- Grupo wallet manual + admin payments: `npm run build` con Node 22.17.1: OK.

Warnings persistentes:

- `src/app/components/home/home.scss` excede presupuesto por 831 bytes.
- No se localizan stylesheets bajo `/assets/vendor/...` y `/assets/css/style.css`.

