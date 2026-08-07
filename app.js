// ═══════════════════════════════════════════════
// 성향글 — app.js v1
// luvlog(lovelog-cc579)와 같은 Firebase 프로젝트, 별도 컬렉션(tsites/tusers) 사용
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

// luvlog와 같은 방식: 레포에 있는 firebase-config.js에서 불러옴
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);

// 현재 배포 경로 기준 (프로젝트 페이지 /레포명/ 지원)
const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');

const st = { user: null, myHandle: null, handle: null, site: null, mine: false, edit: false, dirty: false };

function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('on'), 2400);
}

console.log('[성향글] app.js v7 로드');

// ── 기본 사이트 데이터 ──
function defaultSite(ownerUid, handle) {
  return {
    ownerUid,
    title: handle.toUpperCase(),
    sub: 'TASTE ARCHIVE',
    mark: '',
    theme: { bg: '#08080B', ac: '#C9A227', nav: 'dot', header: 'both', font: "'Pretendard', -apple-system, sans-serif", fx: 'fade', heroImg: '', css: '' },
    gate: { on: false, msg: '', pw: '', img: '' },
    tabs: [{
      id: uid(), title: 'ARCHIVE',
      blocks: [
        { id: uid(), type: 'profile', style: 'card', data: { name: handle, sub: '', desc: '자기소개를 적어보세요', img: '' } },
        { id: uid(), type: 'text', data: { label: 'ABOUT', body: '여기는 텍스트 블록이에요. 편집 모드에서 ✎를 눌러 수정할 수 있어요.' } }
      ]
    }],
    heart: 0,
    updated: Date.now()
  };
}

// ═══════════ 라우팅 ═══════════
function targetHandle() {
  // 404.html 라우터가 남긴 경로 우선
  const saved = sessionStorage.getItem('sh_route');
  if (saved) { sessionStorage.removeItem('sh_route'); history.replaceState(null, '', saved); }
  // 경로의 마지막 조각만 핸들로 인식 (프로젝트 페이지 /레포명/ 은 핸들이 아님)
  const seg = (location.pathname.match(/[^/]+$/) || [''])[0];
  if (seg && seg !== 'index.html') return seg.toLowerCase();
  const q = new URLSearchParams(location.search).get('h');
  return q ? q.toLowerCase() : null;
}

async function boot() {
  onAuthStateChanged(auth, async (u) => {
    st.user = u;
    if (u) {
      const ud = await getDoc(doc(db, 'tusers', u.uid));
      st.myHandle = ud.exists() ? ud.data().handle : null;
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
    // 랜딩
    if (st.myHandle) {
      $('#landing-my').style.display = 'block';
      $('#btn-myhome').onclick = () => { location.href = BASE + '?h=' + st.myHandle; };
    }
    $('#landing').classList.add('show');
    $('#btn-start').onclick = login;
    return;
  }
  st.handle = h;
  const d = await getDoc(doc(db, 'tsites', h));
  if (!d.exists()) {
    $('#landing').classList.add('show');
    $('#landing .desc').textContent = '@' + h + ' — 존재하지 않는 페이지예요.';
    $('#btn-start').onclick = login;
    return;
  }
  st.site = d.data();
  st.mine = !!(st.user && st.site.ownerUid === st.user.uid);
  // 게이트
  const g = st.site.gate || {};
  if (g.on && !st.mine && sessionStorage.getItem('sh_gate_' + h) !== '1') {
    showGate(g);
    return;
  }
  showSite();
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
    console.log('[성향글] login err', e);
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
      console.log('[성향글] claim err', e);
      toast('생성 실패 — 규칙 게시 여부를 확인해 주세요');
    }
  };
}

// ═══════════ 사이트 렌더 ═══════════
let curTab = 0;

function applyTheme() {
  const t = st.site.theme || {};
  document.documentElement.style.setProperty('--bg', t.bg || '#08080B');
  document.documentElement.style.setProperty('--gold', t.ac || '#C9A227');
  document.documentElement.style.setProperty('--font', t.font || "'Pretendard', sans-serif");
  document.body.dataset.nav = t.nav || 'dot';
  document.body.dataset.header = t.header || 'both';
  document.body.dataset.fx = t.fx || 'fade';
  $('#usercss').textContent = t.css || '';
  const hero = $('#hero');
  if (t.heroImg) hero.style.backgroundImage = 'linear-gradient(180deg, transparent 30%, var(--bg) 100%), url("' + t.heroImg + '")';
  else hero.style.backgroundImage = '';
}

function showSite() {
  $('#site').style.display = 'block';
  $('#fabs').style.display = 'flex';
  document.title = st.site.title + ' — 성향글';
  applyTheme();
  $('#hero-mark').textContent = st.site.mark || '';
  $('#hero-h1').textContent = st.site.title || '';
  $('#hero-p').textContent = st.site.sub || '';
  renderNav();
  renderPages();
  renderFoot();
  // fab
  if (st.mine) {
    $('#fab-edit').style.display = 'block';
    $('#fab-edit').onclick = toggleEdit;
  } else if (!st.user) {
    $('#fab-login').style.display = 'block';
    $('#fab-login').onclick = login;
  } else if (st.myHandle && st.myHandle !== st.handle) {
    $('#fab-my').style.display = 'block';
    $('#fab-my').onclick = () => { location.href = BASE + '?h=' + st.myHandle; };
  }
  bindShell();
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  st.site.tabs.forEach((tb, i) => {
    const a = document.createElement('a');
    a.innerHTML = '<i class="num">' + String(i + 1).padStart(2, '0') + '</i><b class="br">[</b><span class="nav-t">' + esc(tb.title) + '</span><b class="br">]</b>';
    if (i === curTab) a.classList.add('on');
    a.onclick = () => { curTab = i; renderNav(); renderPages(); window.scrollTo({ top: 0 }); };
    a.ondblclick = () => {
      if (!st.edit) return;
      const name = prompt('카테고리 이름', tb.title);
      if (name) { tb.title = name; st.dirty = true; renderNav(); renderPanelTabs(); }
    };
    nav.appendChild(a);
  });
}

