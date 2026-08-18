// ═══════════════════════════════════════════════
// LUVINFO — app.js v9 (신판: 장 2종 + 프리셋 4종)
// luvlog(lovelog-cc579)와 같은 Firebase, 별도 컬렉션(tsites/tusers)
// ═══════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage, ref as sref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);

const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
const st = { user: null, myHandle: null, handle: null, site: null, mine: false, edit: false, dirty: false, cur: 0 };

console.log('[LUVINFO] app.js v13 로드');

function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('on'), 2400);
}

// ── 프리셋 기본값 (색 피커 표시용) ──
const PRESETS = {
  white: { bg: '#FDFDFC', tx: '#1F1E1C', pri: '#1F1E1C' },
  dark:  { bg: '#08080B', tx: '#E8E4DA', pri: '#C9A227' },
  diary: { bg: '#F7F3EA', tx: '#4A4238', pri: '#B0693C' },
  cute:  { bg: '#FDF6F8', tx: '#5C4A52', pri: '#E58FA8' },
  mono:  { bg: '#FFFFFF', tx: '#151515', pri: '#151515' },
  glass: { bg: '#EDF0F7', tx: '#3A3F52', pri: '#6B7AA8' },
  midnight: { bg: '#0B1026', tx: '#DCE0F2', pri: '#8E9BD8' },
  forest: { bg: '#12201A', tx: '#E3E9E1', pri: '#7FB89A' }
};

function defaultSite(ownerUid, handle) {
  return {
    ownerUid,
    head: { mode: 'text', over: 'INFO', title: handle.toUpperCase(), sub: 'TASTE ARCHIVE', img: '' },
    theme: { preset: 'white', bg: '', tx: '', pri: '', font: "'Pretendard'", nav: 'dot', num: 'on', css: '', corner: '', cardop: '', bgImg: '', bgDim: 84, valign: '' },
    gate: { on: false, msg: '', pw: '', img: '' },
    chapters: [{
      id: uid(), title: '기본', type: 'cell',
      body: '첫 장이에요. 하단 ✎ 편집을 눌러 자유롭게 고쳐보세요.\n\n빈 줄로 문단을 나누고, 사진과 접은 글도 넣을 수 있어요.\n\n{접기:접은 글은 이렇게}\n눌러서 펼치는 내용이 여기 들어가요.\n{접기끝}',
      imgs: []
    }],
    heart: 0,
    updated: Date.now()
  };
}

// ═══════════ 라우팅 ═══════════
function targetHandle() {
  const saved = sessionStorage.getItem('sh_route');
  if (saved) { sessionStorage.removeItem('sh_route'); history.replaceState(null, '', saved); }
  const seg = (location.pathname.match(/[^/]+$/) || [''])[0];
  if (seg && seg !== 'index.html') return seg.toLowerCase();
  const q = new URLSearchParams(location.search).get('h');
  return q ? q.toLowerCase() : null;
}

async function boot() {
  onAuthStateChanged(auth, async (u) => {
    st.user = u;
    if (u) {
      try {
        const ud = await getDoc(doc(db, 'tusers', u.uid));
        st.myHandle = ud.exists() ? ud.data().handle : null;
      } catch (e) { console.log('[LUVINFO] tusers err', e); }
    } else {
      st.myHandle = null;
    }
    route();
  });
}

async function route() {
  const h = st._routed ? st.handle : targetHandle();
  st._routed = true;
  $('#loading').style.display = 'none';
  if (!h) {
    if (st.myHandle) {
      $('#landing-my').style.display = 'block';
      $('#btn-myhome').onclick = () => { location.href = BASE + '?h=' + st.myHandle; };
    }
    $('#landing').classList.add('show');
    $('#btn-start').onclick = login;
    return;
  }
  st.handle = h;
  let d;
  try { d = await getDoc(doc(db, 'tsites', h)); }
  catch (e) { console.log('[LUVINFO] load err', e); toast('불러오기 실패'); return; }
  if (!d.exists()) {
    $('#landing').classList.add('show');
    $('#landing .desc').textContent = '@' + h + ' — 존재하지 않는 페이지예요.';
    $('#btn-start').onclick = login;
    return;
  }
  st.site = migrate(d.data());
  st.mine = !!(st.user && st.site.ownerUid === st.user.uid);
  const g = st.site.gate || {};
  if (g.on && !st.mine && sessionStorage.getItem('sh_gate_' + h) !== '1') {
    showGate(g);
    return;
  }
  showSite();
}

// v8(블록 구조) 문서 → 신 구조로 (하트·게이트만 승계, 새 출발)
function migrate(data) {
  if (data.chapters) return data;
  const fresh = defaultSite(data.ownerUid, st.handle);
  fresh.heart = data.heart || 0;
  if (data.gate) fresh.gate = { on: !!data.gate.on, msg: data.gate.msg || '', pw: data.gate.pw || '', img: data.gate.img || '' };
  fresh._migrated = true;
  return fresh;
}

function showGate(g) {
  $('#gate').classList.add('show');
  if (g.img) { $('#gate-img').src = g.img; $('#gate-img').style.display = 'block'; }
  $('#gate-msg').textContent = g.msg || 'WELCOME';
  $('#gate-pw').style.display = g.pw ? 'block' : 'none';
  const enter = () => {
    if (g.pw && $('#gate-pw').value !== g.pw) { toast('비밀번호가 달라요'); return; }
    sessionStorage.setItem('sh_gate_' + st.handle, '1');
    $('#gate').classList.remove('show');
    showSite();
  };
  $('#gate-enter').onclick = enter;
  $('#gate-pw').onkeydown = (e) => { if (e.key === 'Enter') enter(); };
}

