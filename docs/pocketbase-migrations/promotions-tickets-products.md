# Promotions, tickets and products migrations

## `promos`

Campos usados:

- `name`, `description`, `files`, `userId`, `price`, `currency`, `country`.

## `promo_orders`

Campos usados:

- `promoId`, `partnerId`, `buyerUserId`, `buyerName`, `buyerEmail`, `amount`, `status`, `orderStatus`, `redeemCode`, `paymentData`.

## `ticket_orders`

Campos usados:

- `buyerUserId`, `partnerId`, `partnerUserId`, `partnerName`, `amount`, `status`, `orderStatus`, `paymentMethod`, `ticketDate`, `redeemCode`, `referenceId`, `paidAt`.

## `partnerProducts`

Campos usados:

- `partnerId`, `userId`, `name`, `description`, `category`, `price`, `currency`, `country`, `isAvailable`, `image`.

## `product_orders`

Campos usados:

- `buyerUserId`, `receiverUserId`, `partnerId`, `productId`, `productName`, `productImage`, `amount`, `paymentMethod`, `status`, `orderStatus`, `orderType`, `redeemCode`, `redeemQr`, `referenceId`, `message`.

Reglas:

- Productos/promos activos visibles a clientes autenticados.
- Ordenes visibles a comprador, receptor y partner relacionado.
- Estados administrativos solo partner/admin.