function renderPages() {
  const wrap = $('#pages');
  wrap.innerHTML = '';
  const tb = st.site.tabs[curTab];
  if (!tb) return;
  const pg = document.createElement('div');
  pg.className = 'page on';
  tb.blocks.forEach((b) => {
    pg.appendChild(renderBlock(b, tb));
    pg.appendChild(makeAddline(tb, b));
  });
  if (!tb.blocks.length) pg.appendChild(makeAddline(tb, null));
  wrap.appendChild(pg);
}

function renderFoot() {
  $('#hcount').textContent = st.site.heart || 0;
  const liked = localStorage.getItem('sh_like_' + st.handle) === '1';
  $('#heart').classList.toggle('liked', liked);
  $('#heart .h').textContent = liked ? '♥' : '♡';
  const d = new Date(st.site.updated || Date.now());
  $('#upd-date').textContent = 'LAST UPDATE — ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}

let shellBound = false;
function bindShell() {
  if (shellBound) return;
  shellBound = true;
  $('#heart').onclick = async () => {
    if (st.mine) { toast('내 하트는 셀 수 없어요 🙂'); return; }
    const key = 'sh_like_' + st.handle;
    const liked = localStorage.getItem(key) === '1';
    const delta = liked ? -1 : 1;
    localStorage.setItem(key, liked ? '0' : '1');
    st.site.heart = (st.site.heart || 0) + delta;
    renderFoot();
    try { await updateDoc(doc(db, 'tsites', st.handle), { heart: increment(delta) }); }
    catch (e) { console.log('[성향글] heart err', e); }
  };
  $('#copy-link').onclick = () => {
    navigator.clipboard?.writeText(BASE + '?h=' + st.handle)
      .then(() => toast('링크를 복사했어요 ✓'))
      .catch(() => toast('복사에 실패했어요'));
  };
  $$('.view-seg button').forEach((b) => {
    b.onclick = () => {
      document.body.classList.toggle('mv', b.dataset.v === 'mobile');
      $$('.view-seg button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
  });
  $('#panel-toggle').onclick = () => $('#panel').classList.toggle('open');
  $('#save-fab').onclick = saveSite;
  $('#lightbox').onclick = () => $('#lightbox').classList.remove('on');
  $('#addmenu').onclick = (e) => { if (e.target === $('#addmenu')) $('#addmenu').classList.remove('on'); };
}

// ═══════════ 블록 렌더 ═══════════
function renderBlock(b, tb) {
  const el = document.createElement('div');
  el.className = 'blk';
  if (b.style) el.dataset.style = b.style;
  const d = b.data || {};
  const label = d.label ? '<div class="blk-label">' + esc(d.label) + '</div>' : '';

  if (b.type === 'profile') {
    el.innerHTML = (d.label ? label : '<div class="blk-label">PROFILE</div>') +
      '<div class="prof-card"><div class="prof-img"' + (d.img ? ' style="background-image:url(\'' + esc(d.img) + '\')"' : '') + '>' + (d.img ? '' : '✦') + '</div>' +
      '<div><div class="prof-name">' + esc(d.name) + (d.sub ? ' <span>· ' + esc(d.sub) + '</span>' : '') + '</div>' +
      '<div class="prof-desc">' + esc(d.desc) + '</div></div></div>';
  }
  else if (b.type === 'text') {
    el.innerHTML = label + '<div class="txt">' + esc(d.body) + '</div>';
  }
  else if (b.type === 'fold') {
    el.innerHTML = label +
      '<div class="fold"><div class="fold-head"><span>' + esc(d.title) + '</span></div>' +
      '<div class="fold-body"><div class="fold-body-in">' + esc(d.body) + '</div></div></div>';
    el.querySelector('.fold-head').onclick = function () {
      if (!st.edit) this.parentElement.classList.toggle('open');
    };
  }
  else if (b.type === 'badges') {
    el.innerHTML = label + '<div class="badges">' +
      (d.items || []).map((it) => '<span class="badge' + (it.hi ? ' g' : '') + '">' + esc(it.t) + '</span>').join('') +
      '</div>';
  }
  else if (b.type === 'gallery') {
    if (d.layout === 'slider') {
      el.innerHTML = label +
        '<div class="g-slider"><div class="g-track">' +
        (d.imgs || []).map((u) => '<div class="g-slide" style="background-image:url(\'' + esc(u) + '\')"></div>').join('') +
        '</div><div class="g-arrow g-prev">‹</div><div class="g-arrow g-next">›</div><div class="g-nav"></div></div>';
      if ((d.imgs || []).length) initSlider(el.querySelector('.g-slider'));
      else el.querySelector('.g-track').innerHTML = '<div class="g-slide">이미지를 추가해 주세요</div>';
    } else {
      el.innerHTML = label +
        '<div class="g-grid" style="--gcols:' + (d.cols || 6) + '">' +
        ((d.imgs || []).length
          ? d.imgs.map((u) => '<div class="g-cell" style="background-image:url(\'' + esc(u) + '\')"></div>').join('')
          : '<div class="g-cell">이미지를 추가해 주세요</div>') +
        '</div>';
      el.querySelectorAll('.g-cell').forEach((c, i) => {
        c.onclick = () => {
          if (!(d.imgs || [])[i]) return;
          $('#lb-img').src = d.imgs[i];
          $('#lightbox').classList.add('on');
        };
      });
    }
  }
  else if (b.type === 'music') {
    el.innerHTML = label +
      '<div class="music"><div class="m-disc"></div><div class="m-info">' +
      '<div class="m-title">' + esc(d.title) + '</div><div class="m-artist">' + esc(d.artist) + '</div>' +
      '<div class="m-bar"><i></i></div></div><button class="m-btn">▶</button></div>';
    const mu = el.querySelector('.music');
    const btn = el.querySelector('.m-btn');
    let audio = null;
    btn.onclick = () => {
      if (d.url) {
        if (!audio) {
          audio = new Audio(d.url);
          audio.ontimeupdate = () => { if (audio.duration) el.querySelector('.m-bar i').style.width = (audio.currentTime / audio.duration * 100) + '%'; };
          audio.onended = () => { mu.classList.remove('playing'); btn.textContent = '▶'; };
        }
        if (audio.paused) { audio.play(); mu.classList.add('playing'); btn.textContent = '❚❚'; }
        else { audio.pause(); mu.classList.remove('playing'); btn.textContent = '▶'; }
      } else {
        mu.classList.toggle('playing');
        btn.textContent = mu.classList.contains('playing') ? '❚❚' : '▶';
      }
    };
  }
  else if (b.type === 'dream') {
    el.innerHTML = label + '<div class="dream-grid">' +
      (d.items || []).map((it) => {
        const main = (it.rank || '').toUpperCase() === 'MAIN';
        return '<div class="dream' + (main ? ' main' : '') + '">' +
          '<div class="d-rank' + (main ? '' : ' sub') + '">' + esc((it.rank || 'SUB').toUpperCase()) + '</div>' +
          '<div class="d-pair">' + esc(it.a) + ' <b>×</b> ' + esc(it.b) + '</div>' +
          (it.name ? '<div class="d-name">' + esc(it.name) + '</div>' : '') +
          (it.desc ? '<div class="d-desc">' + esc(it.desc) + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }
  else if (b.type === 'chat') {
    el.innerHTML = label + '<div class="chat">' +
      (d.lines || []).map((l) =>
        '<div class="c-row' + (l.side === 'R' ? ' me' : '') + '">' +
        '<div class="c-av">' + esc(l.ini) + '</div>' +
        '<div class="c-bub">' + esc(l.text) + '</div></div>'
      ).join('') + '</div>';
  }
  else if (b.type === 'links') {
    el.innerHTML = label + '<div class="links">' +
      (d.items || []).map((it) =>
        '<a class="link" href="' + esc(it.url || '#') + '" target="_blank" rel="noopener"><span>' + esc(it.t) + '</span> <span>↗</span></a>'
      ).join('') + '</div>';
  }
  else if (b.type === 'banner') {
    el.innerHTML = label + '<div class="banners">' +
      ((d.items || []).length
        ? d.items.map((it, i) => {
            if (it.h) return '<a data-bh="' + esc(it.h) + '" href="/?h=' + esc(it.h) + '"><span class="tb">@' + esc(it.h) + '</span></a>';
            return '<a href="' + esc(it.url || '#') + '" target="_blank" rel="noopener"><img src="' + esc(it.img) + '" alt=""></a>';
          }).join('')
        : '<span style="font-size:12px;color:var(--tx-mute);">배너를 추가해 주세요</span>') +
      '</div>';
    // 러브인포 핸들 배너 비동기 로드 + 맞배너 ♥
    el.querySelectorAll('[data-bh]').forEach(async (a) => {
      const info = await bannerInfo(a.dataset.bh);
      if (!info) { a.querySelector('.tb').textContent = '@' + a.dataset.bh + ' (없음)'; return; }
      if (info.img) a.innerHTML = '<img src="' + esc(info.img) + '" alt="">' + (info.mut ? '<span class="mut">♥</span>' : '');
      else a.innerHTML = '<span class="tb">' + esc(info.title) + '</span>' + (info.mut ? '<span class="mut">♥</span>' : '');
    });
  }
  else if (b.type === 'dday') {
    const target = new Date((d.date || '') + 'T00:00:00');
    let txt = 'D-DAY';
    if (!isNaN(target)) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((target - today) / 86400000);
      txt = diff > 0 ? 'D-' + diff : (diff < 0 ? 'D+' + (-diff) : 'D-DAY');
    }
    el.innerHTML = label + '<div class="dday-card"><span class="dday-num">' + txt + '</span><span class="dday-t">' + esc(d.title) + '</span></div>';
  }
  else if (b.type === 'quote') {
    el.innerHTML = label + '<div class="quote-box"><div class="quote-tx">' + esc(d.text) + '</div>' +
      (d.src ? '<div class="quote-src">— ' + esc(d.src) + '</div>' : '') + '</div>';
  }
  else if (b.type === 'sticker') {
    el.innerHTML = label + '<div class="stickers">' +
      ((d.items || []).length
        ? d.items.map((it) =>
            '<img src="' + esc(it.img) + '" style="width:' + (parseInt(it.size) || 64) + 'px;transform:rotate(' + (parseInt(it.rot) || 0) + 'deg);" alt="">'
          ).join('')
        : '<span style="font-size:12px;color:var(--tx-mute);">스티커를 추가해 주세요</span>') +
      '</div>';
  }
  else if (b.type === 'html') {
    el.innerHTML = label + '<div class="htmlblk"></div>';
    el.querySelector('.htmlblk').innerHTML = d.code || '';
  }
  else if (b.type === 'sns') {
    el.innerHTML = label + '<div class="sns">' +
      (d.items || []).map((it) =>
        '<a href="' + esc(it.url || '#') + '" target="_blank" rel="noopener">' + esc(it.icon) + '</a>'
      ).join('') + '</div>';
  }
  else if (b.type === 'divider') {
    el.innerHTML = d.ch
      ? '<div class="divider deco">' + esc(d.ch) + '</div>'
      : '<div class="divider"></div>';
  }
  else if (b.type === 'space') {
    el.innerHTML = '<div style="height:' + (parseInt(d.h) || 40) + 'px;"></div>';
  }

  attachTools(el, b, tb);
  return el;
}

const bannerCache = {};
async function bannerInfo(h) {
  if (bannerCache[h]) return bannerCache[h];
  try {
    const d = await getDoc(doc(db, 'tsites', h));
    if (!d.exists()) return (bannerCache[h] = null);
    const s = d.data();
    let mut = false;
    (s.tabs || []).forEach((tb) => (tb.blocks || []).forEach((b) => {
      if (b.type === 'banner') (b.data?.items || []).forEach((it) => { if (it.h === st.handle) mut = true; });
    }));
    return (bannerCache[h] = { img: s.myBanner || '', title: s.title || h, mut });
  } catch (e) {
    console.log('[성향글] bannerInfo err', e);
    return null;
  }
}

function initSlider(root) {
  let cur = 0;
  const slides = root.querySelectorAll('.g-slide');
  const nav = root.querySelector('.g-nav');
  slides.forEach((_, i) => {
    const dd = document.createElement('div');
    dd.className = 'g-dot' + (i === 0 ? ' on' : '');
    dd.onclick = () => go(i);
    nav.appendChild(dd);
  });
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s) => { s.style.transform = 'translateX(-' + (cur * 100) + '%)'; });
    nav.querySelectorAll('.g-dot').forEach((dd, j) => dd.classList.toggle('on', j === cur));
  }
  root.querySelector('.g-prev').onclick = () => go(cur - 1);
  root.querySelector('.g-next').onclick = () => go(cur + 1);
}

// ═══════════ 편집 모드 ═══════════
function toggleEdit() {
  st.edit = document.body.classList.toggle('edit');
  $('#fab-edit').textContent = st.edit ? '보기 모드' : '✎ 편집';
  if (st.edit) { fillPanel(); toast('편집 모드 — 완료 후 ✓ 저장을 눌러 주세요'); }
  else {
    $('#panel').classList.remove('open');
    document.body.classList.remove('mv');
    $$('.view-seg button').forEach((b, i) => b.classList.toggle('on', i === 0));
    if (st.dirty) toast('저장하지 않은 변경이 있어요 — 편집 모드에서 ✓ 저장');
  }
}

function attachTools(el, b, tb) {
  const tools = document.createElement('div');
  tools.className = 'blk-tools';
  tools.innerHTML = '<button class="bt" title="위로">↑</button><button class="bt" title="아래로">↓</button><button class="bt" title="편집">✎</button><button class="bt del" title="삭제">✕</button>';
  const [up, down, edit, del] = tools.querySelectorAll('button');
  const idx = () => tb.blocks.indexOf(b);
  up.onclick = () => { const i = idx(); if (i > 0) { tb.blocks.splice(i, 1); tb.blocks.splice(i - 1, 0, b); st.dirty = true; renderPages(); } };
  down.onclick = () => { const i = idx(); if (i < tb.blocks.length - 1) { tb.blocks.splice(i, 1); tb.blocks.splice(i + 1, 0, b); st.dirty = true; renderPages(); } };
  edit.onclick = () => openBlockEdit(b);
  del.onclick = () => { if (confirm('이 블록을 삭제할까요?')) { tb.blocks.splice(idx(), 1); st.dirty = true; renderPages(); } };
  el.prepend(tools);
}

function makeAddline(tb, afterBlock) {
  const line = document.createElement('div');
  line.className = 'addline';
  line.innerHTML = '<span>＋ 블록 추가</span>';
  line.onclick = () => openAddMenu(tb, afterBlock);
  return line;
}

const BLOCK_TYPES = [
  ['profile', '프로필'], ['text', '텍스트'], ['fold', '접은 글'],
  ['badges', '뱃지'], ['gallery', '갤러리'], ['music', '노래 플레이어'],
  ['dream', '드림표'], ['chat', '채팅로그'], ['links', '링크'],
  ['banner', '배너'], ['dday', '디데이'], ['quote', '인용구'],
  ['sticker', '스티커'], ['html', 'HTML'],
  ['sns', 'SNS 아이콘'], ['divider', '구분선'], ['space', '공백']
];

function newBlock(type) {
  const base = { id: uid(), type, data: {} };
  if (type === 'profile') { base.style = 'card'; base.data = { name: '이름', sub: '', desc: '', img: '' }; }
  if (type === 'text') base.data = { label: 'TEXT', body: '내용을 입력해 주세요' };
  if (type === 'fold') base.data = { label: 'MORE', title: '접은 글 제목', body: '내용' };
  if (type === 'badges') { base.style = 'pill'; base.data = { label: 'STATUS', items: [{ t: '뱃지 예시', hi: true }] }; }
  if (type === 'gallery') base.data = { label: 'GALLERY', layout: 'grid', cols: 6, imgs: [] };
  if (type === 'music') base.data = { label: 'BGM', title: '곡 제목', artist: '아티스트', url: '' };
  if (type === 'dream') base.data = { label: 'DREAM CHART', items: [{ rank: 'MAIN', a: 'A', b: 'B', name: '#페어명', desc: '' }] };
  if (type === 'chat') base.data = { label: 'TALK', lines: [{ side: 'L', ini: '가', text: '대사를 적어보세요' }] };
  if (type === 'links') base.data = { label: 'LINKS', items: [{ t: '링크 제목', url: '' }] };
  if (type === 'banner') base.data = { label: 'BANNER', items: [] };
  if (type === 'dday') base.data = { label: 'D-DAY', title: '기념일', date: new Date().toISOString().slice(0, 10) };
  if (type === 'quote') base.data = { label: '', text: '인용구를 적어보세요', src: '' };
  if (type === 'sticker') base.data = { items: [] };
  if (type === 'html') base.data = { label: '', code: '<div style="text-align:center;color:#C9A227;">자유 HTML 블록</div>' };
  if (type === 'sns') base.data = { label: 'SNS', items: [{ icon: '𝕏', url: '' }] };
  if (type === 'divider') base.data = { ch: '✦' };
  if (type === 'space') base.data = { h: 40 };
  return base;
}

function openAddMenu(tb, afterBlock) {
  const grid = $('#am-grid');
  grid.innerHTML = '';
  BLOCK_TYPES.forEach(([type, name]) => {
    const it = document.createElement('div');
    it.className = 'am-item';
    it.textContent = name;
    it.onclick = () => {
      const b = newBlock(type);
      const i = afterBlock ? tb.blocks.indexOf(afterBlock) + 1 : 0;
      tb.blocks.splice(i, 0, b);
      st.dirty = true;
      $('#addmenu').classList.remove('on');
      renderPages();
      openBlockEdit(b);
    };
    grid.appendChild(it);
  });
  $('#addmenu').classList.add('on');
}

// ═══════════ 블록 편집 팝업 ═══════════
const FIELD_DEFS = {
  profile: [
    ['label', 'text', '라벨 (비우면 PROFILE)'],
    ['name', 'text', '이름'],
    ['sub', 'text', '보조 이름 (· 뒤에 붙음)'],
    ['desc', 'textarea', '소개 (줄바꿈 가능)'],
    ['img', 'image', '프로필 사진'],
    ['style', 'select', '디자인', [['card', '카드형'], ['text', '텍스트만'], ['banner', '배너형']]]
  ],
  text: [['label', 'text', '라벨 (비우면 숨김)'], ['body', 'textarea', '내용']],
  fold: [['label', 'text', '라벨 (비우면 숨김)'], ['title', 'text', '접은 글 제목'], ['body', 'textarea', '내용']],
  badges: [
    ['label', 'text', '라벨'],
    ['items', 'lines', '뱃지 목록 (한 줄에 하나, 강조는 맨 앞에 *)'],
    ['style', 'select', '디자인', [['pill', '알약형'], ['square', '사각 태그형'], ['stamp', '스탬프형']]]
  ],
  gallery: [
    ['label', 'text', '라벨'],
    ['layout', 'select', '형식', [['grid', '그리드'], ['slider', '슬라이더']]],
    ['cols', 'select', '그리드 열 수 (PC)', [['3', '3열'], ['4', '4열'], ['5', '5열'], ['6', '6열']]],
    ['imgs', 'images', '이미지']
  ],
  music: [['label', 'text', '라벨'], ['title', 'text', '곡 제목'], ['artist', 'text', '아티스트'], ['url', 'text', '오디오 URL (선택 — mp3 링크)']],
  dream: [
    ['label', 'text', '라벨'],
    ['items', 'dreamlines', '드림 목록 — 한 줄에 하나:\nMAIN|A|B|#페어명|설명(선택)']
  ],
  chat: [
    ['label', 'text', '라벨'],
    ['lines', 'chatlines', '대사 — 한 줄에 하나:\nL|이니셜|대사 (L=왼쪽, R=오른쪽)']
  ],
  links: [['label', 'text', '라벨'], ['items', 'linklines', '링크 — 한 줄에 하나: 제목|URL']],
  banner: [['label', 'text', '라벨'], ['items', 'banners', '배너']],
  dday: [['label', 'text', '라벨'], ['title', 'text', '이름 (예: 입덕일)'], ['date', 'text', '날짜 (YYYY-MM-DD)']],
  quote: [['label', 'text', '라벨 (비우면 숨김)'], ['text', 'textarea', '인용구'], ['src', 'text', '출처 (선택)']],
  sticker: [['label', 'text', '라벨 (비우면 숨김)'], ['items', 'stickers', '스티커 (투명 PNG 추천)']],
  html: [['label', 'text', '라벨 (비우면 숨김)'], ['code', 'textarea', 'HTML 코드 — 이미지·iframe은 자동으로 화면 폭에 맞춰져요']],
  sns: [['label', 'text', '라벨'], ['items', 'linklines', '아이콘 — 한 줄에 하나: 아이콘문자|URL']],
  divider: [['ch', 'text', '가운데 장식 문자 (비우면 선만)']],
  space: [['h', 'text', '높이(px)']]
};

let editingBlock = null;

function openBlockEdit(b) {
  editingBlock = b;
  const defs = FIELD_DEFS[b.type] || [];
  const box = $('#be-fields');
  box.innerHTML = '';
  $('#be-title').textContent = (BLOCK_TYPES.find(([t]) => t === b.type)?.[1] || '블록') + ' 편집';
  defs.forEach(([key, kind, lab, opts]) => {
    const row = document.createElement('div');
    row.className = 'f-row';
    const val = key === 'style' ? (b.style || '') : (b.data[key] ?? '');
    if (kind === 'text') {
      row.innerHTML = '<label>' + esc(lab) + '</label><input type="text" data-k="' + key + '" value="' + esc(val) + '">';
    } else if (kind === 'textarea') {
      row.innerHTML = '<label>' + esc(lab) + '</label><textarea data-k="' + key + '">' + esc(val) + '</textarea>';
    } else if (kind === 'select') {
      row.innerHTML = '<label>' + esc(lab) + '</label><select data-k="' + key + '">' +
        opts.map(([v, n]) => '<option value="' + v + '"' + (String(val) === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
    } else if (kind === 'lines') {
      const txt = (val || []).map((it) => (it.hi ? '*' : '') + it.t).join('\n');
      row.innerHTML = '<label>' + esc(lab) + '</label><textarea data-k="' + key + '" data-kind="lines">' + esc(txt) + '</textarea>';
    } else if (kind === 'dreamlines') {
      const txt = (val || []).map((it) => [it.rank, it.a, it.b, it.name, it.desc].filter((x, i) => i < 4 || x).join('|')).join('\n');
      row.innerHTML = '<label style="white-space:pre-line;">' + esc(lab) + '</label><textarea data-k="' + key + '" data-kind="dreamlines">' + esc(txt) + '</textarea>';
    } else if (kind === 'chatlines') {
      const txt = (val || []).map((l) => [l.side, l.ini, l.text].join('|')).join('\n');
      row.innerHTML = '<label style="white-space:pre-line;">' + esc(lab) + '</label><textarea data-k="' + key + '" data-kind="chatlines">' + esc(txt) + '</textarea>';
    } else if (kind === 'linklines') {
      const first = b.type === 'sns' ? 'icon' : 't';
      const txt = (val || []).map((it) => [it[first], it.url].join('|')).join('\n');
      row.innerHTML = '<label>' + esc(lab) + '</label><textarea data-k="' + key + '" data-kind="linklines">' + esc(txt) + '</textarea>';
    } else if (kind === 'banners') {
      row.innerHTML = '<label>' + esc(lab) + '</label>' +
        '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
        '<input type="text" data-hin="1" placeholder="러브인포 핸들 (예: jeste)" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--tx);font-size:11.5px;padding:7px 9px;font-family:var(--font);">' +
        '<button class="p-btn" data-addh="' + key + '" style="width:auto;margin:0;padding:7px 14px;">핸들로 추가</button>' +
        '</div>' +
        '<button class="p-btn" data-upb="' + key + '">외부 배너 이미지 추가 (여러 장 가능)</button>' +
        '<div class="f-note">러브인포 핸들로 추가하면 상대 배너가 자동으로 걸리고, 서로 추가한 사이면 ♥가 붙어요.</div>' +
        (val || []).map((it, i) => {
          if (it.h) return '<div style="display:flex;gap:6px;align-items:center;margin:7px 0;">' +
            '<span style="flex:1;font-size:12px;color:var(--gold);">@' + esc(it.h) + ' (러브인포)</span>' +
            '<button data-brm="' + i + '" style="background:none;border:none;color:#C0392B;cursor:pointer;font-size:13px;">✕</button></div>';
          return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px;">' +
            '<img src="' + esc(it.img) + '" style="max-width:110px;max-height:34px;border:1px solid var(--line);border-radius:6px;" alt="">' +
            '<input type="text" data-burl="' + i + '" value="' + esc(it.url || '') + '" placeholder="연결 URL" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--tx);font-size:11.5px;padding:7px 9px;font-family:var(--font);">' +
            '<button data-brm="' + i + '" style="background:none;border:none;color:#C0392B;cursor:pointer;font-size:13px;">✕</button></div>';
        }).join('');
    } else if (kind === 'stickers') {
      row.innerHTML = '<label>' + esc(lab) + '</label>' +
        '<button class="p-btn" data-ups="' + key + '">스티커 이미지 추가 (여러 장 가능)</button>' +
        (val || []).map((it, i) =>
          '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px;">' +
          '<img src="' + esc(it.img) + '" style="width:40px;height:40px;object-fit:contain;border:1px solid var(--line);border-radius:6px;background:var(--card2);" alt="">' +
          '<input type="text" data-ssize="' + i + '" value="' + (parseInt(it.size) || 64) + '" style="width:64px;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--tx);font-size:11.5px;padding:7px 8px;font-family:var(--font);" title="크기(px)">' +
          '<input type="text" data-srot="' + i + '" value="' + (parseInt(it.rot) || 0) + '" style="width:56px;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--tx);font-size:11.5px;padding:7px 8px;font-family:var(--font);" title="기울기(도)">' +
          '<button data-srm="' + i + '" style="background:none;border:none;color:#C0392B;cursor:pointer;font-size:13px;">✕</button>' +
          '</div>'
        ).join('') +
        ((val || []).length ? '<div class="f-note">가운데: 크기(px) · 오른쪽: 기울기(도, 예: -12)</div>' : '');
    } else if (kind === 'image') {
      row.innerHTML = '<label>' + esc(lab) + '</label>' +
        '<button class="p-btn" data-up="' + key + '">이미지 업로드</button>' +
        (val ? '<button class="p-btn" data-clear="' + key + '">이미지 제거</button>' : '');
    } else if (kind === 'images') {
      row.innerHTML = '<label>' + esc(lab) + '</label>' +
        '<button class="p-btn" data-upm="' + key + '">이미지 추가 (여러 장 가능)</button>' +
        '<div class="f-imgs">' + (val || []).map((u, i) => '<div class="f-img" style="background-image:url(\'' + esc(u) + '\')"><i data-rm="' + i + '">✕</i></div>').join('') + '</div>';
    }
    box.appendChild(row);
  });

  box.querySelectorAll('[data-up]').forEach((btn) => {
    btn.onclick = () => uploadOne((url) => { b.data[btn.dataset.up] = url; st.dirty = true; openBlockEdit(b); });
  });
  box.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.onclick = () => { b.data[btn.dataset.clear] = ''; st.dirty = true; openBlockEdit(b); };
  });
  box.querySelectorAll('[data-upm]').forEach((btn) => {
    btn.onclick = () => uploadMulti((urls) => {
      b.data[btn.dataset.upm] = (b.data[btn.dataset.upm] || []).concat(urls);
      st.dirty = true; openBlockEdit(b);
    });
  });
  box.querySelectorAll('[data-addh]').forEach((btn) => {
    btn.onclick = async () => {
      const inp = box.querySelector('[data-hin]');
      const h = (inp.value || '').trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9]{2,20}$/.test(h)) { toast('핸들 형식이 아니에요 (영문 소문자·숫자)'); return; }
      if (h === st.handle) { toast('내 핸들은 추가할 수 없어요'); return; }
      const ex = await getDoc(doc(db, 'tsites', h));
      if (!ex.exists()) { toast('@' + h + ' — 존재하지 않는 러브인포예요'); return; }
      b.data[btn.dataset.addh] = (b.data[btn.dataset.addh] || []).concat([{ h }]);
      delete bannerCache[h];
      st.dirty = true;
      openBlockEdit(b);
    };
  });
  box.querySelectorAll('[data-ups]').forEach((btn) => {
    btn.onclick = () => uploadMulti((urls) => {
      b.data[btn.dataset.ups] = (b.data[btn.dataset.ups] || []).concat(urls.map((u) => ({ img: u, size: 64, rot: 0 })));
      st.dirty = true; openBlockEdit(b);
    });
  });
  box.querySelectorAll('[data-srm]').forEach((x) => {
    x.onclick = () => { b.data.items.splice(parseInt(x.dataset.srm), 1); st.dirty = true; openBlockEdit(b); };
  });
  box.querySelectorAll('[data-upb]').forEach((btn) => {
    btn.onclick = () => uploadMulti((urls) => {
      b.data[btn.dataset.upb] = (b.data[btn.dataset.upb] || []).concat(urls.map((u) => ({ img: u, url: '' })));
      st.dirty = true; openBlockEdit(b);
    });
  });
  box.querySelectorAll('[data-brm]').forEach((x) => {
    x.onclick = () => { b.data.items.splice(parseInt(x.dataset.brm), 1); st.dirty = true; openBlockEdit(b); };
  });
  box.querySelectorAll('[data-rm]').forEach((x) => {
    x.onclick = () => { b.data.imgs.splice(parseInt(x.dataset.rm), 1); st.dirty = true; openBlockEdit(b); };
  });

  $('#be-cancel').onclick = () => { $('#blkedit').classList.remove('on'); renderPages(); };
  $('#be-save').onclick = () => {
    // 배너 URL 입력 수집 (data-k 바깥의 개별 입력)
    box.querySelectorAll('[data-burl]').forEach((inp) => {
      const i = parseInt(inp.dataset.burl);
      if (b.data.items && b.data.items[i]) b.data.items[i].url = inp.value.trim();
    });
    // 스티커 크기/기울기 수집
    box.querySelectorAll('[data-ssize]').forEach((inp) => {
      const i = parseInt(inp.dataset.ssize);
      if (b.data.items && b.data.items[i]) b.data.items[i].size = parseInt(inp.value) || 64;
    });
    box.querySelectorAll('[data-srot]').forEach((inp) => {
      const i = parseInt(inp.dataset.srot);
      if (b.data.items && b.data.items[i]) b.data.items[i].rot = parseInt(inp.value) || 0;
    });
    box.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      const kind = inp.dataset.kind;
      if (k === 'style') { b.style = inp.value; return; }
      if (!kind) { b.data[k] = inp.tagName === 'SELECT' && k === 'cols' ? parseInt(inp.value) : inp.value; return; }
      const lines = inp.value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (kind === 'lines') b.data[k] = lines.map((s) => s.startsWith('*') ? { t: s.slice(1).trim(), hi: true } : { t: s, hi: false });
      if (kind === 'dreamlines') b.data[k] = lines.map((s) => { const p = s.split('|'); return { rank: (p[0] || 'SUB').trim(), a: (p[1] || '').trim(), b: (p[2] || '').trim(), name: (p[3] || '').trim(), desc: (p[4] || '').trim() }; });
      if (kind === 'chatlines') b.data[k] = lines.map((s) => { const p = s.split('|'); return { side: (p[0] || 'L').trim().toUpperCase() === 'R' ? 'R' : 'L', ini: (p[1] || '').trim(), text: p.slice(2).join('|').trim() }; });
      if (kind === 'linklines') {
        const first = b.type === 'sns' ? 'icon' : 't';
        b.data[k] = lines.map((s) => { const p = s.split('|'); const o = { url: (p[1] || '').trim() }; o[first] = (p[0] || '').trim(); return o; });
      }
    });
    st.dirty = true;
    $('#blkedit').classList.remove('on');
    renderPages();
  };
  $('#blkedit').classList.add('on');
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
  const fi = $('#file-input');
  fi.value = '';
  fi.onchange = async () => {
    if (!fi.files[0]) return;
    toast('업로드 중…');
    try { const url = await uploadFile(fi.files[0]); if (url) { cb(url); toast('업로드 완료'); } }
    catch (e) { console.log('[성향글] up err', e); toast('업로드 실패'); }
  };
  fi.click();
}

