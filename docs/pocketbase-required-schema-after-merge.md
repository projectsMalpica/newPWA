# PocketBase required schema after selective merge

Fecha: 2026-07-14

Fuente de evidencia: busqueda de `.collection(` y payloads en `src/app`. No se modifico PocketBase de produccion. No hay `pb_schema.json` ni migraciones locales del proyecto para comparar; por tanto el estado real de la base queda **no verificado**.

## Colecciones usadas

Lista unica detectada:

`client_daily_limits`, `files`, `hotZones`, `matches`, `messages`, `notifications`, `partnerProducts`, `partner_stats`, `partner_wallet`, `partner_wallet_transactions`, `planningClients`, `planningPartners`, `product_orders`, `product_payment_proofs`, `promo_orders`, `promos`, `swipes`, `table_reservations`, `ticket_orders`, `ticket_payment_proofs`, `users`, `usuariosClient`, `usuariosPartner`, `wallet`, `wallet_recharge_proofs`, `wallet_transactions`.

Colecciones dinamicas adicionales inferidas:

- `client_payment_proofs`: `admin-payments`, aprobacion de suscripcion cliente.
- `partner_payment_proofs`: `admin-payments`, aprobacion de suscripcion partner.

## Pagos y wallet

| Coleccion | Operaciones | Campos crear/actualizar inferidos | Lecturas/filtros/sorts | Relaciones | Archivos | Estados/enums | Indices recomendados | Reglas propuestas | Confianza |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wallet` | getFirstListItem, create, update, getOne | `userId`, `balance`, `currency`, `status` | `userId="{id}"` | `userId -> users` | No | `status: active`; transacciones actualizan saldo | unique `userId`; index `status` | Usuario: `userId=@request.auth.id`; admin puede listar/actualizar | Alta |
| `wallet_transactions` | create, getFullList | `walletId`, `userId`, `partnerId`, `type`, `amount`, `direction`, `status`, `currency`, `paymentMethod`, `reference`, `referenceType`, `description`, `balanceBefore`, `balanceAfter` | `walletId="{id}"`, sort `-created` | `walletId -> wallet`, `userId -> users` | No | `topup`, `purchase`, `ticket`, `gift_sent`, `bonus`; `credit/debit`; `completed/pending/failed` | index `walletId,created`; index `userId,created`; index `reference` | Usuario solo transacciones propias; admin todo | Alta |
| `wallet_recharge_proofs` | create, getFirstListItem, getList, update | `userId`, `walletId`, `packageId`, `packageName`, `price`, `priceUsd`, `credits`, `bonus`, `currency`, `amountPaid`, `paymentMethod`, `status`, `adminNotes`, `validatedAt` | `userId && status="pending"`; `status="{status}"`, sort `-created` | `userId -> users`, `walletId -> wallet` | `proofImage` | `pending/approved/rejected`; `binance` | index `userId,status,created`; index `status,created`; index `walletId` | Usuario crea/lee solo propios; admin aprueba/rechaza | Alta |
| `partner_wallet` | getFirstListItem, create, update | `partnerId`, `balance`, `pendingBalance`, `currency`, `status` | `partnerId="{id}"` | `partnerId -> usuariosPartner` | No | `active` | unique `partnerId` | Partner propio; admin todo | Alta |
| `partner_wallet_transactions` | create, getFullList | `partnerWalletId`, `partnerId`, `productOrderId`, `type`, `amount`, `direction`, `status`, `currency`, `description` | `partnerWalletId`, sort `-created` | `partnerWalletId -> partner_wallet`, `partnerId -> usuariosPartner` | No | `product_sale`, `credit`, `pending` | index `partnerWalletId,created`; index `partnerId,created` | Partner propio; admin todo | Alta |

## Comprobantes manuales de compras

| Coleccion | Operaciones | Campos crear/actualizar inferidos | Lecturas/filtros/sorts | Relaciones | Archivos | Estados/enums | Indices recomendados | Reglas propuestas | Confianza |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `product_payment_proofs` | getFullList, update, subscribe | `status`, `adminNotes`, `validatedAt` | `partnerId="{id}" && status="{status}"`, sort `-created` | `partnerId -> usuariosPartner`, comprador por `buyerUserId` | `proofFile` | `pending/approved/rejected` | index `partnerId,status,created`; index `buyerUserId,created` | Partner del registro aprueba; comprador lee propio; admin todo | Media |
| `ticket_payment_proofs` | getFullList, update, subscribe | `status`, `adminNotes`, `validatedAt` | `partnerId="{id}" && status="{status}"`, sort `-created` | `partnerId -> usuariosPartner`, comprador por `buyerUserId` | `proofFile` | `pending/approved/rejected`; tipo inferido promo/ticket | index `partnerId,status,created`; index `buyerUserId,created` | Partner del registro aprueba; comprador lee propio; admin todo | Media |
| `client_payment_proofs` | getList, update | `status`, `validatedAt`, `adminNotes` | `status="{status}"`, sort `-created` | `clientId -> usuariosClient`, plan por `planId` | `proofFile` | `pending/approved/rejected` | index `status,created`; index `clientId,status` | Cliente crea/lee propios; admin valida | Media |
| `partner_payment_proofs` | getList, update | `status`, `validatedAt`, `adminNotes` | `status="{status}"`, sort `-created` | `partnerId -> usuariosPartner`, plan por `planId` | `proofFile` | `pending/approved/rejected` | index `status,created`; index `partnerId,status` | Partner crea/lee propios; admin valida | Media |

## Ordenes y productos

| Coleccion | Operaciones | Campos principales inferidos | Filtros/sorts | Relaciones | Archivos | Indices recomendados | Reglas propuestas | Confianza |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `partnerProducts` | getFullList, create, update, delete | `partnerId`, `name`, `description`, `price`, `currency`, `image`, `isActive`, `stock` | `partnerId`, `isActive=true`, sort `-created` | `partnerId -> usuariosPartner` | imagen producto | index `partnerId,isActive`; index `created` | Partner propio administra; clientes leen activos | Alta |
| `product_orders` | create, getFullList, getFirstListItem, update | `buyerUserId`, `receiverUserId`, `partnerId`, `productId`, `productName`, `productImage`, `amount`, `currency`, `paymentMethod`, `status`, `redeemCode`, `walletTransactionId` | buyer/receiver/partner/status/redeemCode | usuarios, partnerProducts | No | `pending/paid/redeemed/approved/rejected`; `wallet/manual` | index `partnerId,status,created`; index `buyerUserId,created`; unique `redeemCode` | Comprador/receiver/partner relacionado; admin todo | Alta |
| `ticket_orders` | create, getFullList, update | `buyerUserId`, `partnerId`, `itemName`, `amount`, `currency`, `paymentMethod`, `status`, `redeemCode`, `walletTransactionId` | buyer/partner/status/redeemCode | usuarios, usuariosPartner | No | `pending/paid/redeemed` | index `partnerId,status,created`; unique `redeemCode` | Usuario propio y partner relacionado | Alta |
| `promo_orders` | create, getFullList | `promoId`, `buyerUserId`, `partnerId`, `amount`, `currency`, `status`, `redeemCode`, `walletTransactionId` | `buyerUserId`, sort `-created` | `promoId -> promos`, `partnerId -> usuariosPartner` | No | `paid/pending/redeemed` | index `buyerUserId,created`; index `partnerId,status`; unique `redeemCode` | Usuario propio y partner relacionado | Media |
| `table_reservations` | create, update, getFullList | `clientId`, `partnerId`, `date`, `time`, `people`, `status`, `notes` | buyer/partner/status | usuarios y partner | No | `pending/approved/rejected` | index `partnerId,status,created`; index `clientId,created` | Usuario/partner relacionado | Media |

## Suscripciones y perfiles

| Coleccion | Operaciones | Campos enviados/actualizados | Filtros | Indices recomendados | Reglas propuestas | Confianza |
| --- | --- | --- | --- | --- | --- | --- |
| `usuariosClient` | getFirstListItem, getFullList, create, update | perfil cliente, `userId`, `subscriptionStatus`, `subscriptionPlanId`, `subscriptionPlanName`, `subscriptionStartsAt`, `subscriptionExpiresAt`, `subscriptionAutoRenew`, `pendingSubscriptionStatus`, `pendingSubscriptionPlanId`, `pendingSubscriptionPlanName`, `pendingSubscriptionRequestedAt` | `userId="{authId}"`, busquedas por perfil | unique `userId`; index `subscriptionStatus` | Usuario edita propio; admins y vistas publicas solo campos seguros | Alta |
| `usuariosPartner` | getFirstListItem, getFullList, create, update | perfil partner, `userId`, datos local, productos/promos relacionados, subscription fields analogos | `userId="{authId}"`, geolocalizacion, partner activo | unique `userId`; index `isActive`; geo si aplica | Partner edita propio; clientes leen campos publicos; admin todo | Alta |
| `users` | auth, update, getOne | auth PB, flags personalizados limitados | authStore, email | auth built-in | No tocar OAuth; no migrar destructivo | Alta |

## Social, chat y notificaciones

| Coleccion | Campos inferidos | Operaciones | Reglas propuestas | Indices |
| --- | --- | --- | --- | --- |
| `matches` | `clientId`, `partnerId`, `status`, `liked`, `created` | create/update/get/list | Solo usuarios relacionados | `clientId,partnerId`, `status` |
| `swipes` | `fromUserId`, `toUserId`, `direction`, `created` | create/getList | Usuario propio | `fromUserId,toUserId` |
| `messages` | `sender`, `receiver`, `text`, `read`, `created` | create/list/update/subscribe | Sender/receiver solamente | `sender,receiver,created`; `read` |
| `notifications` | `userId`, `type`, `title`, `body`, `read`, `data`, `created` | list/update/subscribe | `userId=@request.auth.id`; server/admin crea | `userId,read,created`; `type` |
| `planningClients`, `planningPartners` | datos de planificacion | list/subscribe | Usuario relacionado o admin | `userId`, `created` |
| `partner_stats` | `partnerId`, contadores, fechas | get/create/update | Partner propio/admin | unique `partnerId`; `partnerId,created` |
| `client_daily_limits` | `userId`, `date`, contadores | get/create/update | Usuario propio/admin | unique `userId,date` |
| `hotZones` | `name`, `description`, `city`, `lat`, `lng`, `radiusMeters`, `isActive`, `requiresPlan`, `minPlan`, `createdBy` | create/list/update/delete | lectura autenticada; escritura admin | `city,isActive`; `lat,lng` |
| `files` | archivo generico | create | Usuario autenticado propio/admin | `created` |

## Comparacion con base actual

No verificada contra produccion: no hay credenciales admin ni schema exportado localmente. Tabla de acciones propuesta:

| Coleccion | Estado | Campo | Tipo inferido | Evidencia | Accion |
| --- | --- | --- | --- | --- | --- |
| `wallet_recharge_proofs` | Desconocido | `credits`, `priceUsd`, `bonus`, `proofImage` | number, number, number, file | `wallet.ts`, `admin-payments.ts` | Agregar solo si faltan |
| `wallet_transactions` | Desconocido | `direction`, `paymentMethod`, `reference`, `currency` | select/text | wallet, checkout, admin payments | Agregar solo si faltan |
| `product_payment_proofs` | Desconocido | `partnerId`, `buyerUserId`, `receiverUserId`, `proofFile`, `redeemCode`, `status` | relation/text/file/select | `partner-pending-orders.ts` | Crear/agregar si falta |
| `ticket_payment_proofs` | Desconocido | `partnerId`, `buyerUserId`, `proofFile`, `redeemCode`, `status` | relation/text/file/select | `partner-pending-orders.ts` | Crear/agregar si falta |
| `client_payment_proofs` | Desconocido | `clientId`, `planId`, `planName`, `proofFile`, `status`, `validatedAt`, `adminNotes` | relation/text/file/select/date/text | `admin-payments.ts` | Crear/agregar si falta |
| `partner_payment_proofs` | Desconocido | `partnerId`, `planId`, `planName`, `proofFile`, `status`, `validatedAt`, `adminNotes` | relation/text/file/select/date/text | `admin-payments.ts` | Crear/agregar si falta |
| `usuariosClient` | Desconocido | `subscriptionStatus`, `subscriptionExpiresAt`, pending subscription fields | select/date/text/date | `admin-payments.ts`, `home.ts` | Agregar si faltan, no tocar auth |
| `usuariosPartner` | Desconocido | subscription fields analogos | select/date/text/date | `admin-payments.ts` | Agregar si faltan |

## Actualizacion 2026-07-14: perfiles, galerias y compras manuales

Evidencia adicional integrada:

- `profile.ts`: `usuariosClient.photos` se trata como JSON/string array de URLs, no como file multiple directo. `avatar` se guarda como URL generada desde la coleccion auxiliar `files`. Al guardar se conserva cada `photo.url` existente y solo sube nuevos `photo.file`.
- `profile-local.ts`: `usuariosPartner.files` se trata como JSON/string array de URLs. `avatar` puede ser archivo directo de `usuariosPartner` cuando se envia en `FormData`. El guardado conserva `files` existentes y sube nuevos archivos a `files`.
- `detailprofile.ts`: perfil publico cliente lee `usuariosClient` por id de registro o por `userId`; galeria solo lectura se arma con `avatar`, `photos` y campos legacy `photo1..photo6`.
- `detailprofilelocal.ts`: perfil publico comercio muestra `usuariosPartner.files` como galeria modal; compras manuales de entradas usan `ticket_payment_proofs`; compras/regalos manuales de productos usan `product_payment_proofs`.
- `checkout-promo.ts`: promociones manuales en moneda `VES`/`USD` o pais `VE` crean `ticket_payment_proofs` con `productName="Promoción"`.

Campos de galeria confirmados:

| Coleccion | Campo | Tipo actual inferido | Evidencia | Accion |
| --- | --- | --- | --- | --- |
| `usuariosClient` | `photos` | JSON/text array de URLs | `profile.ts` parsea/stringify; `detailprofile.ts` normaliza array/string | Mantener JSON/text; no convertir automaticamente a file multiple |
| `usuariosClient` | `avatar` | URL o filename PB | `profile.ts`, `detailprofile.ts` | Soportar ambos; si es filename usar `pb.files.getUrl` |
| `usuariosPartner` | `files` | JSON/text array de URLs | `profile-local.ts`, `detailprofilelocal.ts` | Mantener JSON/text; no convertir automaticamente |
| `usuariosPartner` | `avatar` | file PB o URL | `profile-local.ts`, `detailprofilelocal.ts` | Soportar ambos |
| `files` | `file`, `userId`, `type` | file/text/text | uploads de perfil cliente/partner | Reglas por usuario autenticado |

Campos de pagos manuales confirmados:

| Coleccion | Campo | Tipo inferido | Evidencia | Accion |
| --- | --- | --- | --- | --- |
| `ticket_payment_proofs` | `partnerId`, `buyerUserId`, `productName`, `itemId`, `itemName`, `amount`, `country`, `currency`, `status`, `paymentMethod`, `message`, `redeemCode`, `proofFile` | relation/text/text/text/text/number/text/text/select/text/text/text/file | entrada manual, promocion manual | Agregar solo si faltan |
| `product_payment_proofs` | `partnerId`, `buyerUserId`, `receiverUserId`, `productId`, `productName`, `amount`, `currency`, `country`, `paymentMethod`, `status`, `message`, `redeemCode`, `proofFile`, `amountUSD`, `amountBs`, `bcvRate` | relation/text/text/text/text/number/text/text/text/select/text/text/file/number/number/number | producto/regalo manual | Agregar solo si faltan |
| `promo_orders` | `promoId`, `partnerId`, `buyerUserId`, `buyerName`, `buyerEmail`, `amount`, `status`, `orderStatus`, `redeemCode`, `paymentData` | relation/relation/relation/text/text/number/select/select/text/json | promo wallet | Agregar solo si faltan |
| `product_orders` | `orderType`, `orderStatus`, `redeemCode`, `redeemQr`, `message`, `referenceId` | select/select/text/text/text/text | regalo/producto wallet | Agregar solo si faltan |

Reglas adicionales:

- `files`: create solo autenticado; view limitado a propietario o perfiles publicos si se usa como media publica.
- `ticket_payment_proofs`: comprador ve propios, partner ve/aprueba registros de su `partnerId`, admin todo.
- `product_payment_proofs`: comprador/receptor ve propios, partner ve/aprueba registros de su `partnerId`, admin todo.
- `promo_orders`, `ticket_orders`, `product_orders`: comprador/receptor/partner relacionado; admin todo.

## Reglas de seguridad propuestas

No aplicar automaticamente sin probar en staging:

- Wallets: listar/ver/crear/actualizar por usuario propietario: `userId = @request.auth.id`; admin puede todo.
- Transacciones: usuario propietario via `userId = @request.auth.id`; no permitir update/delete desde cliente.
- Comprobantes wallet: usuario crea/lee propios; solo admin cambia `status`, `validatedAt`, `adminNotes`.
- Comprobantes productos/tickets: comprador lee propios; partner del `partnerId` puede listar y aprobar/rechazar; admin todo.
- Suscripciones: cliente/partner crea solicitud propia; solo admin activa plan en perfil.
- Mensajes/notificaciones/dispositivos: nunca acceso publico general; filtrar por `sender`, `receiver` o `userId`.

## Migraciones propuestas

Se generaron plantillas no ejecutadas en `docs/pocketbase-migrations/`. Son deliberadamente aditivas: crean colecciones si faltan y agregan campos si faltan; no borran campos, no cambian tipos, no tocan OAuth y no tienen `down` destructivo.
