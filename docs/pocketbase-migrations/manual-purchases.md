# Manual purchases migrations

No ejecutar en produccion. Plantilla aditiva.

## `ticket_payment_proofs`

Campos usados:

- `partnerId`
- `buyerUserId`
- `productName`
- `itemId`
- `itemName`
- `amount`
- `country`
- `currency`
- `status`
- `paymentMethod`
- `message`
- `redeemCode`
- `proofFile`
- `adminNotes`
- `validatedAt`

Indices:

- `partnerId,status,created`
- `buyerUserId,created`
- `redeemCode`

## `product_payment_proofs`

Campos usados:

- `partnerId`
- `buyerUserId`
- `receiverUserId`
- `productId`
- `productName`
- `amount`
- `currency`
- `country`
- `paymentMethod`
- `status`
- `message`
- `redeemCode`
- `proofFile`
- `amountUSD`
- `amountBs`
- `bcvRate`
- `adminNotes`
- `validatedAt`

Indices:

- `partnerId,status,created`
- `buyerUserId,created`
- `receiverUserId,created`
- `redeemCode`

Reglas:

- Comprador crea y lee sus comprobantes.
- Partner relacionado por `partnerId` lista, aprueba y rechaza.
- Admin todo.