// ═══════════ 로그인 / 가입 ═══════════
async function login() {
  try {
    const r = await signInWithPopup(auth, new GoogleAuthProvider());
    const ud = await getDoc(doc(db, 'tusers', r.user.uid));
    if (!ud.exists()) openClaim(r.user);
    else location.href = BASE + '?h=' + ud.data().handle;
  } catch (e) {
    console.log('[LUVINFO] login err', e);
    toast('로그인에 실패했어요');
  }
}

function openClaim(user) {
  $('#landing').classList.remove('show');
  $('#claim').classList.add('on');
  $('#claim-cancel').onclick = () => { $('#claim').classList.remove('on'); $('#landing').classList.add('show'); };
  $('#claim-ok').onclick = async () => {
    const h = $('#claim-h').value.trim().toLowerCase();
    if (!/^[a-z0-9]{2,20}$/.test(h)) { toast('영문 소문자·숫자 2~20자로 입력해 주세요'); return; }
    const ex = await getDoc(doc(db, 'tsites', h));
    if (ex.exists()) { toast('이미 사용 중인 핸들이에요'); return; }
    try {
      await setDoc(doc(db, 'tsites', h), defaultSite(user.uid, h));
      await setDoc(doc(db, 'tusers', user.uid), { handle: h });
      location.href = BASE + '?h=' + h;
    } catch (e) {
      console.log('[LUVINFO] claim err', e);
      toast('생성 실패 — 잠시 후 다시 시도해 주세요');
    }
  };
}

// ═══════════ 렌더 ═══════════
function applyTheme() {
  const t = st.site.theme || {};
  document.body.dataset.preset = t.preset || 'white';
  const b = document.body.style;
  if (t.bg) b.setProperty('--bg', t.bg); else b.removeProperty('--bg');
  if (t.tx) b.setProperty('--tx', t.tx); else b.removeProperty('--tx');
  if (t.pri) b.setProperty('--pri', t.pri); else b.removeProperty('--pri');
  b.setProperty('--font', t.font || "'Pretendard'");
  $('#usercss').textContent = t.css || '';
  if (t.corner) document.body.dataset.corner = t.corner; else delete document.body.dataset.corner;
  if (t.valign) document.body.dataset.valign = t.valign; else delete document.body.dataset.valign;
  if (t.cardop) document.body.dataset.op = t.cardop; else delete document.body.dataset.op;
  const sb = $('#site');
  if (t.bgImg) {
    const dim = Math.min(96, Math.max(30, parseInt(t.bgDim) || 84));
    const ov = 'color-mix(in srgb, var(--bg) ' + dim + '%, transparent)';
    sb.style.backgroundImage = 'linear-gradient(' + ov + ', ' + ov + '), url("' + t.bgImg + '")';
    sb.style.backgroundSize = 'cover';
    sb.style.backgroundPosition = 'center';
    sb.style.backgroundAttachment = 'fixed';
  } else {
    sb.style.backgroundImage = '';
  }
  const hd = st.site.head || {};
  document.body.dataset.head = hd.mode || 'text';
  $('#h-over').textContent = hd.over || '';
  $('#h-over').style.display = hd.over ? '' : 'none';
  $('#h-title').textContent = hd.title || '';
  $('#h-sub').textContent = hd.sub || '';
  $('#h-sub').style.display = hd.sub ? '' : 'none';
  const hi = $('#head-img');
  if (hd.img) hi.style.backgroundImage = 'url("' + hd.img + '")';
  else hi.style.backgroundImage = 'linear-gradient(150deg, var(--line), var(--card))';
  document.title = (hd.title || st.handle) + ' — LUVINFO';
}

function showSite() {
  $('#site').style.display = 'block';
  $('#fabs').style.display = 'flex';
  applyTheme();
  renderChapter();
  renderFoot();
  if (st.mine) {
    $('#fab-edit').style.display = 'block';
    $('#fab-view').style.display = 'block';
    $('#fab-edit').onclick = toggleEdit;
    if (st.site._migrated) toast('새 구조로 새 출발이에요 — ✎ 편집으로 채워보세요');
  } else if (!st.user) {
    $('#fab-login').style.display = 'block';
    $('#fab-login').onclick = login;
  } else if (st.myHandle && st.myHandle !== st.handle) {
    $('#fab-my').style.display = 'block';
    $('#fab-my').onclick = () => { location.href = BASE + '?h=' + st.myHandle; };
  }
  bindShell();
}

function chDisplayName(ch, i) {
  const numOn = (st.site.theme?.num || 'on') === 'on';
  const nn = String(i + 1).padStart(2, '0');
  if (ch.title && numOn) return nn + ' — ' + ch.title;
  if (ch.title) return ch.title;
  if (numOn) return nn;
  return '';
}

function renderChapter() {
  const chs = st.site.chapters || [];
  if (st.cur >= chs.length) st.cur = Math.max(0, chs.length - 1);
  const ch = chs[st.cur];
  const titleEl = $('#ch-title');
  const bodyEl = $('#ch-body');
  if (!ch) {
    titleEl.style.display = 'none';
    bodyEl.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:12.5px;letter-spacing:.1em;padding:40px 0;">아직 장이 없어요' + (st.mine ? ' — ✎ 편집으로 시작' : '') + '</p>';
    renderPager();
    return;
  }
  const name = chDisplayName(ch, st.cur);
  titleEl.textContent = name;
  titleEl.style.display = name ? '' : 'none';
  if (ch.type === 'html') {
    bodyEl.innerHTML = '<div class="htmlblk"></div>';
    bodyEl.querySelector('.htmlblk').innerHTML = ch.body || '';
  } else {
    bodyEl.innerHTML = '<div class="cellbody">' + renderCellBody(ch.body, ch.imgs) + '</div>';
    mountElements(ch, bodyEl);
  }
  renderPager();
}

