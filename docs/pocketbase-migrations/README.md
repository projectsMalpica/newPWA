# PocketBase migration templates

Estas migraciones son propuestas seguras para staging. No fueron ejecutadas.

Politica:

- Crear colecciones solo si faltan.
- Agregar campos solo si faltan.
- No borrar campos, colecciones ni registros.
- No cambiar tipos existentes automaticamente.
- No tocar OAuth ni credenciales.
- No tocar `pb_data`.
- `down` debe quedar vacio o documentado como no destructivo.

Dominios generados:

- `wallet.md`
- `payments.md`
- `subscriptions.md`
- `commerce.md`
- `notifications-chat-matches.md`
- `profiles-gallery.md`
- `manual-purchases.md`
- `promotions-tickets-products.md`
- `gifts.md`
- `partner-payments.md`

Antes de convertirlas a migraciones ejecutables de PocketBase, exportar el schema actual desde staging y validar nombres/tipos contra la version exacta del binario PocketBase instalado.
