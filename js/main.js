/* =========================================================
   Leapmotor B03X — interacciones
   GSAP + ScrollTrigger para las secuencias, Lenis para scroll suave.
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = reduce ? 0 : 1; // multiplicador de desplazamientos: 0 = solo fundidos
  let lenis = null;
  let colorPicker = null;

  initNav();
  initToggles();
  initForm();
  initMedia();

  if (!window.gsap || !window.ScrollTrigger) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('js-motion');

  /* ---------- Scroll suave ---------- */
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, offset: typeof target === 'number' ? 0 : -136 });
    else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY - 136, behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]:not([href="#"])').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollTo(target);
    });
  });

  /* ---------- Barra de progreso y nav ---------- */
  gsap.to('#progress-bar', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: true },
  });
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Hero: el B03X entra manejando y frena ---------- */
  initHero();

  function initHero() {
    const car = $('.hero__car');
    const bodies = $$('.hero__body');                 // carro + reflejo
    const sharp = $$('.hero__sharp'), blurred = $$('.hero__blurred');
    const rims = $$('.wheel .rim'), rimBlur = $$('.wheel .rim-blur');
    const spinners = $$('.wheel img');                 // giro de la entrada (nítido y desenfocado)
    const hubs = $$('.wheel');                         // giro del scroll
    const chars = $$('.hero__title .char');
    const L = { head: $('.hero__light'), brake: $('.hero__brake'), beam: $('.hero__beam'), pool: $('.hero__pool') };

    // Rodar sin patinar: grados = distancia / circunferencia de la llanta × 360.
    // La llanta mide ~250 px en el lienzo de 1800 px del render.
    // El render mira a la izquierda: el carro avanza hacia -x y las ruedas giran en sentido antihorario.
    const tire = () => car.offsetWidth * 250 / 1800;
    const spin = (dist) => (dist / (Math.PI * tire())) * 360;
    const FRONT = 114 / 1800;                          // la trompa está al 6,3% del lienzo

    // Al hacer scroll, el carro sigue su camino y sale por la izquierda
    const exit = () => innerWidth / 2 + car.offsetWidth * 0.8;
    gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    })
      .fromTo('.hero__track', { x: 0 }, { x: () => -exit(), ease: 'power2.in' }, 0)
      .fromTo(hubs, { rotation: 0 }, { rotation: () => -spin(exit()), ease: 'power2.in' }, 0)
      .to('.hero__title', { yPercent: -25, opacity: 0, ease: 'none' }, 0)
      .to(['.hero__bottom', '.hero__eyebrow', '.hero__scroll'], { opacity: 0, y: -40, ease: 'none', duration: 0.5 }, 0);

    if (reduce) {
      gsap.set(car, { visibility: 'visible' });
      gsap.set(chars, { yPercent: 0 });
      gsap.from(['.hero__car', '.hero__title', '.hero__eyebrow', '.hero__bottom'], { opacity: 0, duration: 0.8, stagger: 0.1 });
      gsap.set(L.head, { opacity: 0.3 });
      return;
    }

    // Estado inicial mientras cargan las imágenes
    gsap.set(chars, { y: 0, yPercent: 110 });
    gsap.set(['.hero__eyebrow', '.hero__lead', '.hero__actions', '.hero__seal', '.hero__scroll'], { opacity: 0, y: 24 });

    // Arrancar solo cuando el carro y la tipografía estén listos: evita el tirón del primer cuadro
    const imgs = $$('.hero__car img');
    const ready = Promise.all([
      document.fonts ? document.fonts.ready : null,
      ...imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null)),
    ]);
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([ready, timeout]).then(() => requestAnimationFrame(play));

    function play() {
      const T0 = 0.85;                                 // el carro aparece después de los faros
      const DRIVE = 2.6;                               // segundos de manejo hasta detenerse
      const EASE = 'power3.out';                       // x(p) = dist · (1 − p)³

      // Posición final de la trompa y distancia para arrancar fuera de cuadro
      const r = car.getBoundingClientRect();
      const front0 = r.left + r.width * FRONT;
      const dist = innerWidth - r.left + 40;
      gsap.set(car, { visibility: 'visible', x: dist, force3D: true });

      // Momento en que la trompa pasa frente a cada letra (se calcula una vez, sin medir en cada cuadro):
      // front0 + dist·(1−p)³ = centro  →  p = 1 − ∛((centro − front0) / dist)
      const charAt = chars.map((c) => {
        const cr = c.getBoundingClientRect();
        const center = cr.left + cr.width / 2;
        const ratio = (center - front0) / dist;
        const p = ratio <= 0 ? 0.92 : Math.min(0.92, 1 - Math.cbrt(Math.min(ratio, 1)));
        return T0 + p * DRIVE;
      });

      const tl = gsap.timeline({ defaults: { force3D: true } });
      tl
        // 1. Escena a oscuras: se dibuja el piso
        .from('.hero__ground', { scaleX: 0, transformOrigin: '100% 50%', duration: 1.4, ease: 'expo.inOut' }, 0)
        // 2. Los faros llegan antes que el carro
        .fromTo([L.beam, L.pool], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.2)
        .fromTo(L.head, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.2)
        // 3. Entra manejando: posición y giro con la misma curva, así se detienen juntos
        .to(car, { x: 0, duration: DRIVE, ease: EASE }, T0)
        .fromTo(spinners, { rotation: spin(dist) }, { rotation: 0, duration: DRIVE, ease: EASE }, T0)
        // desenfoque pre-renderizado: rápido = desenfocado, lento = nítido (solo opacidad)
        .fromTo(blurred, { opacity: 1 }, { opacity: 0, duration: DRIVE * 0.35, ease: 'power1.in' }, T0 + DRIVE * 0.3)
        .fromTo(sharp, { opacity: 0 }, { opacity: 1, duration: DRIVE * 0.3, ease: 'power1.out' }, T0 + DRIVE * 0.12)
        .fromTo(rimBlur, { opacity: 1 }, { opacity: 0, duration: DRIVE * 0.3, ease: 'power1.in' }, T0 + DRIVE * 0.4)
        .fromTo(rims, { opacity: 0 }, { opacity: 1, duration: DRIVE * 0.3, ease: 'power1.out' }, T0 + DRIVE * 0.25)
        .fromTo('.hero__streaks i', { opacity: 0.8, scaleX: 1 }, { opacity: 0, scaleX: 0, duration: DRIVE * 0.55, stagger: 0.04, ease: 'power2.out' }, T0)
        // suspensión: una ondulación suave mientras rueda
        .fromTo(bodies, { y: 0 }, { y: -1.5, duration: 0.16, repeat: 7, yoyo: true, ease: 'sine.inOut' }, T0 + 0.1)
        // 4. Frenada: luces de freno, la trompa se hunde y rebota
        .to(L.brake, { opacity: 1, duration: 0.2, ease: 'power1.out' }, T0 + DRIVE - 1.3)
        .to(bodies, { rotation: -1.2, y: 1, duration: 0.55, ease: 'power2.out' }, T0 + DRIVE - 0.95)
        .to(bodies, { rotation: 0, y: 0, duration: 1.4, ease: 'elastic.out(1, 0.4)' }, '>')
        .to(L.brake, { opacity: 0, duration: 0.7, ease: 'power1.inOut' }, '<+0.3')
        // 5. Detenido: luz diurna y destello sobre la carrocería
        .to(L.beam, { opacity: 0, duration: 1.2, ease: 'power1.inOut' }, T0 + DRIVE - 0.2)
        .to(L.pool, { opacity: 0.25, duration: 1.2, ease: 'power1.inOut' }, '<')
        .to(L.head, { opacity: 0.45, duration: 1.2, ease: 'power1.inOut' }, '<')
        .set('.hero__sheen', { opacity: 1 }, T0 + DRIVE - 0.3)
        .fromTo('.hero__sheen i', { xPercent: -110 }, { xPercent: 360, duration: 1.5, ease: 'power2.inOut' }, T0 + DRIVE - 0.3)
        .set('.hero__sheen', { opacity: 0 })
        // 6. Interfaz
        .to(['.hero__eyebrow', '.hero__lead', '.hero__actions', '.hero__seal', '.hero__scroll'],
          { opacity: 1, y: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out' }, T0 + DRIVE - 0.6);

      // Las letras suben justo cuando la trompa pasa frente a cada una
      chars.forEach((c, i) => tl.to(c, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, charAt[i]));
    }
  }

  /* ---------- Estudio: la foto se oscurece y aparecen titular y datos ---------- */
  initSplash();

  function initSplash() {
    const stats = $$('.splash__stats li');
    const fmt = (v, d) => v.toFixed(d).replace('.', ',');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.splash', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.7 },
    });
    tl.fromTo('.splash__img', { scale: 1.12 }, { scale: 1, duration: 3 }, 0)
      .fromTo('.splash__shade', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0.3)
      .fromTo('.splash__head > *', { opacity: 0, y: 24 * M }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.25, ease: 'power2.out' }, 0.7);
    stats.forEach((li, i) => {
      const at = 1.5 + i * 0.25;
      tl.fromTo(li, { opacity: 0, y: 18 * M }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, at);
      const n = $('[data-splash-count]', li);
      const end = parseFloat(n.dataset.splashCount), dec = +(n.dataset.decimals || 0);
      const o = { v: 0 };
      tl.to(o, { v: end, duration: 0.5, ease: 'power2.out', onUpdate: () => (n.textContent = fmt(o.v, dec)) }, at);
    });
    tl.to({}, { duration: 0.4 });
  }

  /* ---------- Historias: imagen fija mientras el texto pasa de tenue a blanco ---------- */
  const BARS = 136; // header (72) + sub-navegación (64)
  const shade0 = (st) => ($('.m-story__shade', st) ? 0 : 0.3);
  $$('.m-story').forEach((st) => {
    const text = $('.m-story__text', st);
    const img = $('.m-story__img', st);
    const car = $('.m-story__car', st);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: st, start: `top ${BARS}px`, end: 'bottom bottom', scrub: reduce ? true : 0.6, invalidateOnRefresh: true },
    });
    tl.fromTo(text, { opacity: shade0(st), y: 30 * M }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0)
      .to({}, { duration: 0.55 }, 0.45);
    if (img) tl.fromTo(img, { scale: 1 + 0.08 * M }, { scale: 1, duration: 1 }, 0);
    // fondo que se oscurece mientras aparece el texto
    const shade = $('.m-story__shade', st);
    if (shade) tl.fromTo(shade, { opacity: 0 }, { opacity: 0.55, duration: 0.45, ease: 'power1.out' }, 0);
    // el carro visto desde arriba entra por la izquierda, pasa por encima del texto
    // y sale completo por la derecha en línea recta; recién entonces sigue el scroll
    if (car) {
      gsap.set(car, { xPercent: 0, yPercent: -50 });
      tl.fromTo(car, { x: () => -car.offsetWidth - 40 }, { x: () => innerWidth + 40, duration: 0.9, ease: 'none' }, 0.05);
    }
  });

  /* ---------- Colores: el scroll recorre los 6 colores y luego sigue ---------- */
  if (colorPicker) {
    const N = $$('.m-colors__car').length;
    const st = ScrollTrigger.create({
      trigger: '.m-colors', start: `top ${BARS}px`, end: 'bottom bottom',
      onUpdate: (self) => {
        const i = Math.min(N - 1, Math.floor(self.progress * N));
        if (i !== colorPicker.cur) colorPicker.go(i);
      },
    });
    colorPicker.navigate = (i) => scrollTo(st.start + (st.end - st.start) * ((i + 0.5) / N));
  }

  /* ---------- Acabados interiores: el scroll pasa las 3 fotos y luego sigue ---------- */
  const trimImgs = $$('.m-trims__img');
  if (trimImgs.length) {
    let curTrim = 0;
    ScrollTrigger.create({
      trigger: '.m-trims', start: `top ${BARS}px`, end: 'bottom bottom',
      onUpdate: (self) => {
        const i = Math.min(trimImgs.length - 1, Math.floor(self.progress * trimImgs.length));
        if (i === curTrim) return;
        curTrim = i;
        trimImgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
      },
    });
  }

  /* ---------- Más espacio: los asientos se abaten y el maletero crece ---------- */
  const seatFrames = $$('.m-space__frames img');
  const litersEl = $('#liters');
  if (seatFrames.length && litersEl) {
    const L0 = 405, L1 = 1358;
    const fmtL = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+$)/, '.');
    const spaceTl = gsap.timeline({
      scrollTrigger: {
        trigger: '.m-space', start: `top ${BARS}px`, end: 'bottom bottom', scrub: reduce ? true : 0.6,
        onUpdate: (self) => {
          const p = gsap.utils.clamp(0, 1, (self.progress - 0.08) / 0.82);
          litersEl.textContent = fmtL(L0 + (L1 - L0) * p);
          gsap.set('#liters-bar', { scaleX: p });
        },
      },
    });
    seatFrames.slice(1).forEach((img, i) => {
      spaceTl.fromTo(img, { opacity: 0, scale: 1 + 0.03 * M }, { opacity: 1, scale: 1, duration: 1, ease: 'power1.inOut' }, i * 1.2 + 0.3);
    });
    spaceTl.to({}, { duration: 0.5 });
  }

  /* ---------- Tecnología: scroll horizontal fijo; al llegar a la última tarjeta sigue la página ---------- */
  const techTrack = $('.m-carousel--scroll .m-carousel__track');
  if (techTrack) {
    const dist = () => Math.max(0, techTrack.scrollWidth - techTrack.parentElement.clientWidth);
    gsap.to(techTrack, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.m-tech', start: `top ${BARS}px`, end: () => '+=' + dist() * 1.2,
        pin: true, scrub: reduce ? true : 0.7, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => gsap.set('#tech-bar', { scaleX: self.progress }),
      },
    });
  }

  /* ---------- Sub-navegación: sección activa ---------- */
  const subLinks = $$('.m-subnav__links a').map((a) => [a, $(a.getAttribute('href'))]).filter(([, sec]) => sec);
  const updateSub = () => {
    let cur = null;
    for (const [a, sec] of subLinks) if (sec.getBoundingClientRect().top < innerHeight * 0.45) cur = a;
    subLinks.forEach(([a]) => a.classList.toggle('is-active', a === cur));
  };
  addEventListener('scroll', updateSub, { passive: true });
  updateSub();

  // Recalcular después de que carguen las imágenes
  addEventListener('load', () => ScrollTrigger.refresh());

  /* =========================================================
     Helpers sin dependencia de GSAP
     ========================================================= */
  function closeMenu() {
    const btn = $('#nav-toggle');
    btn?.setAttribute('aria-expanded', 'false');
    $('#nav-links')?.classList.remove('is-open');
    lenis?.start();
  }

  function initNav() {
    const btn = $('#nav-toggle');
    const links = $('#nav-links');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      links.classList.toggle('is-open', open);
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }

  function initToggles() {
    // Selectores con puntos y flechas: colores del carro y acabados interiores
    const setupPicker = (picker, images, nameEl, countEl) => {
      if (!picker) return null;
      const dots = $$('.m-dot', picker);
      const api = { cur: 0, navigate: null };
      api.go = (i) => {
        const cur = api.cur = (i + dots.length) % dots.length;
        dots.forEach((d, k) => { d.classList.toggle('is-active', k === cur); d.setAttribute('aria-checked', k === cur); });
        images.forEach((im, k) => im.classList.toggle('is-active', k === cur));
        nameEl.textContent = dots[cur].dataset.name;
        if (countEl) countEl.textContent = cur + 1;
      };
      // si hay un recorrido con scroll, los clics llevan el scroll a ese color
      const pick = (i) => (api.navigate ? api.navigate(i) : api.go(i));
      dots.forEach((d, k) => d.addEventListener('click', () => pick(k)));
      $$('.m-picker__arrow', picker).forEach((a) => a.addEventListener('click', () => {
        const i = api.cur + Number(a.dataset.dir);
        pick(api.navigate ? Math.max(0, Math.min(dots.length - 1, i)) : i);
      }));
      return api;
    };
    colorPicker = setupPicker($('[data-picker="colors"]'), $$('.m-colors__car'), $('#color-name'), $('#color-count'));

    // Puntos interactivos sobre el carro: tarjeta con foto y descripción (como leapmotor.net)
    const hots = $$('.m-hot');
    const card = $('#hotcard');
    const scrim = $('#hot-scrim');
    if (card && hots.length) {
      const img = $('.m-hotcard__media img', card);
      const title = $('h3', card);
      const text = $('p', card);
      const count = $('.m-hotcard__count', card);
      let cur = -1;
      let openedAt = 0;

      // la tarjeta se abre del lado contrario al punto, para no taparlo
      const place = (h) => {
        const x = parseFloat(h.style.getPropertyValue('--x'));
        if (x < 50) { card.style.left = `calc(${x}% + 48px)`; card.style.right = 'auto'; }
        else { card.style.right = `calc(${100 - x}% + 48px)`; card.style.left = 'auto'; }
      };
      const show = (i) => {
        cur = (i + hots.length) % hots.length;
        const h = hots[cur];
        hots.forEach((o) => { o.classList.toggle('is-active', o === h); o.setAttribute('aria-expanded', String(o === h)); });
        img.style.opacity = 0;
        const next = new Image();
        next.onload = () => { img.src = h.dataset.img; img.alt = h.dataset.title; img.style.opacity = 1; };
        next.src = h.dataset.img;
        title.textContent = h.dataset.title;
        card.style.setProperty('--hc', h.style.getPropertyValue('--hc'));
        text.textContent = h.dataset.text;
        count.textContent = `${cur + 1} / ${hots.length}`;
        place(h);
        if (card.hidden) {
          card.hidden = false; scrim.hidden = false;
          requestAnimationFrame(() => { card.classList.add('is-on'); scrim.classList.add('is-on'); });
          openedAt = scrollY;
        }
      };
      const hide = () => {
        if (card.hidden) return;
        const last = hots[cur];
        card.classList.remove('is-on'); scrim.classList.remove('is-on');
        hots.forEach((o) => { o.classList.remove('is-active'); o.setAttribute('aria-expanded', 'false'); });
        setTimeout(() => { card.hidden = true; scrim.hidden = true; }, 300);
        cur = -1;
      };

      // con mouse: se abre al pasar el cursor; en pantallas táctiles, al tocar
      const canHover = matchMedia('(hover: hover)').matches;
      const stage = $('.m-first__stage');
      let leaveTimer;
      hots.forEach((h, i) => {
        h.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cur === i && !canHover) hide(); else show(i);
        });
        if (canHover) h.addEventListener('mouseenter', () => { clearTimeout(leaveTimer); if (cur !== i) show(i); });
        h.addEventListener('focus', () => { if (cur !== i) show(i); });
      });
      if (canHover) {
        stage.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hide, 250); });
        stage.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
      }
      $$('.m-hotcard__arrow', card).forEach((a) => a.addEventListener('click', (e) => { e.stopPropagation(); show(cur + Number(a.dataset.dir)); }));
      $('.m-hotcard__close', card).addEventListener('click', hide);
      card.addEventListener('click', (e) => e.stopPropagation());
      scrim.addEventListener('click', hide);
      document.addEventListener('click', hide);
      addEventListener('keydown', (e) => {
        if (cur < 0) return;
        if (e.key === 'Escape') hide();
        if (e.key === 'ArrowRight') show(cur + 1);
        if (e.key === 'ArrowLeft') show(cur - 1);
      });
      addEventListener('scroll', () => { if (cur >= 0 && Math.abs(scrollY - openedAt) > 220) hide(); }, { passive: true });
    }

    // Carruseles de tarjetas: puntos y flechas
    $$('[data-carousel]').forEach((c) => {
      const track = $('.m-carousel__track', c);
      const cards = [...track.children];
      const dotsEl = $('.m-carousel__dots', c);
      const [prev, next] = $$('.m-arrow', c);
      const step = () => cards[0].offsetWidth + 16;
      cards.forEach((_, i) => {
        const b = document.createElement('button');
        b.setAttribute('aria-label', `Ir a la tarjeta ${i + 1}`);
        b.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: 'smooth' }));
        dotsEl.append(b);
      });
      const update = () => {
        const i = Math.round(track.scrollLeft / step());
        [...dotsEl.children].forEach((d, k) => d.classList.toggle('is-active', k === i));
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      };
      prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
      track.addEventListener('scroll', update, { passive: true });
      addEventListener('resize', update);
      update();
    });

    // Tarjetas de tecnología: el "+" muestra la descripción
    $$('.m-card__plus').forEach((btn) => btn.addEventListener('click', () => {
      const open = btn.closest('.m-card').classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    }));

    // Motor: pestañas Pro / ProMax
    $$('.m-tab').forEach((tab) => tab.addEventListener('click', () => {
      $$('.m-tab').forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
      $$('.m-motor__panel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }));

    // Versiones: "Ver todo" abre o cierra todo el equipamiento de la tarjeta
    $$('.m-version__all').forEach((btn) => btn.addEventListener('click', () => {
      const items = $$('details', btn.closest('.m-version'));
      const openAll = items.some((d) => !d.open);
      items.forEach((d) => { d.open = openAll; });
      btn.innerHTML = openAll ? 'Ver menos <span aria-hidden="true">−</span>' : 'Ver todo <span aria-hidden="true">+</span>';
    }));
  }

  /* ---------- Playlist y Reto B03X ----------
     Para completar: poné los enlaces de la playlist en PLAYLIST,
     el canal en RETO_CANAL y el ID de cada video en data-youtube-id del HTML. */
  function initMedia() {
    const PLAYLIST = {
      spotify: '', apple: '', youtube: '', deezer: '', amazon: '', soundcloud: '',
    };
    const RETO_CANAL = '';

    $$('.m-plat').forEach((a) => {
      const url = PLAYLIST[a.dataset.platform];
      if (url) a.href = url;
      else { a.classList.add('is-soon'); a.removeAttribute('target'); a.addEventListener('click', (e) => e.preventDefault()); }
    });
    const ch = $('#reto-channel');
    if (ch) { if (RETO_CANAL) ch.href = RETO_CANAL; else { ch.addEventListener('click', (e) => e.preventDefault()); ch.title = 'Canal disponible pronto'; } }

    // Videos: muestran la miniatura de YouTube y cargan el reproductor solo al hacer clic
    $$('.m-video').forEach((v) => {
      const id = (v.dataset.youtubeId || '').trim();
      const btn = $('.m-video__play', v);
      if (!id) { v.classList.add('is-soon'); return; }
      // si no hay portada propia, usa la miniatura de YouTube
      if (!$('img', btn)) {
        const img = document.createElement('img');
        img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; img.alt = ''; img.loading = 'lazy';
        btn.prepend(img);
      }
      btn.addEventListener('click', () => {
        const f = document.createElement('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
        f.title = v.dataset.title || 'Reto B03X';
        f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        f.allowFullscreen = true;
        btn.replaceWith(f);
      });
    });
  }

  function initForm() {
    const form = $('#lead-form');
    const msg = $('#form-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach((f) => {
        const valid = f.checkValidity();
        f.setAttribute('aria-invalid', String(!valid));
        ok = ok && valid;
      });
      if (!ok) { msg.textContent = 'Revisá los campos marcados.'; return; }

      const data = new FormData(form);
      const endpoint = form.dataset.endpoint;

      // Sin endpoint configurado: abre el correo con la consulta lista para enviar a FACO
      if (!endpoint) {
        const body = [...data.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
        location.href = `mailto:info@facocr.com?subject=${encodeURIComponent(`Consulta ${data.get('modelo')} — ${data.get('tipo')}`)}&body=${encodeURIComponent(body)}`;
        msg.textContent = 'Se abrirá tu correo con la consulta lista para enviar a FACO.';
        return;
      }

      msg.textContent = 'Enviando…';
      try {
        const res = await fetch(endpoint, { method: 'POST', body: data });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        msg.textContent = '¡Gracias! Un asesor de FACO te contactará pronto.';
      } catch {
        msg.textContent = 'No pudimos enviar el formulario. Escribinos a info@facocr.com o llamá al +506 2010-3000.';
      }
    });
  }
})();