// 보통 장 본문: 빈 줄 문단 + [사진N] + {접기:제목}…{접기끝}
function renderCellBody(body, imgs) {
  const parts = [];
  let rest = body || '';
  const re = /\{접기:(.*?)\}([\s\S]*?)\{접기끝\}/;
  let m;
  while ((m = re.exec(rest))) {
    parts.push({ fold: false, v: rest.slice(0, m.index) });
    parts.push({ fold: true, title: m[1], v: m[2] });
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push({ fold: false, v: rest });

  const block = (raw) => {
    let s = esc((raw || '').trim());
    if (!s) return '';
    s = s.replace(/\[사진(\d+)\]/g, (mm, n) => {
      const u = (imgs || [])[parseInt(n) - 1];
      return u ? '</p><img src="' + esc(u) + '" alt="" loading="lazy"><p>' : '';
    });
    s = s.replace(/\[프로필\]/g, '</p><div class="elslot" data-el="pf"></div><p>');
    s = s.replace(/\[갤러리\]/g, '</p><div class="elslot" data-el="gal"></div><p>');
    s = s.replace(/\[음악\]/g, '</p><div class="elslot" data-el="mu"></div><p>');
    s = s.replace(/\[스티커\]/g, '</p><div class="elslot" data-el="stk"></div><p>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/__(.+?)__/g, '<u>$1</u>');
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
    return s.split(/\n{2,}/).map((p) => {
      if (p.trim() === '---') return '<div class="divider">✦</div>';
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  };

  return parts.map((p) => {
    if (!p.fold) return block(p.v);
    return '<div class="fold"><div class="fold-head"><span>' + esc(p.title || '더 보기') + '</span></div>' +
      '<div class="fold-body"><div class="fold-body-in">' + block(p.v) + '</div></div></div>';
  }).join('');
}

// ═══════════ 장 내 요소 렌더 ═══════════
function imgVars(o) {
  const z = parseInt(o.z) || 100;
  return 'background-image:url("' + esc(o.u || o.img || '') + '");--pz:' + z + '%;--px:' + (o.x ?? 50) + '%;--py:' + (o.y ?? 50) + '%;';
}

function mountElements(ch, root) {
  const el = ch.el || {};
  root.querySelectorAll('.elslot').forEach((slot) => {
    const kind = slot.dataset.el;
    if (kind === 'pf' && el.pf) slot.replaceWith(buildProfile(el.pf));
    else if (kind === 'gal' && el.gal && (el.gal.imgs || []).length) slot.replaceWith(buildGallery(el.gal));
    else if (kind === 'mu' && el.mu) slot.replaceWith(buildMusic(el.mu));
    else if (kind === 'stk' && el.stk && (el.stk.items || []).length) slot.replaceWith(buildSticker(el.stk));
    else slot.remove();
  });
}

function buildProfile(p) {
  const d = document.createElement('div');
  d.className = 'pf';
  d.dataset.pos = p.pos || 'left';
  const imgStyle = (p.img ? imgVars({ u: p.img, z: p.z, x: p.x, y: p.y }) : '') + '--psize:' + (parseInt(p.size) || 64) + 'px;';
  d.innerHTML =
    '<div class="pf-img" data-shape="' + esc(p.shape || 'circle') + '" style="' + imgStyle + '">' + (p.img ? '' : '✦') + '</div>' +
    '<div class="pf-txt">' +
    (p.nm ? '<span class="pf-nm">' + esc(p.nm) + '</span>' : '') +
    (p.acc ? '<span class="pf-acc">' + esc(p.acc) + '</span>' : '') +
    (p.ds ? '<div class="pf-ds">' + esc(p.ds).replace(/\n/g, '<br>') + '</div>' : '') +
    '</div>';
  return d;
}

function buildGallery(g) {
  const wrap = document.createElement('div');
  wrap.className = 'gal';
  const imgs = g.imgs || [];
  if (g.layout === 'slider') {
    wrap.innerHTML = '<div class="gal-slider"><div class="gal-track">' +
      imgs.map((it) => '<div class="gal-slide" style="background-image:url(\'' + esc(it.u) + '\')"></div>').join('') +
      '</div><div class="gal-arrow gal-prev">‹</div><div class="gal-arrow gal-next">›</div><div class="gal-nav"></div></div>';
    initGalSlider(wrap.querySelector('.gal-slider'), imgs);
  } else {
    wrap.innerHTML = '<div class="gal-grid" data-cols="' + (parseInt(g.layout) || 3) + '">' +
      imgs.map((it) => '<div class="gal-cell" style="' + imgVars(it).replace(/--p/g, '--g') + '"></div>').join('') +
      '</div>';
    wrap.querySelectorAll('.gal-cell').forEach((c, i) => {
      c.onclick = () => { $('#lb-img').src = imgs[i].u; $('#lightbox').classList.add('on'); };
    });
  }
  return wrap;
}

function initGalSlider(rootEl, imgs) {
  let cur = 0;
  const slides = rootEl.querySelectorAll('.gal-slide');
  const nav = rootEl.querySelector('.gal-nav');
  slides.forEach((s, i) => {
    s.onclick = () => { $('#lb-img').src = imgs[i].u; $('#lightbox').classList.add('on'); };
    const dd = document.createElement('div');
    dd.className = 'gal-dot' + (i === 0 ? ' on' : '');
    dd.onclick = () => go(i);
    nav.appendChild(dd);
  });
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s) => { s.style.transform = 'translateX(-' + (cur * 100) + '%)'; });
    nav.querySelectorAll('.gal-dot').forEach((dd, j) => dd.classList.toggle('on', j === cur));
  }
  rootEl.querySelector('.gal-prev').onclick = (e) => { e.stopPropagation(); go(cur - 1); };
  rootEl.querySelector('.gal-next').onclick = (e) => { e.stopPropagation(); go(cur + 1); };
}

function buildMusic(m) {
  const d = document.createElement('div');
  d.className = 'music';
  d.innerHTML = '<div class="m-disc"></div><div class="m-info">' +
    '<div class="m-title">' + esc(m.title || '') + '</div>' +
    '<div class="m-artist">' + esc(m.artist || '') + '</div>' +
    '<div class="m-bar"><i></i></div></div><button class="m-btn">▶</button>';
  const btn = d.querySelector('.m-btn');
  let audio = null;
  btn.onclick = () => {
    if (m.url) {
      if (!audio) {
        audio = new Audio(m.url);
        audio.ontimeupdate = () => { if (audio.duration) d.querySelector('.m-bar i').style.width = (audio.currentTime / audio.duration * 100) + '%'; };
        audio.onended = () => { d.classList.remove('playing'); btn.textContent = '▶'; };
      }
      if (audio.paused) { audio.play().catch(() => toast('오디오를 재생할 수 없어요')); d.classList.add('playing'); btn.textContent = '❚❚'; }
      else { audio.pause(); d.classList.remove('playing'); btn.textContent = '▶'; }
    } else {
      d.classList.toggle('playing');
      btn.textContent = d.classList.contains('playing') ? '❚❚' : '▶';
    }
  };
  return d;
}

function buildSticker(s) {
  const d = document.createElement('div');
  d.className = 'stk';
  d.innerHTML = (s.items || []).map((it) =>
    '<img src="' + esc(it.u) + '" style="width:' + (parseInt(it.size) || 64) + 'px;transform:rotate(' + (parseInt(it.rot) || 0) + 'deg);" alt="">'
  ).join('');
  return d;
}

// ═══════════ 사진 조정 팝업 (공용) ═══════════
let adjT = null, adjCb = null, adjDrag = null;
function openAdjust(target, cb) {
  adjT = target; adjCb = cb;
  target.z = parseInt(target.z) || 100;
  target.x = target.x ?? 50;
  target.y = target.y ?? 50;
  const v = $('#adj-view');
  v.style.backgroundImage = 'url("' + (target.u || target.img || '') + '")';
  $('#adj-zoom').value = target.z;
  adjApply();
  $('#adj-bg').classList.add('on');
  $('#adj').classList.add('on');
}
function adjApply() {
  const v = $('#adj-view');
  v.style.backgroundSize = adjT.z + '% auto';
  v.style.backgroundPosition = adjT.x + '% ' + adjT.y + '%';
}
function closeAdjust() {
  $('#adj-bg').classList.remove('on');
  $('#adj').classList.remove('on');
  if (adjCb) adjCb();
  adjT = null; adjCb = null;
}
function bindAdjust() {
  const v = $('#adj-view');
  $('#adj-ok').onclick = closeAdjust;
  $('#adj-bg').onclick = closeAdjust;
  $('#adj-zoom').oninput = (e) => { if (adjT) { adjT.z = parseInt(e.target.value); adjApply(); } };
  v.addEventListener('pointerdown', (e) => {
    if (!adjT) return;
    adjDrag = { cx: e.clientX, cy: e.clientY, x: adjT.x, y: adjT.y };
    v.classList.add('grab');
    v.setPointerCapture(e.pointerId);
  });
  v.addEventListener('pointermove', (e) => {
    if (!adjDrag || !adjT) return;
    const r = v.getBoundingClientRect();
    const sc = Math.max((adjT.z / 100) - 1, .3);
    adjT.x = Math.min(100, Math.max(0, adjDrag.x - (e.clientX - adjDrag.cx) / r.width * 100 / sc));
    adjT.y = Math.min(100, Math.max(0, adjDrag.y - (e.clientY - adjDrag.cy) / r.height * 100 / sc));
    adjApply();
  });
  v.addEventListener('pointerup', () => { adjDrag = null; v.classList.remove('grab'); });
}

function renderPager() {
  const nav = st.site.theme?.nav || 'dot';
  const chs = st.site.chapters || [];
  const pg = $('#pager');
  pg.innerHTML = '';
  if (chs.length <= 1) return;
  const arrow = (dir, label) => {
    const b = document.createElement('button');
    b.className = 'pg-arrow';
    b.textContent = label;
    b.onclick = () => go(st.cur + dir);
    return b;
  };
  if (nav === 'arrow') {
    pg.appendChild(arrow(-1, '‹'));
    const n = document.createElement('span');
    n.className = 'pg-num';
    n.textContent = (st.cur + 1) + ' / ' + chs.length;
    pg.appendChild(n);
    pg.appendChild(arrow(1, '›'));
  } else if (nav === 'pill') {
    chs.forEach((ch, i) => {
      const b = document.createElement('button');
      b.className = 'pg-pill' + (i === st.cur ? ' on' : '');
      b.textContent = ch.title || String(i + 1).padStart(2, '0');
      b.onclick = () => go(i);
      pg.appendChild(b);
    });
  } else {
    pg.appendChild(arrow(-1, '‹'));
    const dots = document.createElement('div');
    dots.className = 'pg-dots';
    chs.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'pg-dot' + (i === st.cur ? ' on' : '');
      d.onclick = () => go(i);
      dots.appendChild(d);
    });
    pg.appendChild(dots);
    pg.appendChild(arrow(1, '›'));
  }
}