function uploadMulti(cb) {
  const fi = $('#file-input-multi');
  fi.value = '';
  fi.onchange = async () => {
    if (!fi.files.length) return;
    toast('업로드 중… (' + fi.files.length + '장)');
    try {
      const urls = [];
      for (const f of fi.files) { const u = await uploadFile(f); if (u) urls.push(u); }
      cb(urls);
      toast('업로드 완료');
    } catch (e) { console.log('[성향글] upm err', e); toast('업로드 실패'); }
  };
  fi.click();
}

// ═══════════ 설정 패널 ═══════════
function fillPanel() {
  const t = st.site.theme;
  $('#s-bg').value = t.bg || '#08080B';
  $('#s-ac').value = t.ac || '#C9A227';
  $('#s-title').value = st.site.title || '';
  $('#s-sub').value = st.site.sub || '';
  $('#s-mark').value = st.site.mark || '';
  $('#s-nav').value = t.nav || 'dot';
  $('#s-header').value = t.header || 'both';
  $('#s-font').value = t.font || "'Pretendard', -apple-system, sans-serif";
  $('#s-fx').value = t.fx || 'fade';
  $('#s-css').value = t.css || '';
  const g = st.site.gate || {};
  $('#s-gate').value = g.on ? 'on' : 'off';
  $('#s-gate-opts').style.display = g.on ? 'block' : 'none';
  $('#s-gate-msg').value = g.msg || '';
  $('#s-gate-pw').value = g.pw || '';
  renderPanelTabs();
  bindPanel();
}

