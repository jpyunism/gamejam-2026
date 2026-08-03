import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas en el build. Con el valor por defecto ('/') el juego solo carga
  // si se sirve desde la raíz de un dominio; con './' funciona igual en la raíz, en
  // una subcarpeta o abriendo el index.html directamente.
  base: './',
  server: {
    // Expone el dev server en la LAN para probar desde un celular u otro dispositivo.
    // `allowedHosts: true` saltea el filtro de Vite 7+ que rechaza Host headers
    // desconocidos (el default rechaza el IP de la red local aunque --host 0.0.0.0 esté).
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