function go(i) {
  const chs = st.site.chapters || [];
  if (!chs.length) return;
  st.cur = ((i % chs.length) + chs.length) % chs.length;
  renderChapter();
  window.scrollTo({ top: 0 });
}

function renderFoot() {
  $('#hcount').textContent = st.site.heart || 0;
  const liked = localStorage.getItem('sh_like_' + st.handle) === '1';
  $('#heart').classList.toggle('liked', liked);
  $('#heart .h').textContent = liked ? '♥' : '♡';
  const d = new Date(st.site.updated || Date.now());
  $('#upd-date').textContent = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}

let shellBound = false;
function bindShell() {
  if (shellBound) return;
  shellBound = true;
  // 접은 글 · 사진 라이트박스 (위임)
  $('#ch-body').addEventListener('click', (e) => {
    const fh = e.target.closest('.fold-head');
    if (fh) { fh.parentElement.classList.toggle('open'); return; }
    const img = e.target.closest('.cellbody img');
    if (img) { $('#lb-img').src = img.src; $('#lightbox').classList.add('on'); }
  });
  $('#lightbox').onclick = () => $('#lightbox').classList.remove('on');
  $('#heart').onclick = async () => {
    if (st.mine) { toast('내 하트는 셀 수 없어요 🙂'); return; }
    const key = 'sh_like_' + st.handle;
    const liked = localStorage.getItem(key) === '1';
    const delta = liked ? -1 : 1;
    localStorage.setItem(key, liked ? '0' : '1');
    st.site.heart = (st.site.heart || 0) + delta;
    renderFoot();
    try { await updateDoc(doc(db, 'tsites', st.handle), { heart: increment(delta) }); }
    catch (e) { console.log('[LUVINFO] heart err', e); }
  };
  $('#copy-link').onclick = () => {
    navigator.clipboard?.writeText(BASE + '?h=' + st.handle)
      .then(() => toast('링크를 복사했어요 ✓'))
      .catch(() => toast('복사에 실패했어요'));
  };
  $('#foot-brand').onclick = (e) => { e.preventDefault(); location.href = BASE; };

  // 주인 바
  $('#ob-add').onclick = () => openChapterEdit(null, 'cell');
  $('#ob-addhtml').onclick = () => openChapterEdit(null, 'html');
  $('#ob-deco').onclick = openDeco;
  $('#ob-save').onclick = saveSite;

  // 장 도구
  $('#ct-edit').onclick = () => { const ch = st.site.chapters[st.cur]; if (ch) openChapterEdit(ch, ch.type); };
  $('#ct-up').onclick = () => moveChapter(-1);
  $('#ct-down').onclick = () => moveChapter(1);
  $('#ct-del').onclick = () => {
    const chs = st.site.chapters;
    if (!chs[st.cur]) return;
    if (!confirm('이 장을 삭제할까요?')) return;
    chs.splice(st.cur, 1);
    st.dirty = true;
    if (st.cur >= chs.length) st.cur = Math.max(0, chs.length - 1);
    renderChapter();
  };

  // 시트 닫기
  $('#es-close').onclick = closeEditSheet;
  $('#es-cancel').onclick = closeEditSheet;
  $('#edit-bg').onclick = closeEditSheet;
  $('#dc-close').onclick = closeDeco;
  $('#deco-bg').onclick = closeDeco;

  bindDeco();
  bindEditor();
  bindAdjust();
  $('#fab-view').onclick = () => {
    const on = document.body.classList.toggle('mv');
    $('#fab-view').textContent = on ? '💻' : '📱';
  };
}