function renderPanelTabs() {
  const box = $('#s-tabs');
  box.innerHTML = '';
  st.site.tabs.forEach((tb, i) => {
    const it = document.createElement('div');
    it.className = 'tab-item';
    it.innerHTML = '<span>' + esc(tb.title) + '</span>' +
      '<button title="위로">↑</button><button title="아래로">↓</button><button title="이름">✎</button><button title="삭제">✕</button>';
    const [up, down, rn, del] = it.querySelectorAll('button');
    up.onclick = () => { if (i > 0) { st.site.tabs.splice(i, 1); st.site.tabs.splice(i - 1, 0, tb); st.dirty = true; curTab = 0; renderNav(); renderPages(); renderPanelTabs(); } };
    down.onclick = () => { if (i < st.site.tabs.length - 1) { st.site.tabs.splice(i, 1); st.site.tabs.splice(i + 1, 0, tb); st.dirty = true; curTab = 0; renderNav(); renderPages(); renderPanelTabs(); } };
    rn.onclick = () => { const n = prompt('카테고리 이름', tb.title); if (n) { tb.title = n; st.dirty = true; renderNav(); renderPanelTabs(); } };
    del.onclick = () => {
      if (st.site.tabs.length <= 1) { toast('카테고리는 하나 이상 필요해요'); return; }
      if (confirm('"' + tb.title + '" 카테고리와 안의 블록을 모두 삭제할까요?')) {
        st.site.tabs.splice(i, 1); st.dirty = true; curTab = 0;
        renderNav(); renderPages(); renderPanelTabs();
      }
    };
    box.appendChild(it);
  });
}

