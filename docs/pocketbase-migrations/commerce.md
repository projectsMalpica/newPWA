# Commerce migrations

Colecciones: `partnerProducts`, `product_orders`, `ticket_orders`, `promo_orders`, `table_reservations`, `promos`, `hotZones`, `partner_stats`, `client_daily_limits`.

## Productos y promos

- `partnerProducts`: `partnerId`, `name`, `description`, `price`, `currency`, `image`, `isActive`, `stock`.
- `promos`: `partnerId`, `title`, `description`, `price`, `currency`, `image`, `isActive`, fechas.

Indices:

- `partnerId, isActive`
- `created`

## Ordenes

- `product_orders`: `buyerUserId`, `receiverUserId`, `partnerId`, `productId`, `productName`, `productImage`, `amount`, `currency`, `paymentMethod`, `status`, `redeemCode`, `walletTransactionId`.
- `ticket_orders`: `buyerUserId`, `partnerId`, `itemName`, `amount`, `currency`, `paymentMethod`, `status`, `redeemCode`, `walletTransactionId`.
- `promo_orders`: `promoId`, `buyerUserId`, `partnerId`, `amount`, `currency`, `status`, `redeemCode`, `walletTransactionId`.

Indices:

- `partnerId, status, created`
- `buyerUserId, created`
- unique `redeemCode`

## Reservas y limites

- `table_reservations`: `clientId`, `partnerId`, `date`, `time`, `people`, `status`, `notes`.
- `client_daily_limits`: `userId`, `date`, contadores de uso.
- `partner_stats`: `partnerId`, contadores agregados.
- `hotZones`: `name`, `description`, `city`, `lat`, `lng`, `radiusMeters`, `isActive`, `requiresPlan`, `minPlan`, `createdBy`.

Reglas:

- Cliente solo ve/crea sus ordenes.
- Partner ve ordenes de su `partnerId` y valida canjes.
- Admin administra zonas, estadisticas y estados globales.

