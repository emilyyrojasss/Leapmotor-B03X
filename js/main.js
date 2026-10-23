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

  initNav();
  initToggles();
  initForm();

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
    gsap.set(['.hero__eyebrow', '.hero__lead', '.hero__actions', '.hero__card', '.hero__scroll'], { opacity: 0, y: 24 });

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
        .to(['.hero__eyebrow', '.hero__lead', '.hero__actions', '.hero__card', '.hero__scroll'],
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
  $$('.m-story').forEach((st) => {
    const text = $('.m-story__text', st);
    const img = $('.m-story__img', st);
    const car = $('.m-story__car', st);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: st, start: `top ${BARS}px`, end: 'bottom bottom', scrub: reduce ? true : 0.6 },
    });
    tl.fromTo(text, { opacity: 0.3, y: 30 * M }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0)
      .to({}, { duration: 0.55 }, 0.45);
    if (img) tl.fromTo(img, { scale: 1 + 0.08 * M }, { scale: 1, duration: 1 }, 0);
    // el carro visto desde arriba cruza la pantalla de izquierda a derecha
    if (car) {
      gsap.set(car, { yPercent: -50 });
      tl.fromTo(car, { xPercent: -95 * M - 30 * (1 - M) }, { xPercent: 20, duration: 1, ease: 'power1.inOut' }, 0);
    }
  });

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
    const setupPicker = (picker, images, nameEl) => {
      if (!picker) return;
      const dots = $$('.m-dot', picker);
      let cur = 0;
      const go = (i) => {
        cur = (i + dots.length) % dots.length;
        dots.forEach((d, k) => { d.classList.toggle('is-active', k === cur); d.setAttribute('aria-checked', k === cur); });
        images.forEach((im, k) => im.classList.toggle('is-active', k === cur));
        nameEl.textContent = dots[cur].dataset.name;
      };
      dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
      $$('.m-picker__arrow', picker).forEach((a) => a.addEventListener('click', () => go(cur + Number(a.dataset.dir))));
    };
    setupPicker($('[data-picker="colors"]'), $$('.m-colors__car'), $('#color-name'));
    setupPicker($('[data-picker="trims"]'), $$('.m-trims__img'), $('#trim-name'));

    // Puntos interactivos sobre el carro
    const hots = $$('.m-hot');
    hots.forEach((h) => h.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = h.getAttribute('aria-expanded') !== 'true';
      hots.forEach((o) => o.setAttribute('aria-expanded', 'false'));
      h.setAttribute('aria-expanded', String(open));
    }));
    document.addEventListener('click', () => hots.forEach((o) => o.setAttribute('aria-expanded', 'false')));

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