function moveChapter(d) {
  const chs = st.site.chapters;
  const j = st.cur + d;
  if (j < 0 || j >= chs.length) return;
  const [ch] = chs.splice(st.cur, 1);
  chs.splice(j, 0, ch);
  st.cur = j;
  st.dirty = true;
  renderChapter();
}

// ═══════════ 편집 모드 ═══════════
function toggleEdit() {
  st.edit = document.body.classList.toggle('edit');
  $('#fab-edit').textContent = st.edit ? '보기 모드' : '✎ 편집';
  if (!st.edit) {
    closeEditSheet(); closeDeco();
    if (st.dirty) toast('저장하지 않은 변경이 있어요 — ✓ 저장을 눌러 주세요');
  }
}

// ── 장 편집 시트 ──
let work = null;   // 편집 중인 장 (신규면 임시 초안)
let isNewCh = false;

function ensureEl(kind, def) {
  work.el = work.el || {};
  if (!work.el[kind]) work.el[kind] = def;
  return work.el[kind];
}
const epCfg = () => ensureEl('pf', { img: '', z: 100, x: 50, y: 50, pos: 'left', shape: 'circle', size: 64, nm: '', acc: '', ds: '' });
const egCfg = () => ensureEl('gal', { layout: '3', imgs: [] });
const emCfg = () => ensureEl('mu', { title: '', artist: '', url: '' });
const eskCfg = () => ensureEl('stk', { items: [] });

function openChapterEdit(ch, type) {
  work = ch || { id: uid(), title: '', type, body: '', imgs: [], el: {} };
  work.el = work.el || {};
  work.imgs = work.imgs || [];
  isNewCh = !ch;
  $('#es-title').textContent = ch ? '장 수정' : (type === 'html' ? '새 HTML 장' : '새 장');
  $('#es-name').value = work.title || '';
  const isHtml = type === 'html';
  $('#es-cellrow').style.display = isHtml ? 'none' : 'block';
  $('#es-htmlrow').style.display = isHtml ? 'block' : 'none';
  if (isHtml) $('#es-html').value = work.body || '';
  else {
    $('#es-body').value = work.body || '';
    renderImgChips(work.imgs);
    $$('.ea').forEach((a) => a.classList.remove('open'));
    fillElementForms();
  }
  $('#edit-bg').classList.add('on');
  $('#edit-sheet').classList.add('on');
}

