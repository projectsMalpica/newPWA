import PocketBase from 'pocketbase';

const pb = new PocketBase('https://db.ongomatch.com:8090');

async function test() {
  try {
    // 🔑 Autenticación si la colección no es pública
await pb.collection('users').authWithPassword('admin@ongomatch.com', 'admin1234');

    const id = "fzq7r3slxt8nrjx"; // ID que tomaste de la captura
    const record = await pb.collection('appointments').getOne(id, {
      expand: 'professional'
    });

    console.log('Registro encontrado:', record);

  } catch (err) {
    console.error('Error al buscar la cita:', err);
  }
}

test();
