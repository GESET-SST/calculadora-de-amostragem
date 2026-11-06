// Service worker: deixa o app funcionar sem internet depois do primeiro acesso.
// Guarda só os ARQUIVOS DO APP. A planilha do técnico nunca passa por aqui.
// Estratégia: rede primeiro (pega versão nova quando online), cache como reserva (offline).
// Ao publicar uma versão nova, troque o número abaixo para limpar o cache antigo.
const VERSAO = "amostragem-v4";
const ARQUIVOS = [
  "./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "src/calculo.js", "src/faixas.js", "src/tipos.js", "vendor/xlsx.full.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