function markerSt(marker) { return ($('#es-body').value || '').includes(marker) ? '배치됨' : ''; }

function fillElementForms() {
  const pf = work.el.pf;
  $('#ep-nm').value = pf?.nm || '';
  $('#ep-acc').value = pf?.acc || '';
  $('#ep-ds').value = pf?.ds || '';
  $('#ep-pos').value = pf?.pos || 'left';
  $('#ep-shape').value = pf?.shape || 'circle';
  $('#ep-size').value = parseInt(pf?.size) || 64;
  $('#ep-sizev').textContent = (parseInt(pf?.size) || 64) + 'px';
  $('#ep-st').textContent = markerSt('[프로필]');
  const gal = work.el.gal;
  $('#eg-layout').value = gal?.layout || '3';
  $('#eg-st').textContent = markerSt('[갤러리]');
  renderGalChips();
  const mu = work.el.mu;
  $('#em-title').value = mu?.title || '';
  $('#em-artist').value = mu?.artist || '';
  $('#em-url').value = mu?.url || '';
  $('#em-st').textContent = markerSt('[음악]');
  $('#esk-st').textContent = markerSt('[스티커]');
  renderStkChips();
}

function renderImgChips(imgs) {
  const box = $('#es-imgs');
  box.innerHTML = imgs.map((u, i) =>
    '<div class="imgchip"><img src="' + esc(u) + '" alt=""><b>[사진' + (i + 1) + ']</b><i data-rm="' + i + '">✕</i></div>'
  ).join('');
  box.querySelectorAll('[data-rm]').forEach((x) => {
    x.onclick = () => {
      imgs.splice(parseInt(x.dataset.rm), 1);
      renderImgChips(imgs);
      toast('사진을 뺐어요 — 본문의 [사진N] 번호를 확인해 주세요');
    };
  });
}

function renderGalChips() {
  const box = $('#eg-imgs');
  const imgs = work.el.gal?.imgs || [];
  box.innerHTML = imgs.map((it, i) =>
    '<div class="imgchip"><img src="' + esc(it.u) + '" alt=""><i data-adj="' + i + '" style="color:var(--pri);">🔍</i><i data-grm="' + i + '">✕</i></div>'
  ).join('');
  box.querySelectorAll('[data-adj]').forEach((x) => {
    x.onclick = () => openAdjust(imgs[parseInt(x.dataset.adj)], () => { st.dirty = true; });
  });
  box.querySelectorAll('[data-grm]').forEach((x) => {
    x.onclick = () => { imgs.splice(parseInt(x.dataset.grm), 1); renderGalChips(); };
  });
}

function renderStkChips() {
  const box = $('#esk-imgs');
  const items = work.el.stk?.items || [];
  box.innerHTML = items.map((it, i) =>
    '<div class="imgchip"><img src="' + esc(it.u) + '" alt="" style="object-fit:contain;">' +
    '<input type="text" data-sksize="' + i + '" value="' + (parseInt(it.size) || 64) + '" title="크기(px)" style="width:44px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--tx);font-size:10.5px;padding:4px 5px;font-family:inherit;">' +
    '<input type="text" data-skrot="' + i + '" value="' + (parseInt(it.rot) || 0) + '" title="기울기(도)" style="width:38px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--tx);font-size:10.5px;padding:4px 5px;font-family:inherit;">' +
    '<i data-skrm="' + i + '">✕</i></div>'
  ).join('');
  box.querySelectorAll('[data-skrm]').forEach((x) => {
    x.onclick = () => { items.splice(parseInt(x.dataset.skrm), 1); renderStkChips(); };
  });
  box.querySelectorAll('[data-sksize]').forEach((x) => {
    x.oninput = () => { items[parseInt(x.dataset.sksize)].size = parseInt(x.value) || 64; };
  });
  box.querySelectorAll('[data-skrot]').forEach((x) => {
    x.oninput = () => { items[parseInt(x.dataset.skrot)].rot = parseInt(x.value) || 0; };
  });
}

function insertAt(ta, text) {
  const s = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd ?? s);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + text.length;
}

function wrapSel(ta, pre, post) {
  const s = ta.selectionStart ?? 0;
  const e = ta.selectionEnd ?? 0;
  const sel = ta.value.slice(s, e) || '내용';
  ta.value = ta.value.slice(0, s) + pre + sel + post + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = s + pre.length;
  ta.selectionEnd = s + pre.length + sel.length;
}

