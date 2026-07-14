# Partner payments migrations

El frontend recuperado evidencia datos manuales de pago en `usuariosPartner.paymentMethods`.

Campos sugeridos en `usuariosPartner`:

- `paymentMethods`: json/text array.
- Cada item puede contener `type`, `bank`, `holder`, `document`, `phone`, `accountType`, `accountNumber`.
- `paymentEnabled`: bool opcional.
- `country`, `ticketCountry`, `ticketCurrency`.

Reglas:

- Partner administra sus metodos.
- Clientes autenticados pueden leer solo metodos necesarios para pagar compras del local.
- No exponer datos bancarios globalmente en listados publicos si no son necesarios.

