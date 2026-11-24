/* Galeria ampliada (JS puro, sem dependências).
   Uso: marcar o contêiner das fotos com o atributo data-galeria-ampliada.
   - Clique/toque (ou Enter) numa foto: abre em tela cheia, na maior resolução disponível no srcset
     (ou em data-ampliada="caminho.webp", se a foto tiver).
   - Deslizar para o lado, setas do teclado ou botões ‹ ›: passa para a foto anterior/seguinte.
   - Clique/toque na foto aberta: zoom; arraste para ver os detalhes. Novo clique tira o zoom.
   - Esc, botão × ou clique fora da foto: fecha.
   Fotos ocultas (filtro, atributo hidden) ficam de fora; as escondidas pelo "Ver mais" (.galeria-recolhida) entram.
   Para excluir uma foto: data-galeria-ignorar. O CSS vem embutido para funcionar igual em qualquer projeto
   (template, Next, Vite), sem depender da compilação do Tailwind. */
(function () {
  'use strict';
  if (window.__galeriaAmpliada) return;
  window.__galeriaAmpliada = true;

  var CONTEINER = '[data-galeria-ampliada]';
  var reduzMovimento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toque = window.matchMedia && matchMedia('(hover: none)').matches;

  // Miniaturas: entra no carregamento. Diálogo: entra quando a galeria abre pela primeira vez.
  var CSS_MINIATURAS =
    CONTEINER + ' img{cursor:zoom-in}' +
    CONTEINER + ' img:focus-visible{outline:3px solid currentColor;outline-offset:3px}';

  var CSS =
    '.ga{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;' +
      'background:rgba(10,10,10,.96);color:#fff;overflow:hidden;font:inherit;z-index:2147483000}' +
    '.ga:not([open]){display:none}' +
    '.ga::backdrop{background:rgba(10,10,10,.96)}' +
    '.ga-trilho{display:flex;width:100%;height:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;' +
      'scrollbar-width:none;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.ga-trilho::-webkit-scrollbar{display:none}' +
    '.ga-slide{flex:0 0 100%;width:100%;height:100%;box-sizing:border-box;scroll-snap-align:center;scroll-snap-stop:always;' +
      'display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);overflow:hidden;padding:3.75rem .75rem 5.5rem}' +
    '.ga-slide img{margin:auto;display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;' +
      'border-radius:0;box-shadow:none;cursor:zoom-in;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}' +
    '.ga-zoom .ga-trilho{overflow-x:hidden;scroll-snap-type:none}' +
    '.ga-slide.ga-ampliado{overflow:auto;padding:0;scrollbar-width:none;cursor:grab}' +
    '.ga-slide.ga-ampliado::-webkit-scrollbar{display:none}' +
    '.ga-slide.ga-ampliado img{max-width:none;max-height:none;cursor:zoom-out}' +
    '.ga-topo{position:absolute;inset:0 0 auto;display:flex;align-items:center;justify-content:space-between;' +
      'padding:.5rem .5rem .5rem 1rem;pointer-events:none}' +
    '.ga-contador{font-size:.875rem;letter-spacing:.08em;font-variant-numeric:tabular-nums;opacity:.85}' +
    '.ga-btn{pointer-events:auto;display:grid;place-items:center;width:2.75rem;height:2.75rem;padding:0;border:0;' +
      'border-radius:999px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;transition:background-color .15s,opacity .15s}' +
    '.ga-btn:hover{background:rgba(255,255,255,.24)}' +
    '.ga-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '.ga-btn[disabled]{opacity:.25;cursor:default}' +
    '.ga-btn svg{width:1.5rem;height:1.5rem}' +
    '.ga-nav{position:absolute;top:50%;transform:translateY(-50%)}' +
    '.ga-ant{left:.75rem}.ga-prox{right:.75rem}' +
    '.ga-rodape{position:absolute;inset:auto 0 0;padding:.75rem 1rem 1rem;text-align:center;pointer-events:none;' +
      'background:linear-gradient(to top,rgba(10,10,10,.85),transparent)}' +
    '.ga-legenda{margin:0 auto;max-width:40rem;font-size:.9375rem;line-height:1.4}' +
    '.ga-dica{margin:.25rem 0 0;font-size:.75rem;opacity:.6}' +
    '.ga-zoom .ga-nav,.ga-zoom .ga-rodape{opacity:0;pointer-events:none}' +
    '.ga-unica .ga-nav{display:none}' +
    '@media (max-width:640px){.ga-nav{top:auto;bottom:.75rem;transform:none}.ga-slide{padding-bottom:6.5rem}' +
      '.ga-rodape{padding:.75rem 4rem 1.25rem}}';

  var ICONES = {
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    ant: '<path d="M15 5l-7 7 7 7"/>',
    prox: '<path d="M9 5l7 7-7 7"/>'
  };
  function icone(nome) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + ICONES[nome] + '</svg>';
  }

  var dialogo, trilho, contador, legenda, btnAnt, btnProx;
  var fotos = [];
  var atual = 0;
  var origem = null;
  var overflowAnterior = '';

  /* ---------- Fonte em alta resolução ---------- */
  function maiorFonte(img) {
    if (img.getAttribute('data-ampliada')) return img.getAttribute('data-ampliada');
    var conjuntos = [img.getAttribute('srcset') || ''];
    var pai = img.parentElement;
    if (pai && pai.tagName === 'PICTURE') {
      pai.querySelectorAll('source').forEach(function (s) {
        if (!s.type || s.type === 'image/webp' || s.type === 'image/avif' || s.type === 'image/jpeg') {
          conjuntos.push(s.getAttribute('srcset') || '');
        }
      });
    }
    var melhor = null;
    var melhorLargura = 0;
    conjuntos.join(',').split(/,\s+(?=\S)/).forEach(function (item) {
      var partes = item.trim().split(/\s+/);
      if (!partes[0]) return;
      var desc = partes[1] || '1x';
      var valor = parseFloat(desc) * (/x$/.test(desc) ? 1000 : 1);
      if (valor > melhorLargura) { melhorLargura = valor; melhor = partes[0]; }
    });
    return melhor || img.currentSrc || img.src;
  }

  function textoDaFoto(img) {
    var figura = img.closest('figure');
    var cap = figura && figura.querySelector('figcaption');
    var texto = cap ? cap.textContent.trim() : '';
    return texto || img.getAttribute('alt') || '';
  }

  /* ---------- Montagem do diálogo ---------- */
  function criar() {
    var estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    dialogo = document.createElement('dialog');
    dialogo.className = 'ga';
    dialogo.setAttribute('aria-label', 'Fotos ampliadas');
    dialogo.innerHTML =
      '<div class="ga-trilho"></div>' +
      '<div class="ga-topo"><span class="ga-contador" aria-live="polite"></span>' +
        '<button type="button" class="ga-btn ga-fechar" aria-label="Fechar">' + icone('fechar') + '</button></div>' +
      '<button type="button" class="ga-btn ga-nav ga-ant" aria-label="Foto anterior">' + icone('ant') + '</button>' +
      '<button type="button" class="ga-btn ga-nav ga-prox" aria-label="Próxima foto">' + icone('prox') + '</button>' +
      '<div class="ga-rodape"><p class="ga-legenda"></p><p class="ga-dica">' +
        (toque ? 'Deslize para o lado · toque na foto para ampliar' : 'Use as setas · clique na foto para ampliar') +
      '</p></div>';
    document.body.appendChild(dialogo);

    trilho = dialogo.querySelector('.ga-trilho');
    contador = dialogo.querySelector('.ga-contador');
    legenda = dialogo.querySelector('.ga-legenda');
    btnAnt = dialogo.querySelector('.ga-ant');
    btnProx = dialogo.querySelector('.ga-prox');

    dialogo.querySelector('.ga-fechar').addEventListener('click', fechar);
    btnAnt.addEventListener('click', function () { ir(atual - 1); });
    btnProx.addEventListener('click', function () { ir(atual + 1); });

    dialogo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(atual - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ir(atual + 1); }
    });
    dialogo.addEventListener('close', aoFechar);

    var agendado = false;
    trilho.addEventListener('scroll', function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () {
        agendado = false;
        if (dialogo.classList.contains('ga-zoom')) return;
        var i = Math.round(trilho.scrollLeft / (trilho.clientWidth || 1));
        if (i !== atual) { atual = i; atualizar(); }
      });
    });

    window.addEventListener('resize', function () {
      if (!dialogo.open) return;
      desfazerZoom();
      trilho.scrollLeft = atual * trilho.clientWidth;
    });

    /* Arrastar com o mouse para mover a foto com zoom; um clique sem arrastar alterna o zoom. */
    var arrasto = null;
    trilho.addEventListener('pointerdown', function (e) {
      var slide = e.target.closest('.ga-slide');
      if (!slide || e.pointerType !== 'mouse' || e.button !== 0) return;
      arrasto = { slide: slide, x: e.clientX, y: e.clientY, sl: slide.scrollLeft, st: slide.scrollTop, moveu: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!arrasto) return;
      var dx = e.clientX - arrasto.x;
      var dy = e.clientY - arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) arrasto.moveu = true;
      if (arrasto.moveu && arrasto.slide.classList.contains('ga-ampliado')) {
        arrasto.slide.scrollLeft = arrasto.sl - dx;
        arrasto.slide.scrollTop = arrasto.st - dy;
      }
    });
    window.addEventListener('pointerup', function () {
      if (arrasto && arrasto.moveu) {
        // O clique que vem logo depois de um arrasto não deve alternar o zoom
        trilho.addEventListener('click', function engolir(ev) { ev.stopPropagation(); }, { capture: true, once: true });
        setTimeout(function () { arrasto = null; }, 0);
      } else {
        arrasto = null;
      }
    });

    trilho.addEventListener('click', function (e) {
      var slide = e.target.closest('.ga-slide');
      if (!slide) return;
      if (e.target.tagName === 'IMG') alternarZoom(slide, e);
      else if (slide.classList.contains('ga-ampliado')) desfazerZoom();
      else fechar();
    });
  }

  function carregar(i) {
    for (var j = i - 1; j <= i + 1; j++) {
      var slide = trilho.children[j];
      if (!slide) continue;
      var img = slide.querySelector('img');
      if (!img.getAttribute('src')) img.src = img.getAttribute('data-src');
    }
  }

  function atualizar() {
    contador.textContent = (atual + 1) + ' / ' + fotos.length;
    legenda.textContent = textoDaFoto(fotos[atual]);
    btnAnt.disabled = atual <= 0;
    btnProx.disabled = atual >= fotos.length - 1;
    carregar(atual);
  }

  function ir(i) {
    if (i < 0 || i >= fotos.length) return;
    desfazerZoom();
    atual = i;
    trilho.scrollTo({ left: i * trilho.clientWidth, behavior: reduzMovimento ? 'auto' : 'smooth' });
    atualizar();
  }

  /* ---------- Zoom ---------- */
  function alternarZoom(slide, e) {
    if (slide.classList.contains('ga-ampliado')) { desfazerZoom(); return; }
    var img = slide.querySelector('img');
    var r = img.getBoundingClientRect();
    if (!r.width) return;
    var fx = (e.clientX - r.left) / r.width;
    var fy = (e.clientY - r.top) / r.height;
    var largura = Math.max(img.naturalWidth || 0, r.width * 2.5, slide.clientWidth * 1.5);
    largura = Math.min(largura, r.width * 4);
    var altura = largura * (r.height / r.width);

    dialogo.classList.add('ga-zoom');
    slide.classList.add('ga-ampliado');
    img.style.width = largura + 'px';
    img.style.height = altura + 'px';
    slide.scrollLeft = fx * largura - slide.clientWidth / 2;
    slide.scrollTop = fy * altura - slide.clientHeight / 2;
  }

  function desfazerZoom() {
    if (!dialogo) return;
    dialogo.classList.remove('ga-zoom');
    trilho.querySelectorAll('.ga-ampliado').forEach(function (s) {
      s.classList.remove('ga-ampliado');
      var img = s.querySelector('img');
      img.style.width = '';
      img.style.height = '';
    });
  }

  /* ---------- Abrir / fechar ---------- */
  function abrir(lista, inicio, imgOrigem) {
    if (!dialogo) criar();
    fotos = lista;
    atual = inicio;
    origem = imgOrigem;

    trilho.innerHTML = '';
    lista.forEach(function (foto, i) {
      var slide = document.createElement('div');
      slide.className = 'ga-slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'foto');
      slide.setAttribute('aria-label', (i + 1) + ' de ' + lista.length);
      var img = document.createElement('img');
      img.setAttribute('data-src', maiorFonte(foto));
      img.alt = foto.getAttribute('alt') || '';
      img.decoding = 'async';
      img.draggable = false;
      slide.appendChild(img);
      trilho.appendChild(slide);
    });
    dialogo.classList.toggle('ga-unica', lista.length < 2);

    overflowAnterior = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');

    trilho.scrollLeft = inicio * trilho.clientWidth;
    atualizar();
    dialogo.querySelector(lista.length > 1 && inicio < lista.length - 1 ? '.ga-prox' : '.ga-fechar').focus();
  }

  function fechar() {
    if (typeof dialogo.close === 'function') dialogo.close();
    else { dialogo.removeAttribute('open'); aoFechar(); }
  }

  function aoFechar() {
    desfazerZoom();
    document.documentElement.style.overflow = overflowAnterior;
    trilho.innerHTML = '';
    if (origem && typeof origem.focus === 'function') origem.focus({ preventScroll: true });
    origem = null;
  }

  /* ---------- Miniaturas ---------- */
  function fotosDoConteiner(conteiner) {
    return Array.prototype.filter.call(conteiner.querySelectorAll('img'), function (img) {
      if (img.hasAttribute('data-galeria-ignorar') || img.closest('[hidden]')) return false;
      return img.getClientRects().length > 0 || !!img.closest('.galeria-recolhida');
    });
  }

  /* Acha a foto clicada: a própria <img> ou a única foto do bloco clicado (legenda, moldura, sobreposição). */
  function fotoClicada(alvo, conteiner) {
    if (alvo.tagName === 'IMG') return alvo;
    var no = alvo;
    while (no && no !== conteiner) {
      var imgs = no.querySelectorAll ? no.querySelectorAll('img') : [];
      if (imgs.length === 1) return imgs[0];
      if (imgs.length > 1) return null;
      no = no.parentElement;
    }
    return null;
  }

  function abrirPelaFoto(img, conteiner, evento) {
    var lista = fotosDoConteiner(conteiner);
    var i = lista.indexOf(img);
    if (i < 0) return;
    if (evento) evento.preventDefault();
    abrir(lista, i, img);
  }

  document.addEventListener('click', function (e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var conteiner = e.target.closest && e.target.closest(CONTEINER);
    if (!conteiner) return;
    if (e.target.closest('button, input, select, textarea')) return;
    var img = fotoClicada(e.target, conteiner);
    if (img) abrirPelaFoto(img, conteiner, e);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    var conteiner = img.closest(CONTEINER);
    if (conteiner) abrirPelaFoto(img, conteiner, e);
  });

  function prepararMiniaturas(raiz) {
    (raiz || document).querySelectorAll(CONTEINER + ' img:not([data-ga-pronta])').forEach(function (img) {
      img.setAttribute('data-ga-pronta', '');
      if (img.hasAttribute('data-galeria-ignorar')) return;
      if (!img.closest('a, button')) {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
      }
      img.setAttribute('aria-haspopup', 'dialog');
    });
  }

  function iniciar() {
    var estilo = document.createElement('style');
    estilo.textContent = CSS_MINIATURAS;
    document.head.appendChild(estilo);
    prepararMiniaturas();
    // Páginas montadas por JS (React/Next) inserem as fotos depois
    if ('MutationObserver' in window) {
      var pendente = false;
      new MutationObserver(function () {
        if (pendente) return;
        pendente = true;
        setTimeout(function () { pendente = false; prepararMiniaturas(); }, 200);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
