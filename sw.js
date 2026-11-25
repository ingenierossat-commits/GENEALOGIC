// PANAL FAMILIAR · v1.2
const CACHE = 'panal-v1.2';
const SHELL = ['./', './index.html', './app.js', './manifest.json', './ICONS/icon-192.png', './ICONS/icon-512.png',
  ...['selfie_segmentation.js', 'selfie_segmentation.binarypb', 'selfie_segmentation.tflite',
    'selfie_segmentation_solution_simd_wasm_bin.js', 'selfie_segmentation_solution_simd_wasm_bin.wasm', 'selfie_segmentation_solution_simd_wasm_bin.data',
    'selfie_segmentation_solution_wasm_bin.js', 'selfie_segmentation_solution_wasm_bin.wasm'].map(f => './LIBS/' + f)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('panal-') && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
