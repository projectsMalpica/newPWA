# Gifts migrations

El flujo actual usa `product_orders` y `wallet_transactions`; no se encontro uso consolidado de colecciones `gifts`, `gift_transactions` o `gift_purchases`.

Campos requeridos en `product_orders` para regalos:

- `buyerUserId`
- `receiverUserId`
- `partnerId`
- `productId`
- `productName`
- `productImage`
- `amount`
- `paymentMethod`
- `status`
- `orderStatus`
- `orderType`: `gift` o `self_purchase`
- `redeemCode`
- `redeemQr`
- `referenceId`
- `message`

Campos requeridos en `wallet_transactions`:

- `walletId`, `userId`, `partnerId`, `type`, `amount`, `direction`, `balanceBefore`, `balanceAfter`, `referenceType`, `referenceId`, `status`, `description`.

Reglas:

- Comprador y receptor pueden ver.
- Partner puede ver pedidos de su local.
- Solo partner/admin puede marcar canje.

