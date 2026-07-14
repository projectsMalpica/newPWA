# Manual payment proof migrations

Colecciones: `product_payment_proofs`, `ticket_payment_proofs`, `client_payment_proofs`, `partner_payment_proofs`.

## Campos comunes

- `status`: select/text con `pending`, `approved`, `rejected`.
- `adminNotes`: text.
- `validatedAt`: date.
- `proofFile` o `proofImage`: file, requerido en create de cliente.
- `amount`: number.
- `currency`: select/text.
- `paymentMethod`: text/select.

## `product_payment_proofs`

Campos:

- `buyerUserId`, `receiverUserId`, `partnerId`, `productId`, `productName`, `itemName`, `amount`, `amountUSD`, `amountBs`, `currency`, `redeemCode`, `proofFile`, `status`, `adminNotes`, `validatedAt`.

Indices:

- `partnerId, status, created`
- `buyerUserId, created`
- `redeemCode`

## `ticket_payment_proofs`

Campos:

- `buyerUserId`, `partnerId`, `ticketId`, `promotionId`, `productName`, `itemName`, `amount`, `currency`, `redeemCode`, `proofFile`, `status`, `adminNotes`, `validatedAt`.

Indices:

- `partnerId, status, created`
- `buyerUserId, created`
- `redeemCode`

## `client_payment_proofs`

Campos:

- `clientId`, `planId`, `planName`, `amount`, `currency`, `paymentMethod`, `proofFile`, `status`, `adminNotes`, `validatedAt`.

Indices:

- `status, created`
- `clientId, status`

## `partner_payment_proofs`

Campos:

- `partnerId`, `planId`, `planName`, `amount`, `currency`, `paymentMethod`, `proofFile`, `status`, `adminNotes`, `validatedAt`.

Indices:

- `status, created`
- `partnerId, status`

Reglas comunes:

- Propietario crea/lee su comprobante.
- Partner solo puede revisar comprobantes donde `partnerId` corresponda a su perfil.
- Admin valida todos.

