// 온디바이스 AI 시연 화면 제어
const root = document.querySelector('.ondevice');
if (root) init();

function init() {
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const gsap = window.gsap;
  const state = { tab: 'grade', device: {}, ms: {}, net: {} };
  const mb = (b) => (b / 1048576).toFixed(b > 104857600 ? 0 : 1);

  const showMeta = () => {};

  // ---------- 로딩 표시 ----------
  const loader = (kind) => {
    const el = $(`[data-load="${kind}"]`);
    return {
      text(t) { el.classList.remove('is-done'); el.querySelector('.od-load-txt').textContent = t; },
      progress(l, t) {
        el.classList.remove('is-done');
        el.querySelector('.od-load-txt').textContent = t ? `모델 내려받는 중 ${mb(l)} / ${mb(t)}MB · 다음부터는 저장본 사용` : '모델 불러오는 중';
        el.querySelector('b').style.transform = `scaleX(${t ? l / t : 0.1})`;
      },
      done() { el.classList.add('is-done'); },
      error(m) { el.classList.remove('is-done'); el.classList.add('is-error'); el.querySelector('.od-load-txt').textContent = m; },
    };
  };
  const loaders = { grade: loader('grade'), text: loader('text'), image: loader('image'), hand: loader('hand') };

  // ---------- 작업 공간 (Web Worker) ----------
  let worker = null;
  const requested = {};
  const getWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./worker.js?v=2', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => handlers[data.type]?.(data);
    worker.onerror = (e) => { loaders[state.tab]?.error('브라우저가 이 기능을 지원하지 않습니다.'); console.error(e); };
    return worker;
  };
  const loadModel = (kind) => {
    if (requested[kind]) return;
    requested[kind] = true;
    loaders[kind].text('모델 준비 중');
    if (kind === 'text') loaders.grade.text('모델 준비 중');
    getWorker().postMessage({ type: 'load', kind });
  };
  const handlers = {
    progress: ({ kind, loaded, total }) => { loaders[kind].progress(loaded, total); if (kind === 'text') loaders.grade.progress(loaded, total); },
    ready: ({ kind, device }) => {
      state.device[kind] = device;
      loaders[kind].done();
      showMeta();
      if (kind === 'text') { loaders.grade.done(); runClassify(); runGrade(); }
      if (kind === 'image') runRemove();
    },
    error: ({ kind, message }) => { if (kind === 'grade') kind = 'text'; requested[kind] = false; if (kind === 'text') loaders.grade.error('불러오지 못했습니다 · 새로고침해 주세요.'); loaders[kind].error('불러오지 못했습니다 · 네트워크를 확인한 뒤 탭을 다시 눌러 주세요.'); console.warn(message); },
    classified: (d) => renderClassify(d),
    removed: (d) => renderRemove(d),
    embedded: (d) => embedWait.get(d.id)?.(d),
  };

  // ---------- 탭 ----------
  const tabs = $$('.od-tab');
  const panels = $$('.od-panel');
  const setTab = (t) => {
    state.tab = t;
    tabs.forEach((b) => b.classList.toggle('is-on', b.dataset.tab === t));
    panels.forEach((p) => p.classList.toggle('is-on', p.dataset.panel === t));
    if (t !== 'hand') stopCam();
    if (t === 'image') loadModel('image');
    if (t === 'text' || t === 'grade') loadModel('text');
    showMeta();
    window.ScrollTrigger?.refresh();
    if (gsap) gsap.fromTo(`.od-panel[data-panel="${t}"] .od-side > *`, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  };
  tabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // 섹션이 가까워지면 첫 번째 모델을 미리 받아 둡니다.
  new IntersectionObserver((es, io) => {
    if (es.some((e) => e.isIntersecting)) { loadModel('text'); io.disconnect(); }
  }, { rootMargin: '900px 0px' }).observe(root);
  // 섹션을 벗어나면 카메라를 끕니다.
  new IntersectionObserver((es) => { if (!es[0].isIntersecting) stopCam(); }).observe(root);

  // ---------- 00. 서술형 답안 채점 (LLM 없이) ----------
  // 1단계 규칙: 짧은 답 · 개인정보 · 띄어쓰기 · 어미 · 핵심어 · 베끼기
  // 2단계 작은 AI 모델: 답안을 마디(절)로 나눠 선생님이 적은 인정 문장과 뜻을 비교
  const RUBRIC = [
    { id: 'light', label: '빛 에너지', pts: 2, kw: ['빛', '햇볕', '햇빛', '태양'], refs: ['빛 에너지가 필요하다', '햇빛을 받아야 한다'], tip: '광합성에 필요한 에너지(빛)' },
    { id: 'co2', label: '이산화탄소', pts: 2, kw: ['이산화탄소', '탄산가스'], sym: [/co2/, 'CO₂'], refs: ['이산화탄소가 필요하다', '공기 중의 이산화탄소를 흡수한다'], tip: '잎으로 들어오는 기체(이산화탄소)' },
    { id: 'water', label: '물', pts: 2, kw: ['^물'], sym: [/h2o/, 'H₂O'], refs: ['물이 필요하다', '뿌리로 물을 흡수한다'], tip: '뿌리로 흡수하는 물' },
    { id: 'sugar', label: '포도당 · 양분', pts: 2, kw: ['포도당', '녹말'], refs: ['포도당이 만들어진다', '양분이 만들어진다'], tip: '만들어지는 양분(포도당)' },
    { id: 'o2', label: '산소', pts: 2, kw: ['산소'], sym: [/(?<!c)o2/, 'O₂'], refs: ['산소가 만들어진다', '산소가 밖으로 나온다'], tip: '밖으로 나오는 기체(산소)' },
  ];
  const STUDENTS = [
    { id: 'A', tag: '모범형', text: '광합성에는 빛 에너지와 이산화탄소, 물이 필요하고, 그 결과 포도당과 산소가 만들어진다.' },
    { id: 'B', tag: '표현이 다름', text: '햇볕을 받은 잎이 공기 속 CO₂를 들이마시고, 뿌리로 빨아들인 수분을 써서 양분을 만들고, O₂ 기체가 나온다.' },
    { id: 'C', tag: '띄어쓰기 · 어미', text: '빛에너지랑 이산화 탄소 그리고 물을 흡수해서 녹말을 만듦' },
    { id: 'D', tag: '너무 짧은 답', text: '잘 모르겠어요' },
    { id: 'E', tag: '베낀 답 · 개인정보', text: '광합성에는 빛 에너지와 이산화탄소, 물이 필요하고 그 결과 포도당과 산소가 만들어진다. 틀리면 010-2481-3579로 연락주세요.' },
  ];
  const ENDINGS = ['하였다', '되었다', '했다', '한다', '해서', '하고', '하며', '되어', '된다', '이랑', '에서', '으로', '에는', '들이', '함', '됨', '듦', '랑', '로', '을', '를', '은', '는', '이', '가', '와', '과', '의', '에', '도'];
  const T_AI = 0.885, MARGIN = 0.015; // 뜻 비교 기준값 · 애매하면 인정하지 않고 선생님에게 넘깁니다

  const ansEl = $('#odAnswer');
  const studentsEl = $('.od-students');
  studentsEl.innerHTML = STUDENTS.map((s, i) => `<button data-i="${i}"${i === 1 ? ' class="is-on"' : ''}><b>학생 ${s.id}</b>${s.tag}</button>`).join('');
  ansEl.value = STUDENTS[1].text;
  $$('button', studentsEl).forEach((b) => b.addEventListener('click', () => {
    $$('button', studentsEl).forEach((x) => x.classList.toggle('is-on', x === b));
    ansEl.value = STUDENTS[+b.dataset.i].text;
    runGrade();
  }));
  let gTimer = null;
  ansEl.addEventListener('input', () => { $$('button', studentsEl).forEach((x) => x.classList.remove('is-on')); clearTimeout(gTimer); gTimer = setTimeout(runGrade, 350); });

  const embedWait = new Map();
  let embedId = 0;
  const embedTexts = (texts) => new Promise((res) => { const id = ++embedId; embedWait.set(id, (d) => { embedWait.delete(id); res(d); }); getWorker().postMessage({ type: 'embed', id, texts }); });
  let refVecs = null;
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stem = (w) => { const t = w.replace(/[.,!?·]/g, ''); for (const e of ENDINGS) if (t.length > e.length + 1 && t.endsWith(e)) return t.slice(0, -e.length); return t; };
  const bigrams = (t) => { const c = t.replace(/\s+/g, ''); const set = new Set(); for (let i = 0; i < c.length - 1; i++) set.add(c.slice(i, i + 2)); return set; };
  const jaccard = (a, b) => { let n = 0; a.forEach((x) => b.has(x) && n++); return n / (a.size + b.size - n || 1); };

  let gradeSeq = 0;
  async function runGrade() {
    if (!state.device.text) return;
    const seq = ++gradeSeq;
    const raw = ansEl.value;
    const t0 = performance.now();
    // 1) 개인정보 가림: 같은 길이의 ●로 바꿔 위치를 유지합니다.
    const spans = [];
    let text = raw.replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+/g, (m, off) => { spans.push({ s: off, e: off + m.length, type: 'pii', tip: '개인정보 가림' }); return '●'.repeat(m.length); });
    const piiCount = spans.length;
    const low = text.toLowerCase().replace(/₂/g, '2');
    // 공백을 뺀 글자 ↔ 원래 위치 지도 (띄어쓰기 차이 맞추기)
    const map = []; let compact = '';
    for (let i = 0; i < low.length; i++) if (!/\s/.test(low[i])) { map.push(i); compact += low[i]; }
    // 어절 목록
    const toks = []; low.replace(/\S+/g, (w, off) => { toks.push({ w, s: off, e: off + w.length }); return w; });
    const short = compact.replace(/[●.,!?]/g, '').length < 8;

    // 2) 핵심어 (띄어쓰기 무시, ^는 어절 맨 앞만)
    const hit = {}; const spacingFix = [];
    RUBRIC.forEach((r) => {
      for (const k of r.kw) {
        if (k.startsWith('^')) {
          const kk = k.slice(1); const t = toks.find((x) => x.w.startsWith(kk));
          if (t) { hit[r.id] = { how: 'kw', word: raw.slice(t.s, t.s + kk.length) }; spans.push({ s: t.s, e: t.s + kk.length, type: 'kw', tip: r.label }); break; }
        } else {
          const at = compact.indexOf(k.replace(/\s/g, ''));
          if (at >= 0) {
            const s = map[at], e = map[at + k.length - 1] + 1, word = raw.slice(s, e);
            hit[r.id] = { how: 'kw', word }; spans.push({ s, e, type: 'kw', tip: r.label });
            if (/\s/.test(word)) spacingFix.push(`${word} → ${word.replace(/\s/g, '')}`);
            break;
          }
        }
      }
    });
    // 화학 기호 맞춤: CO₂ = 이산화탄소, O₂ = 산소, H₂O = 물
    const symFix = [];
    RUBRIC.forEach((r) => {
      if (hit[r.id] || !r.sym) return;
      const m = compact.match(r.sym[0]);
      if (!m) return;
      const s = map[m.index], e = map[m.index + m[0].length - 1] + 1, word = raw.slice(s, e);
      hit[r.id] = { how: 'sym', word }; spans.push({ s, e, type: 'kw', tip: `${r.sym[1]} = ${r.label}` });
      symFix.push(`${word} → ${r.label}`);
    });
    const stems = toks.map((t) => { const from = raw.slice(t.s, t.e).replace(/[.,!?]/g, ''); return { from, to: stem(from), masked: text.slice(t.s, t.e).includes('●') }; }).filter((x) => x.to !== x.from && !x.masked);

    // 3) 작은 AI 모델: 1~3어절 조각과 채점 기준 문장의 뜻 비교
    // 마디 나누기: 문장부호, 그리고 '~고 · ~며 · ~서'로 끝나는 어절 뒤에서 자릅니다.
    const frags = [];
    if (!short) {
      let cur = null;
      const flush = () => { if (cur) { const str = raw.slice(cur.s, cur.e).replace(/[.,!?]+$/, '').trim(); if (str && !text.slice(cur.s, cur.e).includes('●')) frags.push({ s: cur.s, e: cur.s + str.length, str }); } cur = null; };
      toks.forEach((t) => {
        cur = cur ? { s: cur.s, e: t.e } : { s: t.s, e: t.e };
        if (/[.,!?]$/.test(t.w) || /(고|며|서)$/.test(t.w)) flush();
      });
      flush();
    }
    if (!refVecs) {
      const flat = RUBRIC.flatMap((r) => r.refs.map((t) => ({ id: r.id, t })));
      const { vecs } = await embedTexts(flat.map((f) => f.t));
      refVecs = flat.map((f, i) => ({ id: f.id, v: vecs[i] }));
    }
    const fv = frags.length ? (await embedTexts(frags.map((f) => f.str))).vecs : [];
    if (seq !== gradeSeq) return;
    const best = {};
    fv.forEach((v, i) => {
      const per = RUBRIC.map((r) => ({ id: r.id, sim: Math.max(...refVecs.filter((x) => x.id === r.id).map((x) => dot(v, x.v))) })).sort((a, b) => b.sim - a.sim);
      const [top, second] = per;
      if (top.sim >= T_AI && top.sim - second.sim >= MARGIN && !hit[top.id] && (!best[top.id] || top.sim > best[top.id].sim)) best[top.id] = { ...frags[i], sim: top.sim };
    });
    RUBRIC.forEach((r) => {
      if (hit[r.id] || !best[r.id]) return;
      const b = best[r.id];
      hit[r.id] = { how: 'ai', word: b.str, sim: b.sim };
      spans.push({ s: b.s, e: b.e, type: 'ai', tip: `뜻으로 인정 · ${r.label}` });
    });

    // 4) 베끼기 의심: 같은 반 답안과 글자 비교
    const me = bigrams(compact);
    // 먼저 제출한 답안과만 비교합니다 (직접 입력한 답은 반 전체와 비교).
    const curIdx = STUDENTS.findIndex((s) => s.text === raw);
    const pool = curIdx >= 0 ? STUDENTS.slice(0, curIdx) : STUDENTS;
    let copy = { sim: 0, who: pool[0]?.id ?? null };
    pool.forEach((s) => { const j = jaccard(me, bigrams(s.text.toLowerCase().replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, (m) => '●'.repeat(m.length)))); if (j > copy.sim) copy = { sim: j, who: s.id }; });
    const copied = copy.sim >= 0.7;

    let score = short ? 0 : RUBRIC.reduce((a, r) => a + (hit[r.id] ? r.pts : 0), 0);
    const ms = Math.round(performance.now() - t0);
    renderGrade({ raw, spans, hit, short, piiCount, spacingFix, symFix, stems, copy, copied, score, ms });
  }

  function renderGrade({ raw, spans, hit, short, piiCount, spacingFix, symFix, stems, copy, copied, score, ms }) {
    // 형광펜 표시
    spans.sort((a, b) => a.s - b.s);
    let html = '', at = 0;
    spans.forEach((x) => { if (x.s < at) return; html += esc(raw.slice(at, x.s)); const body = x.type === 'pii' ? '●●●-●●●●-●●●●'.slice(0, Math.min(13, x.e - x.s)) : esc(raw.slice(x.s, x.e)); html += `<mark class="${x.type}" title="${esc(x.tip)}">${body}</mark>`; at = x.e; });
    html += esc(raw.slice(at));
    $('.og-answer').innerHTML = html || '<span class="muted">답안이 비어 있습니다.</span>';

    const sc = $('.og-score strong');
    const from = parseFloat(sc.textContent) || 0;
    if (gsap) { const o = { v: from }; gsap.to(o, { v: score, duration: 0.8, ease: 'power3.out', onUpdate: () => (sc.textContent = Math.round(o.v)) }); } else sc.textContent = score;
    const aiN = Object.values(hit).filter((h) => h.how === 'ai').length;
    const st = $('.og-status');
    const check = short || copied;
    st.textContent = check ? '선생님 확인 필요' : aiN ? `자동 채점 · 뜻으로 인정 ${aiN}개` : '자동 채점 완료';
    st.className = 'og-status kr' + (check ? ' warn' : ' ok');

    $('.og-rubric').innerHTML = RUBRIC.map((r) => {
      const h = short ? null : hit[r.id];
      const how = !h ? `<em class="miss">빠짐 · ${r.tip}</em>` : h.how === 'kw' ? `<em class="kw">핵심어 “${esc(h.word)}”</em>` : h.how === 'sym' ? `<em class="kw">기호 “${esc(h.word)}” = ${r.label}</em>` : `<em class="ai">뜻 비교 “${esc(h.word)}” · ${Math.round(h.sim * 100)}%</em>`;
      return `<div class="og-row${h ? ' on' : ''}"><b>${r.label}</b>${how}<span>${h ? r.pts : 0} / ${r.pts}</span></div>`;
    }).join('');

    const row = (ok, label, msg) => `<div class="og-check ${ok}"><i></i><b>${label}</b><span>${msg}</span></div>`;
    $('.og-checks').innerHTML = [
      row(short ? 'warn' : 'ok', '답안 길이', short ? '너무 짧은 답 · 0점 처리 후 선생님 확인' : '통과'),
      row(piiCount ? 'info' : 'ok', '개인정보', piiCount ? `전화번호 · 이메일 ${piiCount}건 가림` : '없음'),
      row(spacingFix.length ? 'info' : 'ok', '띄어쓰기 맞춤', spacingFix.length ? esc(spacingFix.join(' · ')) : '맞출 곳 없음'),
      row(symFix.length ? 'info' : 'ok', '기호 맞춤', symFix.length ? esc(symFix.join(' · ')) : '맞출 곳 없음'),
      row(stems.length ? 'info' : 'ok', '어미 정리', stems.length ? esc(stems.slice(0, 4).map((x) => `${x.from}→${x.to}`).join(' · ')) : '정리할 곳 없음'),
      row(copied ? 'warn' : 'ok', '같은 반 답안 비교', copy.who ? (copied ? `학생 ${copy.who}와 ${Math.round(copy.sim * 100)}% 일치 · 베끼기 의심` : `비슷한 답 없음 · 최고 ${Math.round(copy.sim * 100)}%`) : '먼저 낸 답안 없음'),
    ].join('') + `<p class="og-ms">채점 ${ms}ms · 이 노트북 안에서 처리</p>`;
    if (gsap) gsap.fromTo('.og-row, .og-check', { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, stagger: 0.03, ease: 'power3.out' });
  }

  // ---------- 01. 문의 분류 ----------
  const CATS = [
    { key: 'repair', name: '고장 · AS 접수', examples: ['전원이 안 켜져요', '작동이 갑자기 멈췄어요', '이상한 소리가 나요', '물이 안 나와요', '사료가 안 나와요', '불이 안 들어와요', '고장 난 것 같아요'],
      reply: '불편을 드려 죄송합니다. 제품명과 증상이 보이는 사진 또는 영상을 보내 주시면 AS 접수를 바로 도와드리겠습니다.' },
    { key: 'ship', name: '배송 문의', examples: ['언제 도착하나요', '배송 조회가 안 돼요', '택배가 아직 안 왔어요', '주문했는데 언제 와요', '출고는 언제 되나요'],
      reply: '주문번호를 알려 주시면 출고 상태와 송장 번호를 확인해 드리겠습니다. 평일 오후 2시 전 주문은 당일 출고됩니다.' },
    { key: 'refund', name: '교환 · 환불', examples: ['환불하고 싶어요', '다른 색으로 교환할래요', '반품은 어떻게 하나요', '주문을 취소하고 싶어요', '마음에 안 들어요'],
      reply: '수령 후 7일 이내라면 교환 · 반품이 가능합니다. 주문번호와 사유를 남겨 주시면 회수 접수를 진행하겠습니다.' },
    { key: 'parts', name: '부품 · 소모품 구매', examples: ['필터만 따로 살 수 있나요', '부품을 구매하고 싶어요', '교체용 필터 파나요', '그릇만 추가로 사고 싶어요', '어댑터를 잃어버렸어요'],
      reply: '필터와 교체 부품은 자사몰 소모품 메뉴에서 따로 구매하실 수 있습니다. 제품명을 알려 주시면 맞는 부품을 안내해 드리겠습니다.' },
    { key: 'howto', name: '사용 방법', examples: ['사용법을 모르겠어요', '설정은 어떻게 하나요', '청소는 어떻게 해요', '앱 연결 방법 알려주세요', '시간 예약은 어떻게 해요'],
      reply: '사용 설명 영상과 앱 연결 방법을 보내 드리겠습니다. 막히는 단계를 알려 주시면 그 부분부터 자세히 안내하겠습니다.' },
  ];
  const input = $('#odText');
  const bars = $('.od-bars');
  bars.innerHTML = CATS.map((c) => `<div class="od-bar" data-k="${c.key}"><span>${c.name}</span><i><b></b></i><em>0%</em></div>`).join('');
  let reqId = 0;
  let timer = null;
  const runClassify = () => {
    const text = input.value.trim();
    if (!text || !state.device.text) return;
    getWorker().postMessage({ type: 'classify', id: ++reqId, text, cats: CATS.map(({ key, examples }) => ({ key, examples })) });
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runClassify, 220); });
  $$('.od-chips button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; runClassify(); }));
  let lastTop = null;
  function renderClassify({ id, scores, ms, net }) {
    if (id !== reqId) return;
    state.ms.text = ms + 'ms';
    state.net.text = net;
    showMeta();
    const top = scores.reduce((a, b) => (b.prob > a.prob ? b : a));
    const cat = CATS.find((c) => c.key === top.key);
    $('.od-top').textContent = cat.name;
    $('.od-why').textContent = `가장 가까운 예시 문장: “${top.example}”`;
    $('.od-reply-text').textContent = cat.reply;
    scores.forEach((s) => {
      const row = bars.querySelector(`[data-k="${s.key}"]`);
      row.classList.toggle('is-top', s.key === top.key);
      row.querySelector('b').style.transform = `scaleX(${Math.max(0.01, s.prob)})`;
      row.querySelector('em').textContent = Math.round(s.prob * 100) + '%';
    });
    if (gsap && lastTop !== top.key) gsap.fromTo(['.od-top', '.od-reply-text'], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06 });
    lastTop = top.key;
  }

  // ---------- 02. 배경 제거 ----------
  const cmp = $('.od-compare');
  const before = $('.od-before');
  const afterImg = $('.od-after img');
  const range = $('.od-compare input');
  const save = $('#odSave');
  let current = { src: 'ondevice/sample-feeder.jpg', blob: null };
  let imgId = 0;
  let outURL = null;
  const setPos = (p) => { cmp.style.setProperty('--pos', p + '%'); range.value = p; };
  range.addEventListener('input', () => setPos(range.value));
  before.src = current.src;
  const runRemove = async () => {
    if (!state.device.image) return;
    const id = ++imgId;
    loaders.image.text('배경을 지우는 중');
    $('[data-load="image"]').classList.remove('is-done');
    cmp.classList.add('is-busy');
    const blob = current.blob || (await (await fetch(current.src)).blob());
    if (id !== imgId) return;
    getWorker().postMessage({ type: 'removeBg', id, blob });
  };
  function renderRemove({ id, blob, ms, net }) {
    if (id !== imgId) return;
    loaders.image.done();
    cmp.classList.remove('is-busy');
    state.ms.image = (ms / 1000).toFixed(2) + '초';
    state.net.image = net;
    showMeta();
    if (outURL) URL.revokeObjectURL(outURL);
    outURL = URL.createObjectURL(blob);
    afterImg.src = outURL;
    save.href = outURL;
    save.removeAttribute('aria-disabled');
    if (gsap) { const o = { p: 100 }; gsap.to(o, { p: 50, duration: 1.4, ease: 'power3.inOut', onUpdate: () => setPos(o.p) }); } else setPos(50);
  }
  const pick = (src, blob = null) => {
    current = { src, blob };
    before.src = src;
    afterImg.removeAttribute('src');
    setPos(100);
    save.setAttribute('aria-disabled', 'true');
    runRemove();
  };
  $$('.od-thumbs button').forEach((b) => b.addEventListener('click', () => {
    $$('.od-thumbs button').forEach((x) => x.classList.toggle('is-on', x === b));
    pick(b.dataset.src);
  }));
  $('#odFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $$('.od-thumbs button').forEach((x) => x.classList.remove('is-on'));
    pick(URL.createObjectURL(f), f);
    e.target.value = '';
  });

  // ---------- 03. 손 인식 (MediaPipe) ----------
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
  const video = $('.od-hand-stage video');
  const canvas = $('.od-hand-stage canvas');
  const ctx = canvas.getContext('2d');
  const camBtn = $('#odCam');
  const gestureEl = $('.od-gesture b');
  const fpsEl = $('.od-fps');
  const GESTURES = {
    Open_Palm: ['손바닥', '#62f0dd'], Closed_Fist: ['주먹', '#ff8a6b'], Victory: ['브이', '#b48cff'],
    Thumb_Up: ['엄지 척', '#ffd27a'], Thumb_Down: ['엄지 아래', '#ff6b8a'], Pointing_Up: ['검지 위로', '#3ccfe6'], ILoveYou: ['사랑해', '#ff9ad5'], None: ['손', '#62f0dd'],
  };
  const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
  let recognizer = null, stream = null, raf = 0, lastT = -1, netWatch = null;
  const orb = { x: 0.5, y: 0.5, r: 40, color: '#62f0dd', trail: [] };
  let frames = 0, fpsT = performance.now();

  async function getRecognizer() {
    if (recognizer) return recognizer;
    loaders.hand.text('손 인식 모델 내려받는 중 · 8MB');
    const { FilesetResolver, GestureRecognizer } = await import(`${MP}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task', delegate }, runningMode: 'VIDEO', numHands: 2 });
    try { recognizer = await GestureRecognizer.createFromOptions(fileset, opts('GPU')); state.device.hand = 'WebGL · GPU'; }
    catch { recognizer = await GestureRecognizer.createFromOptions(fileset, opts('CPU')); state.device.hand = 'WASM · CPU'; }
    return recognizer;
  }

  async function startCam() {
    camBtn.disabled = true;
    try {
      const [rec, s] = await Promise.all([getRecognizer(), navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720, facingMode: 'user' }, audio: false })]);
      stream = s;
      video.srcObject = s;
      await video.play();
      loaders.hand.done();
      root.classList.add('cam-on');
      camBtn.textContent = '카메라 끄기';
      // 카메라가 켜진 동안 페이지에서 나가는 요청 수를 셉니다.
      state.net.hand = 0;
      netWatch = new PerformanceObserver((list) => {
        const n = list.getEntries().filter((e) => ['fetch', 'xmlhttprequest', 'beacon'].includes(e.initiatorType)).length;
        if (n) { state.net.hand += n; showMeta(); }
      });
      netWatch.observe({ type: 'resource' });
      showMeta();
      loop(rec);
    } catch (e) {
      console.warn(e);
      loaders.hand.error(e?.name === 'NotAllowedError' ? '카메라 권한이 필요합니다 · 주소창에서 허용해 주세요.' : '카메라를 시작하지 못했습니다.');
    }
    camBtn.disabled = false;
  }
  function stopCam() {
    if (!stream) return;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    netWatch?.disconnect();
    root.classList.remove('cam-on');
    camBtn.textContent = '카메라 켜기';
    gestureEl.textContent = '–';
    fpsEl.textContent = '– fps';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    loaders.hand.text('카메라를 껐습니다');
  }
  camBtn.addEventListener('click', () => (stream ? stopCam() : startCam()));

  function loop(rec) {
    raf = requestAnimationFrame(() => loop(rec));
    if (video.readyState < 2 || video.currentTime === lastT) return;
    lastT = video.currentTime;
    const W = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const H = (canvas.height = canvas.clientHeight * devicePixelRatio);
    const t0 = performance.now();
    const res = rec.recognizeForVideo(video, t0);
    state.ms.hand = (performance.now() - t0).toFixed(0) + 'ms';
    frames++;
    if (t0 - fpsT > 500) { fpsEl.textContent = Math.round((frames * 1000) / (t0 - fpsT)) + ' fps'; frames = 0; fpsT = t0; showMeta(); }

    // 영상이 화면을 꽉 채우도록(cover) 좌표를 맞추고, 거울처럼 좌우를 뒤집습니다.
    const vw = video.videoWidth, vh = video.videoHeight;
    const sc = Math.max(W / vw, H / vh);
    const ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
    const P = (p) => [W - (ox + p.x * vw * sc), oy + p.y * vh * sc];

    ctx.clearRect(0, 0, W, H);
    const hands = res.landmarks || [];
    if (hands.length) {
      const g = res.gestures?.[0]?.[0]?.categoryName || 'None';
      const [label, color] = GESTURES[g] || GESTURES.None;
      gestureEl.textContent = label;
      orb.color = color;
      const lm = hands[0];
      const [tx, ty] = P(lm[8]);
      const [ax, ay] = P(lm[4]);
      const [wx, wy] = P(lm[0]);
      const [mx, my] = P(lm[9]);
      const size = Math.hypot(mx - wx, my - wy) || 1;
      const pinch = Math.min(1.6, Math.hypot(tx - ax, ty - ay) / size);
      const target = g === 'Open_Palm' ? size * 0.55 : g === 'Closed_Fist' ? size * 0.14 : size * (0.07 + pinch * 0.26);
      orb.x += (tx - orb.x) * 0.45; orb.y += (ty - orb.y) * 0.45; orb.r += (target - orb.r) * 0.2;
      orb.trail.push([orb.x, orb.y]); if (orb.trail.length > 24) orb.trail.shift();
      hands.forEach((h) => drawHand(h.map(P), color));
    } else {
      gestureEl.textContent = '손을 화면에 보여 주세요';
      orb.trail.shift();
    }
    drawOrb(W);
  }
  function drawHand(pts, color) {
    ctx.lineWidth = 2.5 * devicePixelRatio;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    LINKS.forEach(([a, b]) => { ctx.moveTo(...pts[a]); ctx.lineTo(...pts[b]); });
    ctx.stroke();
    ctx.fillStyle = color;
    pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, (i % 4 === 0 ? 5 : 3.5) * devicePixelRatio, 0, Math.PI * 2); ctx.fill(); });
  }
  function drawOrb() {
    if (!orb.trail.length) return;
    ctx.globalCompositeOperation = 'lighter';
    orb.trail.forEach(([x, y], i) => {
      const k = i / orb.trail.length;
      ctx.beginPath(); ctx.fillStyle = hexA(orb.color, 0.08 * k); ctx.arc(x, y, orb.r * k, 0, Math.PI * 2); ctx.fill();
    });
    const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r * 1.6);
    g.addColorStop(0, hexA(orb.color, 0.95)); g.addColorStop(0.35, hexA(orb.color, 0.45)); g.addColorStop(1, hexA(orb.color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hexA(orb.color, 0.8); ctx.lineWidth = 1.5 * devicePixelRatio;
    ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r * 1.15 + Math.sin(performance.now() / 300) * 4, 0, Math.PI * 2); ctx.stroke();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  showMeta();
}