let editorBound = false;
function bindEditor() {
  if (editorBound) return;
  editorBound = true;
  const ta = () => $('#es-body');
  // 서식
  $('#fmt-b').onclick = () => wrapSel(ta(), '**', '**');
  $('#fmt-hl').onclick = () => wrapSel(ta(), '==', '==');
  $('#fmt-u').onclick = () => wrapSel(ta(), '__', '__');
  $('#fmt-s').onclick = () => wrapSel(ta(), '~~', '~~');
  $('#fmt-hr').onclick = () => insertAt(ta(), '\n\n---\n\n');
  $('#es-fold').onclick = () => insertAt(ta(), '\n{접기:제목}\n내용\n{접기끝}\n');
  $('#es-photo').onclick = () => {
    uploadMulti((urls) => {
      const startN = work.imgs.length;
      work.imgs = work.imgs.concat(urls);
      const tags = urls.map((_, k) => '[사진' + (startN + k + 1) + ']').join(' ');
      insertAt(ta(), '\n' + tags + '\n');
      renderImgChips(work.imgs);
    });
  };
  $('#es-htmlphoto').onclick = () => uploadOne((url) => insertAt($('#es-html'), '<img src="' + url + '">'));

  // 아코디언 열기 = 요소 활성화
  $$('.ea').forEach((a) => {
    a.querySelector('.ea-head').onclick = () => {
      a.classList.toggle('open');
      if (a.classList.contains('open')) {
        if (a.id === 'ea-profile') epCfg();
        if (a.id === 'ea-gallery') egCfg();
        if (a.id === 'ea-music') emCfg();
        if (a.id === 'ea-sticker') eskCfg();
        fillElementForms();
      }
    };
  });

  // 프로필
  $('#ep-size').oninput = (e) => { $('#ep-sizev').textContent = e.target.value + 'px'; };
  $('#ep-up').onclick = () => uploadOne((url) => { const p = epCfg(); p.img = url; p.z = 100; p.x = 50; p.y = 50; toast('업로드 완료 — 🔍 사진 조정으로 위치를 잡아보세요'); });
  $('#ep-adj').onclick = () => {
    const p = epCfg();
    if (!p.img) { toast('먼저 사진을 업로드해 주세요'); return; }
    openAdjust(p, null);
  };
  $('#ep-ins').onclick = () => { insertAt(ta(), '\n[프로필]\n'); epCfg(); $('#ep-st').textContent = '배치됨'; };
  // 갤러리
  $('#eg-up').onclick = () => uploadMulti((urls) => {
    const g = egCfg();
    g.imgs = (g.imgs || []).concat(urls.map((u) => ({ u, z: 100, x: 50, y: 50 })));
    renderGalChips();
  });
  $('#eg-ins').onclick = () => { insertAt(ta(), '\n[갤러리]\n'); egCfg(); $('#eg-st').textContent = '배치됨'; };
  // 음악
  $('#em-ins').onclick = () => { insertAt(ta(), '\n[음악]\n'); emCfg(); $('#em-st').textContent = '배치됨'; };
  // 스티커
  $('#esk-up').onclick = () => uploadMulti((urls) => {
    const s = eskCfg();
    s.items = (s.items || []).concat(urls.map((u) => ({ u, size: 64, rot: 0 })));
    renderStkChips();
  });
  $('#esk-ins').onclick = () => { insertAt(ta(), '\n[스티커]\n'); eskCfg(); $('#esk-st').textContent = '배치됨'; };

  $('#es-ok').onclick = confirmChapterEdit;
}

function confirmChapterEdit() {
  work.title = $('#es-name').value.trim();
  if (work.type === 'html') {
    work.body = $('#es-html').value;
  } else {
    work.body = $('#es-body').value;
    if (work.el.pf) {
      const p = work.el.pf;
      p.nm = $('#ep-nm').value.trim();
      p.acc = $('#ep-acc').value.trim();
      p.ds = $('#ep-ds').value;
      p.pos = $('#ep-pos').value;
      p.shape = $('#ep-shape').value;
      p.size = parseInt($('#ep-size').value) || 64;
    }
    if (work.el.gal) work.el.gal.layout = $('#eg-layout').value;
    if (work.el.mu) {
      work.el.mu.title = $('#em-title').value.trim();
      work.el.mu.artist = $('#em-artist').value.trim();
      work.el.mu.url = $('#em-url').value.trim();
    }
  }
  if (isNewCh) {
    st.site.chapters = st.site.chapters || [];
    st.site.chapters.push(work);
    st.cur = st.site.chapters.length - 1;
  }
  st.dirty = true;
  closeEditSheet();
  renderChapter();
}

function closeEditSheet() {
  $('#edit-bg').classList.remove('on');
  $('#edit-sheet').classList.remove('on');
}

// ── 꾸미기 시트 ──
function openDeco() {
  const t = st.site.theme;
  const p = PRESETS[t.preset || 'white'];
  $$('.preset-card').forEach((c) => c.classList.toggle('on', c.dataset.p === (t.preset || 'white')));
  $('#dc-bg').value = t.bg || p.bg;
  $('#dc-tx').value = t.tx || p.tx;
  $('#dc-pri').value = t.pri || p.pri;
  $('#dc-font').value = t.font || "'Pretendard'";
  $('#dc-nav').value = t.nav || 'dot';
  $('#dc-num').value = t.num || 'on';
  $('#dc-corner').value = t.corner || '';
  $('#dc-cardop').value = t.cardop || '';
  $('#dc-bgdim').value = parseInt(t.bgDim) || 84;
  $('#dc-bgdimv').textContent = (parseInt(t.bgDim) || 84) + '%';
  $('#dc-valign').value = t.valign || '';
  const hd = st.site.head;
  $('#dc-head').value = hd.mode || 'text';
  $('#dc-over').value = hd.over || '';
  $('#dc-title').value = hd.title || '';
  $('#dc-sub').value = hd.sub || '';
  const g = st.site.gate || {};
  $('#dc-gate').value = g.on ? 'on' : 'off';
  $('#dc-gate-opts').style.display = g.on ? 'block' : 'none';
  $('#dc-gate-msg').value = g.msg || '';
  $('#dc-gate-pw').value = g.pw || '';
  $('#dc-css').value = t.css || '';
  $('#deco-bg').classList.add('on');
  $('#deco-sheet').classList.add('on');
}

function closeDeco() {
  $('#deco-bg').classList.remove('on');
  $('#deco-sheet').classList.remove('on');
}

