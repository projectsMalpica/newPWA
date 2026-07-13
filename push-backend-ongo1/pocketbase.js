import PocketBase from 'pocketbase';

export const PB_URL = 'https://db.ongomatch.com:8090';
export const pb = new PocketBase(PB_URL);

// Autenticación directa para depuración
try {
  // Primero intentamos autenticación de administrador
  try {
    await pb.admins.authWithPassword(
      'ongomatch@gmail.com',  // Usa el correo de administrador
      'uioW99..ongo'         // Usa la contraseña de administrador
    );
    console.log('✅ Autenticado como administrador en PocketBase');
  } catch (adminErr) {
    console.log('⚠️ No se pudo autenticar como administrador, intentando como usuario normal...');
    // Si falla la autenticación de admin, intentamos con usuario normal
    const authData = await pb.collection('users').authWithPassword(
      'admin@email.com',  // Usa el correo del usuario
      'admin1234'         // Usa la contraseña del usuario
    );
    console.log('✅ Autenticado como usuario en PocketBase');
  }
} catch (err) {
  console.error('❌ Error de autenticación con PocketBase:', err.message);
  console.error('Detalles del error:', err);
  // No lanzamos el error para que la aplicación pueda iniciar
  // y podamos ver los logs de las rutas
}
