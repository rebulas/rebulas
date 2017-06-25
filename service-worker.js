
self.addEventListener('install', e => {
 e.waitUntil(
   caches.open('rebulas').then(cache => {
     return cache.addAll([
       '/',
       '/index.html',
       '/style/main.css',
       '/style/jquery.min.js',
       '/style/bootstrap/css/bootstrap.css',
       '/style/bootstrap/js/bootstrap.min.js',
       '/style/terminal/jquery.terminal-1.2.0.min.js',
       '/style/terminal/jquery.mousewheel.min.js',
       '/style/terminal/jquery.terminal-1.2.0.min.css',
       '/style/markdown-it.min.js',
       '/style/marked.min.js',
       '/js/util/util.js',
       '/js/ui/facet-renderer.js',
       '/js/ui/item-renderer.js',
       '/js/ui/result-renderer.js',
       '/js/query/query.js',
       '/js/query/query-executor.js',
       '/js/terminal/terminal.js',
       '/js/repository/repository-configurator.js',
       '/js/repository/repository-manager.js',
       '/js/repository/repository-controller.js',
       '/js/backend/dataload.js',
       '/js/backend/elasticlunr.js',
       '/style/Dropbox-sdk.min.js',
     ]);
   })
 );
});

self.addEventListener('fetch', (event) => {
  console.log(event.request.url);

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
