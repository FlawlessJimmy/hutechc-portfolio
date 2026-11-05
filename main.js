/* 심녕호 포트폴리오 · GSAP + ScrollTrigger + SplitText + Lenis (3D 배경은 hero3d.js) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ── 시연용 가짜 대시보드 화면 (실제 고객·매출 데이터 없음) ── */
  const area = (c) => `<svg viewBox="0 0 300 100" preserveAspectRatio="none"><defs><linearGradient id="ga${c.slice(1)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="M0,72 C30,62 45,42 75,46 C105,50 120,76 150,63 C180,50 195,22 225,26 C255,30 270,48 300,32 L300,100 L0,100Z" fill="url(#ga${c.slice(1)})"/><path d="M0,72 C30,62 45,42 75,46 C105,50 120,76 150,63 C180,50 195,22 225,26 C255,30 270,48 300,32" fill="none" stroke="${c}" stroke-width="2"/></svg>`;
  const bars = (c) => `<svg viewBox="0 0 300 100" preserveAspectRatio="none">${[30, 55, 42, 70, 58, 85, 64, 92, 76, 60].map((h, i) => `<rect x="${i * 30 + 6}" y="${100 - h}" width="18" height="${h}" rx="3" fill="${c}" opacity="${0.35 + i * 0.06}"/>`).join('')}</svg>`;
  const kpis = (arr) => `<div class="dash-kpis">${arr.map(([l, v, d]) => `<div><small>${l}</small><em>${v}</em><i>${d}</i></div>`).join('')}</div>`;
  const rows = (chips) => `<div class="dash-table">${chips.map(([cls, t]) => `<div><span></span><span></span><em class="${cls}">${t}</em></div>`).join('')}</div>`;
  const screens = {
    h2b: (c) => `
      <div class="dash-side"><b>H2B</b>${['홈', 'AS 접수', '상담 큐', '매출', '재고', '장부', '설정'].map((t, i) => `<span class="${i ? '' : 'on'}">${t}</span>`).join('')}</div>
      <div class="dash-main">
        <div class="dash-title"><strong>운영 대시보드</strong><span>시연용 데이터</span></div>
        ${kpis([['오늘 매출', '2,480,000', '▲ 12%'], ['상담 대기', '5건', '실시간'], ['AS 접수', '18건', '▲ 3건'], ['순이익', '512,000', '▲ 8%']])}
        <div class="dash-box dash-chart"><small>최근 7일 매출</small>${area(c)}</div>
        <div class="kanban">${[['접수', 4], ['진단', 3], ['수리', 2], ['출고', 3]].map(([t, n]) => `<div><small>${t}<b>${n}</b></small>${'<i></i>'.repeat(n)}</div>`).join('')}</div>
        ${rows([['ok', '답변 완료'], ['hi', 'AI 답변'], ['mid', '상담사 연결'], ['ok', '답변 완료'], ['hi', 'AI 답변']])}
        <div class="dash-box dash-chart"><small>채널별 매출</small>${bars(c)}</div>
        <div class="dash-split"><div class="dash-box"></div><div class="dash-box"></div></div>
      </div>`,
    kanto: (c) => `
      <div class="dash-side"><b>KANTO</b>${['발주 매칭', '재고', '상품', '월간 리포트', '설정'].map((t, i) => `<span class="${i ? '' : 'on'}">${t}</span>`).join('')}</div>
      <div class="dash-main">
        <div class="dash-title"><strong>발주 매칭</strong><span>엑셀 → 발주서</span></div>
        <div class="dash-steps"><div><b>1</b>엑셀 업로드</div><div><b>2</b>자동 매칭</div><div><b>3</b>발주서 생성</div></div>
        ${kpis([['자동 매칭률', '98%', '신뢰도 5단계'], ['확인 필요', '6건', '사람이 확인'], ['오늘 발주', '42건', '▲ 5건'], ['월간 리포트', '4초', '이전 85초']])}
        ${rows([['ok', '확실'], ['ok', '확실'], ['hi', '높음'], ['mid', '보통'], ['chk', '확인 필요'], ['ok', '확실']])}
        <div class="dash-box dash-chart"><small>월별 발주량</small>${bars(c)}</div>
        <div class="dash-box dash-chart"><small>재고 추이</small>${area(c)}</div>
        <div class="dash-split"><div class="dash-box"></div><div class="dash-box"></div></div>
      </div>`,
  };
  $$('[data-dash]').forEach((el) => {
    const c = getComputedStyle(el.closest('.project')).getPropertyValue('--c1').trim();
    el.innerHTML = screens[el.dataset.dash](c);
  });

  /* ── Lenis ↔ ScrollTrigger ── */
  const lenis = new Lenis({ lerp: reduceMotion ? 1 : 0.09, smoothWheel: true });
  window.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.scrollTo(0, { immediate: true, force: true });
  lenis.stop();
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo(a.getAttribute('href'), { duration: 1.6 }); }));

  /* ── 커서 + 마그네틱 ── */
  if (finePointer) {
    const cur = $('.cursor'), dot = $('.cursor-dot'), label = $('span', cur);
    gsap.set([cur, dot], { x: innerWidth / 2, y: innerHeight / 2 });
    const cx = gsap.quickTo(cur, 'x', { duration: 0.55, ease: 'power3' }), cy = gsap.quickTo(cur, 'y', { duration: 0.55, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12 }), dy = gsap.quickTo(dot, 'y', { duration: 0.12 });
    addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); dx(e.clientX); dy(e.clientY); });
    document.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-cursor]'); if (t) { label.textContent = t.dataset.cursor; cur.classList.add('is-hover'); } });
    document.addEventListener('pointerout', (e) => { const t = e.target.closest('[data-cursor]'); if (t && !t.contains(e.relatedTarget)) cur.classList.remove('is-hover'); });
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.35)' }), yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.35)' });
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); xTo((e.clientX - (r.left + r.width / 2)) * 0.3); yTo((e.clientY - (r.top + r.height / 2)) * 0.3); });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  document.fonts.ready.then(init);
  addEventListener('load', () => ScrollTrigger.refresh());

  function init() {
    window.scrollTo(0, 0);
    const heroSplit = new SplitText('.hero-title .line', { type: 'chars' });
    gsap.set(heroSplit.chars, { yPercent: 115 });
    gsap.set('.hero-eyebrow, .hero-sub, .hero-scroll', { y: 24, opacity: 0 });
    const num = $('.loader .num'), bar = $('.loader-bar i'), c = { v: 0 };
    gsap.timeline()
      .to(c, { v: 100, duration: reduceMotion ? 0.3 : 1.6, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(c.v); bar.style.transform = `scaleX(${c.v / 100})`; } })
      .to('.loader-count, .loader-bar, .loader-label', { y: -40, opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05 })
      .to('.loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
      .add(() => {
        document.documentElement.classList.remove('is-loading');
        window.scrollTo(0, 0);
        lenis.scrollTo(0, { immediate: true, force: true });
        lenis.start();
        window.__heroIntroDone = true;
        window.dispatchEvent(new Event('hero:intro'));
        gsap.timeline()
          .to(heroSplit.chars, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.03 })
          .to('.hero-eyebrow, .hero-sub, .hero-scroll', { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.1 }, '-=1');
      }, '-=0.6')
      .set('.loader', { display: 'none' });
    setupScroll();
    ScrollTrigger.refresh();
  }

  function setupScroll() {
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    const nav = $('.nav');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => nav.classList.toggle('is-hidden', s.direction === 1 && s.scroll() > 200) });
    $$('[data-reveal]').forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));

    /* HERO */
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => { window.__heroProgress = s.progress; } });
    gsap.to('.hero-title', { yPercent: -25, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-bottom, .hero-eyebrow', { y: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '50% top', scrub: true } });

    /* MARQUEE */
    const loops = $$('.marquee-track').map((tr, i) => { const tw = gsap.to(tr, { xPercent: -50, ease: 'none', duration: i ? 34 : 28, repeat: -1 }); tw.totalTime(tw.duration() * 1000); return tw; });
    const mrows = $$('.marquee-row');
    let dir = 1, speed = 1, target = 1, skew = 0;
    ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onUpdate: (s) => { const v = s.getVelocity(); dir = s.direction; target = dir * (1 + Math.min(Math.abs(v) / 260, 6)); skew = gsap.utils.clamp(-10, 10, v / -180); } });
    gsap.ticker.add(() => { speed += (target - speed) * 0.08; target += (dir - target) * 0.04; skew *= 0.9; loops.forEach((tw, i) => tw.timeScale(speed * (i ? -1 : 1))); mrows.forEach((r) => gsap.set(r, { skewX: skew })); });

    /* ABOUT */
    const man = new SplitText('.manifesto-text', { type: 'words' });
    gsap.fromTo(man.words, { opacity: 0.12 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '.manifesto-text', start: 'top 80%', end: 'bottom 55%', scrub: true } });

    /* WORK: 가로 이동 + 카드 속 화면 스크롤 */
    const wTrack = $('.work-track');
    const dist = () => wTrack.scrollWidth - innerWidth;
    const hTween = gsap.to(wTrack, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
    /* 카드마다 '가로 이동 진행도'의 구간을 정해 그 구간 동안 카드 속 화면을 움직임
       (첫 카드는 처음부터 보이므로 고정 시작점 대신 실제 위치로 계산) */
    const cardAnims = [];
    const ranges = () => {
      const d = Math.max(1, dist()), vw = innerWidth;
      cardAnims.forEach((o) => {
        const L = o.card.offsetLeft, W = o.card.offsetWidth;
        o.a = gsap.utils.clamp(0, 1, (L - vw * 0.8) / d);
        o.b = gsap.utils.clamp(0, 1, (L + W / 2 - vw * 0.3) / d);
        if (o.b - o.a < 0.08) o.b = Math.min(1, o.a + 0.25);
        if (o.inv) { const pr = o.tl.progress(); o.tl.progress(0).invalidate().progress(pr); }
      });
    };
    gsap.ticker.add(() => {
      const p = hTween.progress();
      cardAnims.forEach((o) => o.tl.progress(gsap.utils.clamp(0, 1, (p - o.a) / (o.b - o.a))));
    });
    ScrollTrigger.addEventListener('refresh', ranges);
    $$('.project').forEach((card) => {
      gsap.fromTo(card, { scale: 0.86, opacity: 0.35 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: hTween, start: 'left 100%', end: 'left 55%', scrub: true } });
      const vp = $('.viewport', card), shot = $('.shot', card), slides = $$('.slide', card);
      if (shot) cardAnims.push({ card, inv: true, tl: gsap.timeline({ paused: true }).to(shot, { y: () => -Math.max(0, shot.offsetHeight - vp.offsetHeight), ease: 'none' }) });
      if (slides.length) {
        /* 실제 화면 여러 장: 천천히 확대되다가 다음 화면이 오른쪽에서 닦이듯 등장 */
        const n = slides.length, cap = $('.slide-cap', card), dotsBox = $('.slide-dots', card);
        dotsBox.innerHTML = '<i></i>'.repeat(n);
        const dots = $$('i', dotsBox);
        let cur = -1;
        const setCap = (i) => { if (i === cur) return; cur = i; cap.textContent = slides[i].dataset.cap; dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
        setCap(0);
        gsap.set(slides.slice(1), { clipPath: 'inset(0% 0% 0% 100%)' });
        const tl = gsap.timeline({ paused: true, onUpdate: () => setCap(Math.min(n - 1, Math.floor(tl.progress() * n))) });
        cardAnims.push({ card, tl });
        slides.forEach((sl, i) => {
          const media = $('img, .page', sl);
          tl.fromTo(media, { scale: 1 }, { scale: 1.07, duration: 1, ease: 'none' }, i);
          if (i > 0) {
            tl.to(sl, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.28, ease: 'power2.inOut' }, i - 0.28);
            tl.to($('img, .page', slides[i - 1]), { opacity: 0.35, duration: 0.28, ease: 'power1.in' }, i - 0.28);
          }
        });
      }
    });
    ranges();

    /* STORE: 고정된 폰 안에서 모바일 화면이 스크롤 */
    const steps = $$('.step'), phoneShot = $('.phone-shot'), screen = $('.screen');
    const setStep = (i) => steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    /* 시간표: 0~0.6 폰 등장 · 0.6~3.6 홈 스크롤(1~3단계) · 3.6 상담 위젯이 아래에서 올라옴(4단계) · 4.7 특가몰이 옆에서 들어옴(5단계) */
    const T = { scrollEnd: 3.6, chat: 3.6, special: 4.7, total: 5.8 };
    const stepAt = (t) => (t < T.scrollEnd ? Math.min(2, Math.floor(Math.max(0, t - 0.6))) : t < T.special ? 3 : 4);
    gsap.set('.alt-chat', { yPercent: 100 });
    gsap.set('.alt-special', { xPercent: 100 });
    gsap.timeline({ scrollTrigger: { trigger: '.showcase', start: 'top top', end: '+=3800', pin: true, scrub: 1, invalidateOnRefresh: true, onUpdate: (s) => setStep(stepAt(s.progress * T.total)) } })
      .fromTo('.phone', { rotateY: -30, rotateX: 14, rotateZ: -6, scale: 0.84, y: 70 }, { rotateY: -8, rotateX: 4, rotateZ: 0, scale: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      .to(phoneShot, { y: () => -Math.max(0, phoneShot.offsetHeight - screen.offsetHeight), duration: 3, ease: 'none' })
      .to('.phone', { rotateY: 8, rotateX: -2, duration: 3, ease: 'sine.inOut' }, '<')
      // 4단계: 상담하기를 누른 화면
      .to('.alt-chat', { yPercent: 0, duration: 0.5, ease: 'power3.out' }, T.chat)
      .to('.phone', { rotateY: -4, rotateX: 2, duration: 0.5, ease: 'sine.inOut' }, T.chat)
      .fromTo('.alt-chat', { scale: 1 }, { scale: 1.04, duration: 0.6, ease: 'none' }, T.chat + 0.5)
      // 5단계: 회원 특가몰
      .to('.alt-special', { xPercent: 0, duration: 0.5, ease: 'power3.inOut' }, T.special)
      .to('.alt-chat', { xPercent: -30, opacity: 0.4, duration: 0.5, ease: 'power3.inOut' }, T.special)
      .to('.phone', { rotateY: 0, rotateX: 0, duration: 0.5, ease: 'sine.inOut' }, T.special)
      .to({}, { duration: 0.6 });

    /* OPS: 막대가 줄어들고 숫자가 내려감 */
    $$('.ops-card').forEach((card) => {
      const before = $('.ops-bars .before', card), after = $('.ops-bars .after', card), strong = $('strong[data-from]', card);
      const tl = gsap.timeline({ paused: true });
      tl.from(card, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' });
      if (before) tl.fromTo([before, after], { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.out' }, '-=0.3');
      if (after) tl.to(after, { scaleX: parseFloat(getComputedStyle(after).getPropertyValue('--r')), duration: 1.6, ease: 'power3.inOut' }, '+=0.15');
      if (strong) {
        const o = { v: +strong.dataset.from }, to = +strong.dataset.to, unit = strong.dataset.unit || '';
        tl.to(o, { v: to, duration: 1.6, ease: 'power3.inOut', onUpdate: () => { strong.textContent = o.v.toFixed(1) + unit; }, onComplete: () => { if (strong.dataset.end) strong.textContent = strong.dataset.end; } }, '<');
      }
      ScrollTrigger.create({ trigger: card, start: 'top 85%', once: true, onEnter: () => tl.play() });
    });

    /* SAMPLES: 쌓이는 카드 (데스크톱) + 카드 속 화면 스크롤 */
    const cards = $$('.stack-card');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', () => {
      cards.forEach((card, i) => {
        const vp = $('.viewport', card), shot = $('.shot', card);
        gsap.to(shot, { y: () => -Math.max(0, shot.offsetHeight - vp.offsetHeight), ease: 'none', scrollTrigger: { trigger: card, start: 'top 75%', end: () => '+=' + innerHeight * 1.1, scrub: true, invalidateOnRefresh: true } });
        if (i === cards.length - 1) return;
        gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, { scale: 0.9, filter: 'brightness(0.45)', ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 11%', scrub: true } });
      });
    });
    mm.add('(max-width: 860px)', () => {
      cards.forEach((card) => {
        const vp = $('.viewport', card), shot = $('.shot', card);
        gsap.from(card, { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
        gsap.to(shot, { y: () => -Math.max(0, shot.offsetHeight - vp.offsetHeight), ease: 'none', scrollTrigger: { trigger: card, start: 'top 80%', end: 'bottom 20%', scrub: true, invalidateOnRefresh: true } });
      });
    });

    /* FIT: 줄마다 등장 */
    const fitRows = $$('.fit-row');
    gsap.set(fitRows, { y: 30, opacity: 0 });
    ScrollTrigger.batch(fitRows, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08 }) });

    /* FLOW: 선이 그어지고 단계가 차례로 */
    gsap.from('.flow-line', { scaleX: 0, ease: 'none', scrollTrigger: { trigger: '.flow-steps', start: 'top 80%', end: 'top 40%', scrub: true } });
    gsap.from('.flow-step', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.15, scrollTrigger: { trigger: '.flow-steps', start: 'top 82%', once: true } });

    /* CTA */
    const ctaSplit = new SplitText('.cta-title .line', { type: 'chars' });
    gsap.from(ctaSplit.chars, { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.025, scrollTrigger: { trigger: '.cta', start: 'top 65%' } });
    gsap.from('.cta-btn', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.cta', start: 'top 55%' } });
  }
})();