let panelBound = false;
function bindPanel() {
  if (panelBound) return;
  panelBound = true;
  const t = () => st.site.theme;
  $('#s-bg').oninput = (e) => { t().bg = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-ac').oninput = (e) => { t().ac = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-title').oninput = (e) => { st.site.title = e.target.value; st.dirty = true; $('#hero-h1').textContent = e.target.value; };
  $('#s-sub').oninput = (e) => { st.site.sub = e.target.value; st.dirty = true; $('#hero-p').textContent = e.target.value; };
  $('#s-mark').oninput = (e) => { st.site.mark = e.target.value; st.dirty = true; $('#hero-mark').textContent = e.target.value; };
  $('#s-nav').onchange = (e) => { t().nav = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-header').onchange = (e) => { t().header = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-font').onchange = (e) => { t().font = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-fx').onchange = (e) => { t().fx = e.target.value; st.dirty = true; applyTheme(); };
  $('#s-css').oninput = (e) => { t().css = e.target.value; st.dirty = true; $('#usercss').textContent = e.target.value; };
  $('#s-hero-up').onclick = () => uploadOne((url) => { t().heroImg = url; st.dirty = true; applyTheme(); });
  $('#s-hero-del').onclick = () => { t().heroImg = ''; st.dirty = true; applyTheme(); };
  $('#s-mybanner-up').onclick = () => uploadOne((url) => { st.site.myBanner = url; st.dirty = true; toast('내 배너 설정 완료 — 저장을 눌러 주세요'); });
  $('#s-mybanner-del').onclick = () => { st.site.myBanner = ''; st.dirty = true; toast('내 배너 제거'); };
  $('#s-gate').onchange = (e) => {
    st.site.gate = st.site.gate || {};
    st.site.gate.on = e.target.value === 'on';
    st.dirty = true;
    $('#s-gate-opts').style.display = st.site.gate.on ? 'block' : 'none';
  };
  $('#s-gate-msg').oninput = (e) => { st.site.gate.msg = e.target.value; st.dirty = true; };
  $('#s-gate-pw').oninput = (e) => { st.site.gate.pw = e.target.value; st.dirty = true; };
  $('#s-gate-up').onclick = () => uploadOne((url) => { st.site.gate.img = url; st.dirty = true; toast('대문 이미지 설정 완료'); });
  $('#s-gate-del').onclick = () => { st.site.gate.img = ''; st.dirty = true; toast('대문 이미지 제거'); };
  $('#s-tab-add').onclick = () => {
    const n = prompt('새 카테고리 이름', 'NEW');
    if (!n) return;
    st.site.tabs.push({ id: uid(), title: n, blocks: [] });
    st.dirty = true;
    renderNav(); renderPanelTabs();
  };
}

// ═══════════ 저장 ═══════════
async function saveSite() {
  if (!st.mine) return;
  st.site.updated = Date.now();
  try {
    await setDoc(doc(db, 'tsites', st.handle), st.site);
    st.dirty = false;
    renderFoot();
    toast('저장했어요 ✓');
  } catch (e) {
    console.log('[성향글] save err', e);
    toast('저장 실패 — 콘솔을 확인해 주세요');
  }
}

window.addEventListener('beforeunload', (e) => {
  if (st.dirty) { e.preventDefault(); e.returnValue = ''; }
});

boot();
