# Wallet migrations

Colecciones: `wallet`, `wallet_transactions`, `wallet_recharge_proofs`, `partner_wallet`, `partner_wallet_transactions`.

## `wallet`

Campos requeridos:

- `userId`: relation/text hacia `users`, requerido, unico recomendado.
- `balance`: number, default `0`.
- `currency`: text/select, default `COP`.
- `status`: select/text, default `active`.

Reglas sugeridas:

- list/view: `userId = @request.auth.id || @request.auth.type = "admin"`
- create: `userId = @request.auth.id || @request.auth.type = "admin"`
- update: `userId = @request.auth.id || @request.auth.type = "admin"`

## `wallet_transactions`

Campos requeridos:

- `walletId`, `userId`, `partnerId`, `type`, `amount`, `direction`, `status`, `currency`, `paymentMethod`, `reference`, `referenceType`, `description`, `balanceBefore`, `balanceAfter`.

Indices:

- `walletId, created`
- `userId, created`
- `reference`

Reglas:

- Usuario puede leer propias.
- Cliente no debe actualizar ni borrar.
- Admin/server crea movimientos administrativos.

## `wallet_recharge_proofs`

Campos requeridos:

- `userId`, `walletId`, `packageId`, `packageName`, `price`, `priceUsd`, `credits`, `bonus`, `currency`, `amountPaid`, `paymentMethod`, `status`, `adminNotes`, `validatedAt`, `proofImage` file.

Indices:

- `userId, status, created`
- `status, created`
- `walletId`

Reglas:

- Usuario crea y lee propios.
- Solo admin aprueba/rechaza.

## `partner_wallet`

Campos requeridos:

- `partnerId`, `balance`, `pendingBalance`, `currency`, `status`.

Indice:

- unique `partnerId`

## `partner_wallet_transactions`

Campos requeridos:

- `partnerWalletId`, `partnerId`, `productOrderId`, `type`, `amount`, `direction`, `status`, `currency`, `description`.