let decoBound = false;
function bindDeco() {
  if (decoBound) return;
  decoBound = true;
  const t = () => st.site.theme;
  $$('.preset-card').forEach((c) => {
    c.onclick = () => {
      if (!confirm('프리셋을 적용하면 현재 색 설정을 프리셋 기본값으로 덮어씁니다. 적용할까요?')) return;
      t().preset = c.dataset.p;
      t().bg = ''; t().tx = ''; t().pri = '';
      st.dirty = true;
      applyTheme();
      renderChapter();
      openDeco();
    };
  });
  $('#dc-bg').oninput = (e) => { t().bg = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-tx').oninput = (e) => { t().tx = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-pri').oninput = (e) => { t().pri = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-font').onchange = (e) => { t().font = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-nav').onchange = (e) => { t().nav = e.target.value; st.dirty = true; renderPager(); };
  $('#dc-num').onchange = (e) => { t().num = e.target.value; st.dirty = true; renderChapter(); };
  $('#dc-corner').onchange = (e) => { t().corner = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-cardop').onchange = (e) => { t().cardop = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-valign').onchange = (e) => { t().valign = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-bgdim').oninput = (e) => { t().bgDim = parseInt(e.target.value); $('#dc-bgdimv').textContent = e.target.value + '%'; st.dirty = true; applyTheme(); };
  $('#dc-head').onchange = (e) => { st.site.head.mode = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-over').oninput = (e) => { st.site.head.over = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-title').oninput = (e) => { st.site.head.title = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-sub').oninput = (e) => { st.site.head.sub = e.target.value; st.dirty = true; applyTheme(); };
  $('#dc-himg-up').onclick = () => uploadOne((url) => {
    st.site.head.img = url;
    if ((st.site.head.mode || 'text') === 'text' || st.site.head.mode === 'none') {
      st.site.head.mode = 'both';
      $('#dc-head').value = 'both';
      toast('머리글 이미지 설정 — 구성을 "이미지 + 글"로 바꿨어요');
    } else {
      toast('머리글 이미지 설정');
    }
    st.dirty = true;
    applyTheme();
  });
  $('#dc-himg-del').onclick = () => { st.site.head.img = ''; st.dirty = true; applyTheme(); };
  $('#dc-bimg-up').onclick = () => uploadOne((url) => { st.site.theme.bgImg = url; st.dirty = true; applyTheme(); toast('배경 이미지 설정'); });
  $('#dc-bimg-del').onclick = () => { st.site.theme.bgImg = ''; st.dirty = true; applyTheme(); };
  $('#dc-gate').onchange = (e) => {
    st.site.gate = st.site.gate || {};
    st.site.gate.on = e.target.value === 'on';
    st.dirty = true;
    $('#dc-gate-opts').style.display = st.site.gate.on ? 'block' : 'none';
  };
  $('#dc-gate-msg').oninput = (e) => { st.site.gate.msg = e.target.value; st.dirty = true; };
  $('#dc-gate-pw').oninput = (e) => { st.site.gate.pw = e.target.value; st.dirty = true; };
  $('#dc-gimg-up').onclick = () => uploadOne((url) => { st.site.gate.img = url; st.dirty = true; toast('대문 이미지 설정'); });
  $('#dc-gimg-del').onclick = () => { st.site.gate.img = ''; st.dirty = true; };
  $('#dc-css').oninput = (e) => { t().css = e.target.value; st.dirty = true; $('#usercss').textContent = e.target.value; };
  $('#dc-save').onclick = saveSite;
}

// ═══════════ 업로드 ═══════════
async function uploadFile(file) {
  if (file.size > 5 * 1024 * 1024) { toast(file.name + ' — 5MB를 넘어요'); return null; }
  const path = 'tsites/' + st.handle + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const r = sref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

function uploadOne(cb) {
  const fi = $('#file-one');
  fi.value = '';
  fi.onchange = async () => {
    if (!fi.files[0]) return;
    toast('업로드 중…');
    try { const url = await uploadFile(fi.files[0]); if (url) { cb(url); toast('업로드 완료'); } }
    catch (e) { console.log('[LUVINFO] up err', e); toast('업로드 실패'); }
  };
  fi.click();
}

function uploadMulti(cb) {
  const fi = $('#file-multi');
  fi.value = '';
  fi.onchange = async () => {
    if (!fi.files.length) return;
    toast('업로드 중… (' + fi.files.length + '장)');
    try {
      const urls = [];
      for (const f of fi.files) { const u = await uploadFile(f); if (u) urls.push(u); }
      if (urls.length) { cb(urls); toast('업로드 완료'); }
    } catch (e) { console.log('[LUVINFO] upm err', e); toast('업로드 실패'); }
  };
  fi.click();
}

// ═══════════ 저장 ═══════════
async function saveSite() {
  if (!st.mine) return;
  delete st.site._migrated;
  st.site.updated = Date.now();
  const size = new Blob([JSON.stringify(st.site)]).size;
  if (size > 950000) {
    toast('용량 초과에 가까워요 (' + Math.round(size / 1024) + 'KB / 최대 약 1MB) — HTML 장을 줄여 주세요');
    if (size > 1000000) return;
  }
  try {
    await setDoc(doc(db, 'tsites', st.handle), st.site);
    st.dirty = false;
    renderFoot();
    toast('저장했어요 ✓');
  } catch (e) {
    console.log('[LUVINFO] save err', e);
    toast('저장 실패 — 콘솔을 확인해 주세요');
  }
}

window.addEventListener('beforeunload', (e) => {
  if (st.dirty) { e.preventDefault(); e.returnValue = ''; }
});

boot();
