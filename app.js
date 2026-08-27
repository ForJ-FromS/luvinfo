// ═══════════════════════════════════════════════
// LUVINFO — app.js v9 (신판: 페이지 2종 + 프리셋 4종)
// luvlog(lovelog-cc579)와 같은 Firebase, 별도 컬렉션(tsites/tusers)
// ═══════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment, getDocs, collection, deleteDoc, query, where
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
const sha256 = async (s) => {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
};
const isHash = (s) => /^[0-9a-f]{64}$/i.test(s || '');

const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');

// 구 index + 신 app 스큐에서도 안 죽는 바인딩 헬퍼
function gid(i) { return document.getElementById(i); }

// ═══ 가입 설정 ═══
// mode: 'open' = 누구나 가입 / 'code' = 초대 코드 입력해야 가입
// 코드제로 바꾸려면: mode를 'code'로, code에 원하는 초대 코드를 넣고 재배포
const SIGNUP = { mode: 'invite', code: '' }; // invite = invites 컬렉션의 러브인포 코드(횟수제) / open = 자유 가입 / code = 고정 코드
const st = { user: null, myHandle: null, handle: null, site: null, mine: false, edit: false, dirty: false, cur: 0 };
const SYS_RESERVED = ['admin', 'api', 'www', 'index', 'login', 'signup', 'app', 'assets', 'static', 'luvinfo', 'luvlog', 'info', 'help', 'about', 'guide'];
const SAFE_MODE = new URLSearchParams(location.search).get('safe') === '1'; // HTML 페이지·커스텀CSS 미렌더 탈출구

console.log('[LUVINFO] app.js v121 로드');

function setDirty() {
  st.dirty = true;
  const b = document.getElementById('ob-save');
  if (b) b.classList.add('attn');
}

function toast(m, ms, act) {
  const t = $('#toast');
  t.textContent = m;
  t.onclick = null;
  t.classList.remove('tap');
  if (act) {
    t.classList.add('tap');
    t.onclick = () => { t.classList.remove('on', 'tap'); t.onclick = null; act(); };
  }
  t.classList.add('on');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.classList.remove('on', 'tap'); t.onclick = null; }, ms || 2400);
}

// ── 프리셋 기본값 (색 피커 표시용) ──
const CARDC = { white: '#FFFFFF', dark: '#101017', diary: '#FFFDF8', cute: '#FFFFFF', mono: '#FAFAFA', glass: '#FFFFFF', midnight: '#121733', forest: '#182A22', retro: '#C9C9C9', vhs: '#101013' };
const PRESETS = {
  white: { bg: '#FDFDFC', tx: '#1F1E1C', pri: '#1F1E1C' },
  dark:  { bg: '#08080B', tx: '#E8E4DA', pri: '#C9A227' },
  diary: { bg: '#F7F3EA', tx: '#4A4238', pri: '#B0693C' },
  cute:  { bg: '#FDF6F8', tx: '#5C4A52', pri: '#E58FA8' },
  mono:  { bg: '#FFFFFF', tx: '#151515', pri: '#151515' },
  glass: { bg: '#EDF0F7', tx: '#3A3F52', pri: '#6B7AA8' },
  midnight: { bg: '#0B1026', tx: '#DCE0F2', pri: '#8E9BD8' },
  forest: { bg: '#12201A', tx: '#E3E9E1', pri: '#7FB89A' },
  retro: { bg: '#C0C0C0', tx: '#1F1F1F', pri: '#000080' },
  vhs: { bg: '#060608', tx: '#E8E8E8', pri: '#FF3B4E' }
};

function defaultSite(ownerUid, handle) {
  return {
    ownerUid,
    head: { mode: 'text', over: 'INFO', title: handle.toUpperCase(), sub: 'TASTE ARCHIVE', img: '' },
    theme: { preset: 'white', bg: '', tx: '', pri: '', font: "'Pretendard'", nav: 'dot', num: 'on', css: '', corner: '', cardop: '', bgImg: '', bgDim: 84, valign: '' },
    gate: { on: false, msg: '', pw: '', img: '' },
    chapters: [{
      id: uid(), title: '기본', type: 'cell',
      body: '첫 페이지예요. 하단 ✎ 편집을 눌러 자유롭게 고쳐보세요.\n\n빈 줄로 문단을 나누고, 사진과 접은 글도 넣을 수 있어요.\n\n{접기:접은 글은 이렇게}\n눌러서 펼치는 내용이 여기 들어가요.\n{접기끝}',
      imgs: []
    }],
    heart: 0,
    updated: Date.now()
  };
}

// ═══════════ 라우팅 ═══════════
const SUB_ROOT = 'luvinfo.me';
function subHandle() {
  const h = location.hostname.toLowerCase();
  if (h.endsWith('.' + SUB_ROOT)) {
    const s = h.slice(0, -('.'.length + SUB_ROOT.length));
    if (s && s !== 'www') return s;
  }
  return null;
}
function homeUrl(h) {
  // 서브도메인에서 봐도 다른 홈 링크는 본 주소로 (로그인·저장이 되는 곳)
  const root = subHandle() ? 'https://' + SUB_ROOT + '/' : BASE;
  return root + encodeURIComponent(h);
}
function subUrl(h) { return 'https://' + encodeURIComponent(h) + '.' + SUB_ROOT; }
function beautifyUrl() {
  // ?h=핸들 → /핸들 로 주소창 정리 (다른 쿼리가 있으면 건드리지 않음)
  try {
    if (subHandle()) return; // 핸들.luvinfo.me — 이미 예쁜 주소
    const sp = new URLSearchParams(location.search);
    const keys = [...sp.keys()];
    if (!st.handle) return;
    if (keys.length && !(keys.length === 1 && keys[0] === 'h')) return;
    const want = new URL(homeUrl(st.handle)).pathname;
    if (location.pathname === want && !location.search) return;
    history.replaceState(null, '', homeUrl(st.handle));
  } catch (e) { /* 무시 */ }
}
function targetHandle() {
  const sub = subHandle();
  if (sub) return sub;
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
        if (st.myHandle === 'jeste') checkOpsNoti();   // 어느 화면이든 로그인만 하면 검사
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
      $('#btn-myhome').onclick = () => { location.href = homeUrl(st.myHandle); };
    }
    if (st.user) {
      $('#btn-start').textContent = st.myHandle ? '다른 계정으로 시작하기' : '핸들 만들기 (계속)';
      gid('btn-logout').style.display = '';
    }
    gid('btn-logout').onclick = doLogout;
    if (gid('landing-inq')) gid('landing-inq').onclick = (e) => { e.preventDefault(); if (st.myHandle === 'jeste') openOps(); else openInq(); };
    $('#landing').classList.add('show');
    $('#btn-start').onclick = login;
    return;
  }
  st.handle = h;
  beautifyUrl();
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
  if (st.site.priv && !st.mine) {
    // 비공개 홈 — 방문자에게는 없는 페이지처럼
    $('#landing').classList.add('show');
    $('#landing .desc').textContent = '@' + h + ' — 존재하지 않는 페이지예요.';
    $('#btn-start').onclick = login;
    return;
  }
  if (st.site.priv && st.mine) setTimeout(() => toast('🔒 비공개 상태예요 — 나만 볼 수 있어요'), 400);
  const g = st.site.gate || {};
  if (g.on && !st.mine && sessionStorage.getItem('sh_gate_' + h) !== '1') {
    applyTheme();  // 대문보다 먼저 테마 주입 — 기본 버튼색이 홈 테마 강조색을 따름
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

function closeGatePv(el, pvbar) {
  document.body.classList.remove('gatepv-mo');
  el.classList.remove('show');
  if (pvbar) pvbar.style.display = 'none';
  toast('미리보기 끝 — 저장해야 방문자에게 적용돼요');
}

function showGate(g, preview) {
  const el = $('#gate');
  el.classList.add('show');
  const pvbar = gid('gate-pvbar');
  const applyPvVars = (mobile) => {
    // 모바일 미리보기는 좁은 틀이라 @media가 안 걸림 — 모바일 조정값을 PC 변수 자리에 직접 주입
    const z = mobile ? (g.mz ?? g.z) : g.z, x = mobile ? (g.mx ?? g.x) : g.x, y = mobile ? (g.my ?? g.y) : g.y;
    const pair = z == null || z === '' ? null : [z + '% auto', (x ?? 50) + '% ' + (y ?? 50) + '%'];
    if (pair) { el.style.setProperty('--gbs', pair[0]); el.style.setProperty('--gbp', pair[1]); }
    else { el.style.removeProperty('--gbs'); el.style.removeProperty('--gbp'); }
  };
  if (preview && pvbar) {
    pvbar.style.display = 'flex';
    document.body.classList.remove('gatepv-mo');
    const mark = (mo) => { gid('gate-pv-pc').dataset.on = mo ? '' : '1'; gid('gate-pv-mo').dataset.on = mo ? '1' : ''; };
    gid('gate-pv-pc').onclick = () => { document.body.classList.remove('gatepv-mo'); applyPvVars(false); mark(false); };
    gid('gate-pv-mo').onclick = () => { document.body.classList.add('gatepv-mo'); applyPvVars(true); mark(true); };
    gid('gate-pv-x').onclick = () => closeGatePv(el, pvbar);
    const esc = (ev) => { if (ev.key === 'Escape') { closeGatePv(el, pvbar); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    mark(false);
  } else if (pvbar) { pvbar.style.display = 'none'; }
  el.dataset.style = g.style === 'full' ? 'full' : 'card';
  el.dataset.grad = g.grad === false ? 'off' : 'on';
  if (g.btnc) el.style.setProperty('--gbc', g.btnc); else el.style.removeProperty('--gbc');
  if (g.btnt) el.style.setProperty('--gbt', g.btnt); else el.style.removeProperty('--gbt');
  if (g.pwc) el.style.setProperty('--gpwc', g.pwc); else el.style.removeProperty('--gpwc');
  const bgOf = (z, x, y) => z == null || z === '' ? null : [z + '% auto', (x ?? 50) + '% ' + (y ?? 50) + '%'];
  const setBg = (sk, pk, pair) => {
    if (pair) { el.style.setProperty(sk, pair[0]); el.style.setProperty(pk, pair[1]); }
    else { el.style.removeProperty(sk); el.style.removeProperty(pk); }
  };
  if (g.style === 'full' && g.img) el.style.setProperty('--gimg', "url('" + g.img + "')");
  else el.style.removeProperty('--gimg');
  setBg('--gbs', '--gbp', bgOf(g.z, g.x, g.y));
  setBg('--gbsm', '--gbpm', bgOf(g.mz ?? g.z, g.mx ?? g.x, g.my ?? g.y));
  if (g.img) { $('#gate-img').src = g.img; $('#gate-img').style.display = 'block'; }
  else { $('#gate-img').style.display = 'none'; }
  $('#gate-over').textContent = g.over || '';
  $('#gate-over').style.display = g.over ? 'block' : 'none';
  $('#gate-enter').textContent = preview ? '✕ 미리보기 닫기' : (g.btn || '입장');
  $('#gate-msg').textContent = g.msg || 'WELCOME';
  $('#gate-pw').style.display = g.pw && !preview ? 'block' : 'none';
  const enter = async () => {
    if (preview) { closeGatePv(el, gid('gate-pvbar')); return; }
    if (g.pw) {
      const inp = $('#gate-pw').value;
      const ok = isHash(g.pw) ? (await sha256(inp)) === g.pw.toLowerCase() : inp === g.pw;
      if (!ok) { toast('비밀번호가 달라요'); return; }
    }
    sessionStorage.setItem('sh_gate_' + st.handle, '1');
    el.classList.remove('show');
    showSite();
  };
  $('#gate-enter').onclick = enter;
  $('#gate-pw').onkeydown = (e) => { if (e.key === 'Enter') enter(); };
}

// ═══════════ 로그인 / 가입 ═══════════
async function doLogout() {
  try { await signOut(auth); toast('로그아웃했어요'); setTimeout(() => location.href = BASE, 600); }
  catch (e) { console.log('[LUVINFO] logout err', e); toast('로그아웃 실패'); }
}

async function login() {
  if (subHandle()) {
    toast('로그인은 luvinfo.me에서 해요 — 이동할게요');
    setTimeout(() => { location.href = homeUrl(subHandle()); }, 700);
    return;
  }
  try {
    const r = await signInWithPopup(auth, new GoogleAuthProvider());
    const ud = await getDoc(doc(db, 'tusers', r.user.uid));
    if (!ud.exists()) { openClaim(r.user); return; }
    if (!ud.data().email) {
    }
    location.href = homeUrl(ud.data().handle);
  } catch (e) {
    console.log('[LUVINFO] login err', e);
    toast('로그인에 실패했어요');
  }
}

// ── 가입 핸들 실시간 확인 (예약·중복 미리 알림 — 최종 판정은 가입 버튼에서 한 번 더) ──
let _resvCache = null;
async function reservedSets() {
  if (_resvCache) return _resvCache;
  try {
    const [r1, r2, r3] = await Promise.all([
      getDoc(doc(db, 'config', 'reserved')),
      getDoc(doc(db, 'config', 'treserved')),
      getDoc(doc(db, 'config', 'tallow'))
    ]);
    const norm = (arr) => arr.map((x) => String(x).trim().toLowerCase());
    _resvCache = {
      allow: norm(r3.exists() ? (r3.data().list || []) : []),
      deny: norm([].concat(r1.exists() ? (r1.data().list || []) : []).concat(r2.exists() ? (r2.data().list || []) : []))
    };
  } catch (e) { _resvCache = { allow: [], deny: [] }; }
  return _resvCache;
}
let _hChkSeq = 0;
async function checkHandleLive() {
  const el = gid('claim-h-stat');
  if (!el) return;
  const seq = ++_hChkSeq;
  const h = gid('claim-h').value.trim().toLowerCase();
  if (!h) { el.textContent = ''; return; }
  if (!/^[a-z0-9]{2,20}$/.test(h)) { el.textContent = '영문 소문자·숫자 2~20자'; el.style.color = 'var(--mute)'; return; }
  el.textContent = '확인 중…'; el.style.color = 'var(--mute)';
  const rs = await reservedSets();
  if (seq !== _hChkSeq) return;
  if (!rs.allow.includes(h) && (SYS_RESERVED.includes(h) || rs.deny.includes(h))) {
    el.textContent = '✗ 사용할 수 없는 핸들이에요'; el.style.color = '#d66'; return;
  }
  try {
    const ex = await getDoc(doc(db, 'tsites', h));
    if (seq !== _hChkSeq) return;
    if (ex.exists()) { el.textContent = '✗ 이미 사용 중인 핸들이에요'; el.style.color = '#d66'; }
    else { el.textContent = '✓ 사용할 수 있어요 — luvinfo.me/' + h; el.style.color = 'var(--pri)'; }
  } catch (e) { if (seq === _hChkSeq) el.textContent = ''; }
}

function openClaim(user) {
  $('#landing').classList.remove('show');
  $('#claim').classList.add('on');
  if (gid('claim-code')) {
    gid('claim-code').value = '';
    const needCode = SIGNUP.mode === 'invite' || SIGNUP.mode === 'code';
    gid('claim-code').style.display = needCode ? '' : 'none';
    gid('claim-code').previousElementSibling.style.display = needCode ? '' : 'none';
  }
  if (gid('claim-h')) {
    gid('claim-h').value = '';
    if (gid('claim-h-stat')) gid('claim-h-stat').textContent = '';
    let tm;
    gid('claim-h').oninput = () => { clearTimeout(tm); tm = setTimeout(checkHandleLive, 450); };
  }
  if (gid('claim-ref')) {
    gid('claim-ref').value = '';
    const needRef = SIGNUP.mode === 'invite';
    gid('claim-ref').style.display = needRef ? '' : 'none';
    gid('claim-ref').previousElementSibling.style.display = needRef ? '' : 'none';
    if (gid('claim-ref-note')) gid('claim-ref-note').style.display = needRef ? '' : 'none';
  }
  $('#claim-cancel').onclick = () => { $('#claim').classList.remove('on'); $('#landing').classList.add('show'); };
  $('#claim-ok').onclick = async () => {
    // 이미 홈이 있는 계정은 새 가입 차단 — 남의 기기에서 가입 진행돼 소유권 꼬이는 사고 방지
    if (st.user) {
      try {
        const mine = await getDoc(doc(db, 'tusers', st.user.uid));
        if (mine.exists() && mine.data().handle) {
          toast('이 구글 계정엔 이미 @' + mine.data().handle + ' 홈이 있어요 — 로그아웃 후 본인 계정으로 가입해 주세요');
          return;
        }
      } catch (e) { /* 조회 실패 시 기존 흐름 유지 */ }
    }
    if (SIGNUP.mode === 'code') {
      const c = (gid('claim-code') ? gid('claim-code').value : '').trim();
      if (c !== SIGNUP.code) { toast('초대 코드가 달라요'); return; }
    }
    let claimCode = null, claimUses = 0, claimMax = 1;
    let claimRef = '';
    if (SIGNUP.mode === 'invite') {
      const code = (gid('claim-code') ? gid('claim-code').value : '').trim().toLowerCase();
      if (!code) { toast('초대 코드를 입력해 주세요'); return; }
      // ① 코드부터 확인 — 없는 코드는 핸들 검증 전에 걸러냄
      let planted = '';
      try {
        const iv = await getDoc(doc(db, 'invites', code));
        const d = iv.exists() ? (iv.data() || {}) : null;
        if (!d || d.svc !== 'luvinfo') { toast('초대코드가 올바르지 않아요'); return; }
        const spent = (d.used === true || (d.uses || 0) >= (d.max || 1));
        if (spent) { toast('이미 사용이 끝난 코드예요'); return; }
        claimCode = code;
        claimUses = d.uses || 0;
        claimMax = d.max || 1;
        planted = String(d.ref || '').trim();
      } catch (e) {
        console.log('[LUVINFO] invite check err', e);
        toast('코드 확인에 실패했어요 — 잠시 후 다시 시도해 주세요');
        return;
      }
      // ② 1차 — 심긴 코드면 심긴 값이 우선(운영자 확정 > 자기 신고), 아니면 @핸들 필수
      if (planted) {
        claimRef = planted;
      } else {
        const refRaw = (gid('claim-ref') ? gid('claim-ref').value : '').trim();
        if (!refRaw) { toast('초대해 준 분의 러브인포 핸들을 @핸들 형태로 적어 주세요'); return; }
        if (refRaw.charAt(0) !== '@') { toast('앞에 @를 붙여 주세요 (예: @jeste)'); return; }
        claimRef = refRaw.slice(1).toLowerCase();
        if (!/^[a-z0-9]{2,20}$/.test(claimRef)) { toast('핸들 형식이 아니에요 — @핸들 형태로 적어 주세요 (예: @jeste)'); return; }
        try {
          const rs = await getDoc(doc(db, 'tsites', claimRef));
          if (!rs.exists()) { toast('@' + claimRef + ' 홈을 찾을 수 없어요 — 초대해 준 분의 러브인포 핸들이 맞는지 확인해 주세요'); return; }
        } catch (e) {
          console.log('[LUVINFO] ref check err', e);
          toast('초대해 준 분 확인에 실패했어요 — 잠시 후 다시 시도해 주세요');
          return;
        }
      }
    }
    const h = $('#claim-h').value.trim().toLowerCase();
    if (!/^[a-z0-9]{2,20}$/.test(h)) { toast('영문 소문자·숫자 2~20자로 입력해 주세요'); return; }
    // 시스템 예약어 + 예약 핸들 목록(러브로그 config/reserved 공유 + 러브인포 전용 config/treserved)
    try {
      const [r1, r2, r3] = await Promise.all([
        getDoc(doc(db, 'config', 'reserved')),
        getDoc(doc(db, 'config', 'treserved')),
        getDoc(doc(db, 'config', 'tallow'))
      ]);
      const norm = (arr) => arr.map((x) => String(x).trim().toLowerCase());
      const allow = norm(r3.exists() ? (r3.data().list || []) : []);
      if (!allow.includes(h)) {
        if (SYS_RESERVED.includes(h)) { toast('사용할 수 없는 핸들이에요'); return; }
        const rl = norm([]
          .concat(r1.exists() ? (r1.data().list || []) : [])
          .concat(r2.exists() ? (r2.data().list || []) : []));
        if (rl.includes(h)) { toast('사용할 수 없는 핸들이에요'); return; }
      }
    } catch (e) { console.log('[LUVINFO] reserved check err', e); }
    const ex = await getDoc(doc(db, 'tsites', h));
    if (ex.exists()) { toast('이미 사용 중인 핸들이에요'); return; }
    try {
      await setDoc(doc(db, 'tsites', h), defaultSite(user.uid, h));
      await setDoc(doc(db, 'tusers', user.uid), {
        handle: h,
        ref: claimRef || '',
        joined: new Date().toISOString().slice(0, 10),
        ts: Date.now()
      });
      if (claimCode) {
        try {
          const nowUses = claimUses + 1;
          await setDoc(doc(db, 'invites', claimCode), {
            uses: nowUses, used: nowUses >= claimMax, usedBy: user.uid, usedRef: claimRef || '', usedAt: Date.now()
          }, { merge: true });
        } catch (e) { console.log('[LUVINFO] invite consume err', e); }
      }
      location.href = homeUrl(h);
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
  const nocss = new URLSearchParams(location.search).get('nocss') === '1' || SAFE_MODE;
  $('#usercss').textContent = nocss ? '' : tameCSS(t.css || '');
  if (t.corner) document.body.dataset.corner = t.corner; else delete document.body.dataset.corner;
  if (t.valign) document.body.dataset.valign = t.valign; else delete document.body.dataset.valign;
  if (t.cardC && /^#[0-9a-fA-F]{6}$/.test(t.cardC)) {
    const r = parseInt(t.cardC.slice(1, 3), 16), g = parseInt(t.cardC.slice(3, 5), 16), bl = parseInt(t.cardC.slice(5, 7), 16);
    b.setProperty('--cardbase', r + ', ' + g + ', ' + bl);
  } else {
    b.removeProperty('--cardbase');
  }
  if (t.cardop) document.body.dataset.op = t.cardop; else delete document.body.dataset.op;
  const sb = $('#site');
  if (t.bgImg) {
    const dimRaw = parseInt(t.bgDim);
    const dim = Math.min(96, Math.max(0, Number.isFinite(dimRaw) ? dimRaw : 84));
    const ov = 'color-mix(in srgb, var(--bg) ' + dim + '%, transparent)';
    sb.style.backgroundImage = 'linear-gradient(' + ov + ', ' + ov + '), url("' + t.bgImg + '")';
    sb.style.backgroundSize = 'cover';
    sb.style.backgroundPosition = 'center';
    sb.style.backgroundAttachment = 'fixed';
  } else {
    sb.style.backgroundImage = '';
  }
  document.body.dataset.chtitle = (st.site.theme && st.site.theme.chtitle) || '';
  const favEl = document.getElementById('fav');
  if (favEl) favEl.href = st.site.favicon || 'data:,';
  const hd = st.site.head || {};
  document.body.dataset.head = hd.mode || 'text';
  $('#h-over').textContent = hd.over || '';
  $('#h-over').style.display = hd.over ? '' : 'none';
  $('#h-title').textContent = hd.title || '';
  $('#h-sub').textContent = hd.sub || '';
  $('#h-sub').style.display = hd.sub ? '' : 'none';
  if ($('#h-rule')) $('#h-rule').style.display = hd.rule === false ? 'none' : '';
  const hi = $('#head-img');
  hi.style.height = (parseInt(hd.h) || 200) + 'px';
  if (hd.img) {
    // img + object-fit: 위아래(py)를 움직여도 크기 불변, 확대(sc)는 별도
    const py = Math.min(100, Math.max(0, parseInt(hd.py ?? 50)));
    const sc = Math.min(300, Math.max(100, parseInt(hd.sc) || 100));
    hi.style.backgroundImage = '';
    hi.style.overflow = 'hidden';
    hi.innerHTML = '<img src="' + esc(hd.img) + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;object-position:50% ' + py + '%;transform:scale(' + (sc / 100) + ');transform-origin:50% ' + py + '%;display:block;">';
  } else {
    hi.innerHTML = '';
    hi.style.backgroundImage = 'linear-gradient(150deg, var(--line), var(--card))';
  }
  document.title = hd.title || st.handle; // 홈은 홈 이름만(v65)
}

function showSite() {
  $('#site').style.display = 'block';
  $('#fabs').style.display = 'flex';
  checkNotice();
  checkMyReplies();
  checkNewGuest();
  if (gid('fab-logout')) {
    gid('fab-logout').style.display = st.user ? 'block' : 'none';
    gid('fab-logout').onclick = doLogout;
  }
  applyTheme();
  const _pp = parseInt(new URLSearchParams(location.search).get('p'));
  if (Number.isFinite(_pp) && _pp >= 1 && _pp <= viewChs().length) st.cur = _pp - 1;
  renderChapter();
  renderFoot();
  if (st.mine) {
    $('#fab-edit').style.display = 'block';
    $('#fab-view').style.display = 'block';
    $('#fab-edit').onclick = toggleEdit;
    if (st.myHandle === 'jeste' && gid('fab-ops')) {
      gid('fab-ops').style.display = 'block';
      gid('fab-ops').onclick = openOps;
      checkOpsNoti();
    }
    if (st.site._migrated) toast('새 구조로 새 출발이에요 — ✎ 편집으로 채워보세요');
  } else if (!st.user) {
    $('#fab-login').style.display = 'block';
    $('#fab-login').onclick = login;
  } else if (st.myHandle && st.myHandle !== st.handle) {
    $('#fab-my').style.display = 'block';
    $('#fab-my').onclick = () => { location.href = homeUrl(st.myHandle); };
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

// 보이는 페이지 목록 — 편집 모드에선 숨김 페이지도 보임
function viewChs() {
  const chs = (st.site && st.site.chapters) || [];
  return st.edit ? chs : chs.filter((c) => !c.hidden);
}
function renderChapter() {
  const chs = viewChs();
  if (st.cur >= chs.length) st.cur = Math.max(0, chs.length - 1);
  const ch = chs[st.cur];
  const titleEl = $('#ch-title');
  const bodyEl = $('#ch-body');
  if (!ch) {
    titleEl.style.display = 'none';
    $('#ch-timg-top').innerHTML = '';
    $('#ch-timg-bot').innerHTML = '';
    bodyEl.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:12.5px;letter-spacing:.1em;padding:40px 0;">아직 페이지가 없어요' + (st.mine ? ' — ✎ 편집으로 시작' : '') + '</p>';
    renderPager();
    return;
  }
  const name = chDisplayName(ch, st.cur);
  titleEl.textContent = name;
  titleEl.style.display = name ? '' : 'none';
  const tImg = ch.timg ? '<img src="' + esc(ch.timg) + '" alt="">' : '';
  $('#ch-timg-top').innerHTML = (tImg && (ch.timgPos || 'top') === 'top') ? tImg : '';
  $('#ch-timg-bot').innerHTML = (tImg && ch.timgPos === 'bot') ? tImg : '';
  if (ch.pw && !st.mine && sessionStorage.getItem('li_chpw_' + st.handle + '_' + ch.id) !== '1') {
    bodyEl.innerHTML = '<div class="ch-lock"><div class="lk">🔒</div><p>이 페이지는 비밀번호가 있어요</p>' +
      '<input type="password" id="chpw-in" autocomplete="off" placeholder="PASSWORD"><button class="mini-btn" id="chpw-ok">입장</button></div>';
    const tryPw = () => {
      if ($('#chpw-in').value === ch.pw) {
        sessionStorage.setItem('li_chpw_' + st.handle + '_' + ch.id, '1');
        renderChapter();
      } else { toast('비밀번호가 달라요'); }
    };
    $('#chpw-ok').onclick = tryPw;
    $('#chpw-in').onkeydown = (e) => { if (e.key === 'Enter') tryPw(); };
    renderPager();
    return;
  }
  document.body.dataset.chhead = (ch.type === 'html' && !ch.showHead) ? 'off' : 'on';
  if (ch.type === 'html' && SAFE_MODE) {
    bodyEl.innerHTML = '<div style="border:1px dashed var(--line);border-radius:12px;padding:40px 20px;text-align:center;color:var(--mute);font-size:12.5px;line-height:1.9;">🛟 안전 모드 — 이 페이지의 HTML은 표시하지 않아요.<br>✎ 편집에서 코드를 고치거나 페이지를 삭제한 뒤,<br>주소의 <code>?safe=1</code>을 지우고 다시 접속하세요.</div>';
    renderPager();
    return;
  }
  if (ch.type === 'html') {
    let body = ch.body || '';
    if (!body && ch.bodyRef) {
      if (htmlCache[ch.id] !== undefined) {
        body = htmlCache[ch.id];
      } else {
        bodyEl.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:11px;letter-spacing:.24em;padding:60px 0;">LOADING…</p>';
        const refAt = ch.bodyRef;
        fetch(refAt)
          .then((r) => r.text())
          .then((t) => {
            if (ch.bodyRef !== refAt || ch.body) return; // 그 사이 새 내용이 생겼으면 옛 응답 폐기
            htmlCache[ch.id] = t;
            if (viewChs()[st.cur] === ch) renderChapter();
          })
          .catch((e) => {
            console.log('[LUVINFO] html fetch err', e);
            bodyEl.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:12px;padding:60px 0;">이 페이지를 불러오지 못했어요 — 새로고침해 주세요</p>';
          });
        renderPager();
        return;
      }
    }
    const scope = 'hb-' + ch.id;
    bodyEl.innerHTML = '<div class="htmlblk ' + scope + '"></div>';
    const holder = bodyEl.querySelector('.htmlblk');
    holder.innerHTML = scopeHtml(body, '.' + scope);
    runScripts(holder);
  } else {
    migrateBlocks(ch);
    renderBlocks(ch, bodyEl);
  }
  renderPager();
}

// 대용량 HTML 페이지 본문 캐시 (Storage 오프로드용)
const htmlCache = {};

// HTML 페이지 스크립트 실행: innerHTML로 넣은 <script>는 죽어 있으므로 재생성
// 유저 HTML 다수가 window 'load'/'DOMContentLoaded'에 애니메이션 시동을 걸어둠.
// 러브인포는 로딩이 끝난 뒤 HTML을 끼워 넣으므로 그 신호는 이미 지나감 —
// 문서가 이미 complete면 늦게 온 대기자를 즉시 실행해 준다(앱 자체 로직에는 영향 없음).
(function patchLateLoad() {
  const wrap = (target) => {
    const orig = target.addEventListener.bind(target);
    target.addEventListener = function (type, cb, opts) {
      if ((type === 'load' || type === 'DOMContentLoaded') && document.readyState === 'complete' && typeof cb === 'function') {
        setTimeout(() => { try { cb.call(target, new Event(type)); } catch (e) { console.warn('[LUVINFO] late-' + type, e); } }, 0);
        return;
      }
      return orig(type, cb, opts);
    };
  };
  wrap(window); wrap(document);
})();

function runScripts(root) {
  root.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
  // window.onload = fn 직대입 방식도 회수 (load는 이미 지났으므로 직접 호출)
  setTimeout(() => {
    if (typeof window.onload === 'function' && document.readyState === 'complete') {
      const fn = window.onload; window.onload = null;
      try { fn.call(window, new Event('load')); } catch (e) { console.warn('[LUVINFO] late-onload', e); }
    }
  }, 0);
}

// HTML 페이지 격리: <style>이 페이지 크롬을 오염시키지 않게 셀렉터에 스코프를 접두
// 앱의 주인용 UI 클래스 — 유저 CSS가 이걸 건드리면 편집·저장이 막히므로 규칙째 제거
const UI_CLASSES = new Set(['fab-row', 'fab', 'fabs', 'owner-bar', 'ob-btn', 'sheet', 'sheet-bg', 'pop', 'adj-bg', 'toast']);
function hitsUI(sel) {
  const classes = (String(sel).match(/\.[A-Za-z_-][\w-]*/g) || []).map((c) => c.slice(1));
  return classes.some((c) => UI_CLASSES.has(c));
}
// 유저 CSS 순화: 화면 덮개(fixed)·과도한 z-index 무력화 + 앱 UI 겨냥 규칙 제거
function tameCSS(css) {
  let out = String(css || '')
    .replace(/position\s*:\s*fixed/gi, 'position:absolute')
    .replace(/z-index\s*:\s*(\d+)/gi, (m, n) => 'z-index:' + Math.min(parseInt(n) || 0, 500));
  out = out.replace(/([^{}]+)\{([^{}]*)\}/g, (m, sel) => (hitsUI(sel) ? '' : m));
  return out;
}
function scopeCSS(css, scope) {
  css = tameCSS(css);
  return css.replace(/(^|[{}])([^{}@;]+)\{/g, (m, boundary, sel) => {
    const scoped = sel.split(',').map((s) => {
      s = s.trim();
      if (!s) return s;
      if (/^(body|html|:root)$/i.test(s)) return scope;
      return scope + ' ' + s;
    }).filter(Boolean).join(', ');
    return boundary + ' ' + scoped + ' {';
  });
}
function scopeHtml(html, scope) {
  return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => '<style' + attrs + '>' + scopeCSS(css, scope) + '</style>');
}

// 보통 페이지 본문: 빈 줄 문단 + [사진N] + {접기:제목}…{접기끝}
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

// ═══════════ 블록 렌더 ═══════════
const CORNER_PX = { round: '16px', soft: '6px', sharp: '0px' };
const OP_VAL = { solid: '1', half: '.55', clear: '0' };

function blkVars(stl, base) {
  const corner = (stl && stl.corner) || (base && base.corner) || '';
  const op = (stl && stl.op) || (base && base.op) || '';
  let s = '';
  if (corner && CORNER_PX[corner]) s += '--radius:' + CORNER_PX[corner] + ';';
  if (op && OP_VAL[op] !== undefined) s += '--cardop:' + OP_VAL[op] + ';';
  return s;
}

function renderBlocks(ch, bodyEl) {
  bodyEl.innerHTML = '';
  let host = bodyEl;
  if (ch.wrap && ch.wrap.on) {
    const w = document.createElement('div');
    w.className = 'chwrap';
    w.dataset.on = '1';
    w.style.cssText = blkVars(ch.wrap, null);
    bodyEl.appendChild(w);
    host = w;
  }
  const blocks = ch.blocks || [];
  if (!blocks.length) {
    host.innerHTML = '<p style="text-align:center;color:var(--mute);font-size:12.5px;letter-spacing:.1em;padding:40px 0;">아직 블록이 없어요' + (st.mine ? ' — ✎ 편집으로 채워보세요' : '') + '</p>';
    return;
  }
  blocks.forEach((blk) => {
    const div = document.createElement('div');
    div.className = 'blk';
    const card = (blk.style && blk.style.card) || (ch.bstyle && ch.bstyle.card) || '';
    div.dataset.card = card === 'on' ? 'on' : 'off';
    div.style.cssText = blkVars(blk.style, ch.bstyle);
    const d = blk.data || {};
    if (blk.kind === 'txt') div.innerHTML = '<div class="cellbody">' + renderCellBody(d.body, d.imgs) + '</div>';
    else if (blk.kind === 'pf') div.appendChild(buildProfile(d));
    else if (blk.kind === 'gal' && (d.imgs || []).length) div.appendChild(buildGallery(d));
    else if (blk.kind === 'mu') div.appendChild(buildMusic(d));
    else if (blk.kind === 'stk' && (d.items || []).length) div.appendChild(buildSticker(d));
    else if (blk.kind === 'bn' && (d.items || []).length) div.appendChild(buildBanner(d));
    else if (blk.kind === 'lnk' && (d.items || []).length) div.appendChild(buildLinks(d));
    else if (blk.kind === 'quo' && d.text) div.appendChild(buildQuote(d));
    else if (blk.kind === 'dd' && d.date) div.appendChild(buildDday(d));
    else if (blk.kind === 'chat' && ((d.lines || []).length || d.body)) div.appendChild(buildChat(blk));
    else if (blk.kind === 'qa' && d.body) div.appendChild(buildQa(d));
    else if (blk.kind === 'tl' && ((d.items || []).length || d.body)) div.appendChild(buildTimeline(blk));
    else if (blk.kind === 'htm' && d.body) div.appendChild(buildHtmBlock(blk));
    else if (blk.kind === 'gb') div.appendChild(buildGbBlock());
    else return;
    host.appendChild(div);
  });
}

// 구(마커) 구조 → 블록 구조 변환
function migrateBlocks(ch) {
  if (ch.blocks) return;
  const blocks = [];
  const el = ch.el || {};
  const kindOf = { '[프로필]': 'pf', '[갤러리]': 'gal', '[음악]': 'mu', '[스티커]': 'stk', '[배너]': 'bn' };
  const used = {};
  const pushTxt = (seg) => {
    seg = (seg || '').trim();
    if (!seg) return;
    const imgs = [];
    const body = seg.replace(/\[사진(\d+)\]/g, (m, n) => {
      const u = (ch.imgs || [])[parseInt(n) - 1];
      if (!u) return '';
      imgs.push(u);
      return '[사진' + imgs.length + ']';
    });
    blocks.push({ id: uid(), kind: 'txt', data: { body, imgs }, style: {} });
  };
  let rest = ch.body || '';
  const re = /\[(프로필|갤러리|음악|스티커|배너)\]/;
  let m;
  while ((m = re.exec(rest))) {
    pushTxt(rest.slice(0, m.index));
    const kind = kindOf['[' + m[1] + ']'];
    if (el[kind] && !used[kind]) {
      blocks.push({ id: uid(), kind, data: el[kind], style: {} });
      used[kind] = true;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  pushTxt(rest);
  Object.keys(el).forEach((kind) => {
    if (!used[kind] && el[kind]) blocks.push({ id: uid(), kind, data: el[kind], style: {} });
  });
  ch.blocks = blocks;
  ch.bstyle = ch.bstyle || {};
  ch.wrap = ch.wrap || { on: false };
}

// ═══════════ 페이지 내 요소 렌더 ═══════════
function imgVars(o) {
  const z = parseInt(o.z) || 100;
  // 주의: style 속성이 큰따옴표라 url은 반드시 작은따옴표 (v17 사진 안 보임 사고)
  return "background-image:url('" + esc(o.u || o.img || '') + "');--pz:" + z + '%;--px:' + (o.x ?? 50) + '%;--py:' + (o.y ?? 50) + '%;';
}

function buildProfile(p) {
  const d = document.createElement('div');
  d.className = 'pf';
  d.dataset.pos = p.pos || 'left';
  if (p.nobox) d.dataset.nobox = '1';
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

function buildGbBlock() {
  const w = document.createElement('div');
  w.className = 'gbblk';
  w.innerHTML = '<div class="gb-foot"></div><ul class="gb-list" style="padding:0;margin:12px 0 0;max-height:360px;overflow-y:auto;"></ul>';
  const list = w.querySelector('.gb-list');
  const foot = w.querySelector('.gb-foot');
  const myUid = st.user ? st.user.uid : null;
  let rows = [];

  const render = () => {
    list.innerHTML = rows.length ? rows.map((g) => {
      const mineOrAuthor = st.mine || (myUid && g.uid === myUid);
      const who = g.home
        ? '<a href="/' + esc(g.home) + '">@' + esc(g.home) + '</a>'
        : '@' + esc(g.name || 'guest');
      const del = mineOrAuthor ? '<i class="del" data-gbd="' + esc(g.id) + '">삭제</i>' : '';
      let bodyHtml;
      if (g.secret) {
        bodyHtml = mineOrAuthor
          ? '<p>' + esc(g.text) + (st.mine ? '<span class="gb-badge">🔒 비공개</span>' : '<span class="gb-badge">🔒 내 글</span>') + '</p>'
          : '<p class="gb-lock">🔒 주인에게만 남긴 비공개 방명록이에요.</p>';
      } else bodyHtml = '<p>' + esc(g.text) + '</p>';
      const re = g.reply && (!g.secret || mineOrAuthor)
        ? '<p class="gb-re">↳ <b>' + esc((st.site.head && st.site.head.title) || st.handle) + '</b> ' + esc(g.reply) + '</p>' : '';
      const rebtn = st.mine ? '<i class="gb-rebtn" data-gbr="' + esc(g.id) + '">' + (g.reply ? '답글 수정' : '답글') + '</i>' : '';
      return '<li class="gb-item"><p class="who"><span>' + who + del + '</span><span class="dt">' + new Date(g.ts || 0).toLocaleDateString('ko-KR') + '</span></p>' + bodyHtml + re + rebtn + '<span class="gb-ref" data-gbf="' + esc(g.id) + '"></span></li>';
    }).join('') : '<p class="gb-empty">아직 방명록이 비어 있어요 — 첫 흔적을 남겨주세요.</p>';

    list.querySelectorAll('[data-gbd]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('이 방명록 글을 지울까요?')) return;
        try { await deleteDoc(doc(db, 'tsites', st.handle, 'tguest', b.dataset.gbd)); rows = rows.filter((x) => x.id !== b.dataset.gbd); render(); }
        catch (err) { toast('삭제 실패: ' + (err.message || err)); }
      };
    });
    list.querySelectorAll('[data-gbr]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.gbr, g = rows.find((x) => x.id === id); if (!g) return;
        const slot = list.querySelector('[data-gbf="' + id + '"]');
        if (slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = '<textarea class="gb-ret" maxlength="300" placeholder="답글 (비우고 저장하면 답글 삭제)" style="margin-top:6px;min-height:44px;"></textarea>' +
          '<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:5px;"><button class="mini-btn gb-resave">저장</button></div>';
        slot.querySelector('.gb-ret').value = g.reply || '';
        slot.querySelector('.gb-resave').onclick = async () => {
          const t = slot.querySelector('.gb-ret').value.trim();
          try {
            await updateDoc(doc(db, 'tsites', st.handle, 'tguest', id), { reply: t });
            g.reply = t; render(); toast(t ? '↳ 답글을 남겼어요' : '답글을 지웠어요');
          } catch (err) { toast('답글 실패: ' + (err.message || err)); }
        };
      };
    });
  };

  const buildForm = async () => {
    if (!st.user) {
      foot.innerHTML = '<div class="gb-empty">✍ 방명록은 러브인포 멤버만 남길 수 있어요. <a href="/" style="color:var(--pri);text-decoration:underline;">로그인하러 가기 →</a></div>';
      return;
    }
    let myH = st.mine ? st.handle : st._myH;
    if (myH === undefined) {
      try { const s = await getDoc(doc(db, 'tusers', st.user.uid)); myH = st._myH = s.exists() ? (s.data().handle || '') : ''; }
      catch (e) { myH = st._myH = ''; }
    }
    if (!myH) {
      foot.innerHTML = '<div class="gb-empty">✍ 방명록은 러브인포 멤버만 남길 수 있어요.</div>';
      return;
    }
    foot.innerHTML = '<textarea class="gb-msg" maxlength="500" placeholder="다녀간 흔적을 남겨주세요"></textarea>' +
      '<div class="gb-cnt">0/500</div>' +
      '<div class="gb-bar"><label class="gb-sec"><input type="checkbox" class="gb-secret"> 🔒 비공개로 남기기 (주인만 볼 수 있어요)</label><button class="gb-send">남기기</button></div>';
    const gbTa = foot.querySelector('.gb-msg'), gbCnt = foot.querySelector('.gb-cnt');
    gbTa.addEventListener('input', () => { gbCnt.textContent = gbTa.value.length + '/500'; });
    foot.querySelector('.gb-send').onclick = async () => {
      const text = foot.querySelector('.gb-msg').value.trim();
      if (!text) { toast('내용을 적어주세요'); return; }
      const secret = foot.querySelector('.gb-secret').checked;
      const id = uid() + uid();
      const rec = { home: myH, text: text.slice(0, 500), secret, reply: '', uid: st.user.uid, ts: Date.now() };
      try {
        await setDoc(doc(db, 'tsites', st.handle, 'tguest', id), rec);
        rows.unshift({ id, ...rec });
        foot.querySelector('.gb-msg').value = '';
        foot.querySelector('.gb-secret').checked = false;
        toast(secret ? '🔒 비공개로 남겼어요' : '📖 방명록에 남겼어요!');
        render();
      } catch (e) { toast('남기기 실패: ' + (e.message || e)); }
    };
  };

  (async () => {
    list.innerHTML = '<p class="gb-empty">불러오는 중…</p>';
    try {
      const qs = await getDocs(collection(db, 'tsites', st.handle, 'tguest'));
      qs.forEach((s) => rows.push({ id: s.id, ...s.data() }));
      rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    } catch (e) { /* 목록 실패해도 폼은 시도 */ }
    render();
    buildForm();
  })();
  return w;
}

function buildHtmBlock(blk) {
  const scope = 'hb-' + blk.id;
  const w = document.createElement('div');
  w.className = 'htmlblk ' + scope;
  w.innerHTML = scopeHtml(String(blk.data.body || ''), '.' + scope);
  runScripts(w);  // HTML 페이지와 동일하게 스크립트 허용
  return w;
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
      c.onclick = () => openLb(imgs.map((x) => x.u), i);
    });
  }
  return wrap;
}

function initGalSlider(rootEl, imgs) {
  let cur = 0;
  const slides = rootEl.querySelectorAll('.gal-slide');
  const nav = rootEl.querySelector('.gal-nav');
  slides.forEach((s, i) => {
    s.onclick = () => openLb(imgs.map((x) => x.u), i);
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

function ytId(u) {
  const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/);
  return m ? m[1] : null;
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
  const yid = ytId(m.url);
  if (yid) {
    // 유튜브 링크: 숨은 유튜브 플레이어로 재생/정지
    let fr = null;
    btn.onclick = () => {
      if (!fr) {
        fr = document.createElement('iframe');
        fr.src = 'https://www.youtube.com/embed/' + yid + '?autoplay=1&playsinline=1';
        fr.allow = 'autoplay; encrypted-media';
        fr.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
        d.appendChild(fr);
        d.classList.add('playing'); btn.textContent = '❚❚';
      } else {
        fr.remove(); fr = null;
        d.classList.remove('playing'); btn.textContent = '▶';
      }
    };
    return d;
  }
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

// ── v114 채팅로그·타임라인 (러브로그 이식) ──
// v113 문법(이름: 내용) 저장분 자동 승계
function chatLegacy(body) {
  if (!body) return [];
  const out = [];
  String(body).split('\n').forEach((line) => {
    const t = line.trim();
    if (!t) return;
    if (t.startsWith('--')) { out.push({ side: 'l', name: '', text: t.replace(/^-+\s*/, '').replace(/\s*-+$/, '') }); return; }
    const m = t.match(/^(\S[^:]{0,19}):\s*(.*)$/);
    if (!m) { if (out.length) out[out.length - 1].text += '\n' + t; return; }
    const me = m[1].trim() === '나';
    out.push({ side: me ? 'r' : 'l', name: me ? '' : m[1].trim(), text: m[2] });
  });
  return out;
}
function tlLegacy(body) {
  if (!body) return [];
  return String(body).split('\n').map((l) => l.trim()).filter(Boolean).map((t) => {
    const bar = t.indexOf('|');
    return bar > -1 ? { d: t.slice(0, bar).trim(), tt: '', t: t.slice(bar + 1).trim() } : { d: '', tt: '', t };
  });
}
function chatMigrate(d) { if (d.body && !(d.lines || []).length) { d.lines = chatLegacy(d.body); delete d.body; } return d; }
function tlMigrate(d) { if (d.body && !(d.items || []).length) { d.items = tlLegacy(d.body); delete d.body; } return d; }
function lumHex(hx) {
  try { const n = parseInt(hx.slice(1), 16); return (((n >> 16) & 255) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) / 255; }
  catch (e) { return .5; }
}
function buildChat(blk) {
  const d = chatMigrate(blk.data);
  const el = document.createElement('div');
  el.className = 'chatblk ch-' + (d.style || 'msg');
  const ls = (d.lines || []).filter((l) => l.text || l.name);
  if (d.anim && ls.length) {
    const akey = 'c' + (blk.id || '');
    const done = (window.__animDone ??= new Set()).has(akey);
    if (!(done && !d.loop)) {
      el.className += ' ch-anim';
      el.dataset.akey = akey;
      if (done) el.dataset.warm = '1';
      if (d.loop) el.dataset.loop = '1';
      if (d.loop && d.fold) el.dataset.fold = '1';
      chatObserve(el);
    }
  }
  const imgs = d.imgs !== false;
  const sv = [];
  if (d.cL) sv.push('--chL:' + d.cL);
  if (d.cR) sv.push('--chR:' + d.cR);
  const tL = d.tL || (d.cL ? (lumHex(d.cL) > .62 ? '#1a1a1a' : '#fff') : '');
  const tR = d.tR || (d.cR ? (lumHex(d.cR) > .62 ? '#1a1a1a' : '#fff') : '');
  if (tL) sv.push('--chLt:' + tL);
  if (tR) sv.push('--chRt:' + tR);
  if (d.tL || d.tR) sv.push('--chNm:' + (d.tL || d.tR));
  if (d.fs) sv.push('--chFs:' + d.fs + 'px');
  if (d.font === 'serif') sv.push("--chFf:'Noto Serif KR',serif");
  if (d.font === 'mono') sv.push("--chFf:'JetBrains Mono',monospace");
  if (sv.length) el.setAttribute('style', sv.join(';'));
  if (+d.maxH > 0) { el.className += ' ch-scroll'; el.style.setProperty('--chMax', (+d.maxH) + 'px'); }
  const box = document.createElement('div');
  box.className = 'ch-box';
  ls.forEach((l) => {
    const row = document.createElement('div');
    row.className = 'ch-line ' + (l.side === 'r' ? 'r' : 'l');
    if (imgs && l.img) {
      const p = document.createElement('img');
      p.className = 'ch-p'; p.src = l.img; p.alt = ''; p.draggable = false;
      row.appendChild(p);
    }
    const b = document.createElement('div');
    b.className = 'ch-b';
    if (l.name) { const n = document.createElement('span'); n.className = 'ch-n'; n.textContent = l.name; b.appendChild(n); }
    const pp = document.createElement('p'); pp.textContent = l.text || ''; b.appendChild(pp);
    row.appendChild(b);
    box.appendChild(row);
  });
  const lab = document.createElement('p'); lab.className = 'label'; lab.textContent = 'CHAT';
  el.appendChild(lab); el.appendChild(box);
  // 움짤 자리 예약 (러브로그 방식): 재생 전 실제 높이만큼 확보해 출렁임 방지
  if (d.anim && el.classList.contains('ch-anim')) {
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.classList.remove('ch-anim');
      const need = +d.maxH > 0 ? Math.min(box.scrollHeight, +d.maxH) : box.scrollHeight;
      el.classList.add('ch-anim');
      if (need > 0) box.style.minHeight = need + 'px';
    });
  }
  return el;
}
function buildTimeline(blk) {
  const d = tlMigrate(blk.data);
  const el = document.createElement('div');
  el.className = 'tlblk tl-' + (d.style || 'line');
  const its = (d.items || []).filter((i) => i.t || i.d || i.tt);
  if (d.anim && its.length) {
    const akey = 't' + (blk.id || '');
    const done = (window.__animDone ??= new Set()).has(akey);
    if (!(done && !d.loop)) {
      el.className += ' ch-anim';
      el.dataset.akey = akey;
      if (done) el.dataset.warm = '1';
      if (d.loop) el.dataset.loop = '1';
      if (d.loop && d.fold) el.dataset.fold = '1';
      chatObserve(el);
    }
  }
  if (+d.maxH > 0) { el.className += ' ch-scroll'; el.style.setProperty('--chMax', (+d.maxH) + 'px'); }
  const lab = document.createElement('p'); lab.className = 'label'; lab.textContent = d.title || 'TIMELINE';
  el.appendChild(lab);
  const box = document.createElement('div');
  box.className = 'ch-box tl-box';
  its.forEach((i) => {
    const w = document.createElement('div');
    w.className = 'ch-line tl-i';
    const dot = document.createElement('span');
    dot.className = 'tl-dot' + (d.dot ? ' cdot' : '');
    dot.textContent = d.dot || '';
    w.appendChild(dot);
    const bd = document.createElement('span'); bd.className = 'tl-bd';
    if (i.d) { const dt = document.createElement('i'); dt.className = 'tl-d'; dt.textContent = i.d; bd.appendChild(dt); }
    if (i.tt) { const tt = document.createElement('b'); tt.className = 'tl-tt'; tt.textContent = i.tt; bd.appendChild(tt); }
    if (i.t) { const p = document.createElement('p'); p.className = 'tl-t'; p.textContent = i.t; bd.appendChild(p); }
    w.appendChild(bd);
    box.appendChild(w);
  });
  el.appendChild(box);
  if (d.anim && el.classList.contains('ch-anim')) {
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.classList.remove('ch-anim');
      const need = +d.maxH > 0 ? Math.min(box.scrollHeight, +d.maxH) : box.scrollHeight;
      el.classList.add('ch-anim');
      if (need > 0) box.style.minHeight = need + 'px';
    });
  }
  return el;
}
// 등장 재생기 (러브로그 chatPlay 이식)
function chatPlay(el) {
  const lines = [...el.querySelectorAll('.ch-line')];
  const box = el.querySelector('.ch-box');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lines.forEach((l) => l.classList.add('ch-in'));
    if (box) { box.style.minHeight = ''; box.scrollTop = 0; }
    return;
  }
  if (box) box.scrollTop = 0;
  let i = 0;
  if (el.dataset.warm === '1') {
    lines.forEach((l) => l.classList.add('ch-in'));
    i = lines.length;
    if (box) { box.style.minHeight = ''; box.style.minHeight = box.clientHeight + 'px'; box.scrollTop = box.scrollHeight; }
  }
  const step = () => {
    if (!el.isConnected) return;
    if (i >= lines.length) {
      if (el.dataset.akey) { (window.__animDone ??= new Set()).add(el.dataset.akey); }
      if (box) {
        box.style.minHeight = '';
        if (el.dataset.loop === '1') box.style.minHeight = box.clientHeight + 'px';
      }
      if (el.dataset.loop === '1')
        setTimeout(() => {
          if (!el.isConnected) return;
          if (box && el.dataset.fold === '1' && !el.classList.contains('ch-scroll')) {
            box.style.transition = 'min-height .5s ease';
            box.style.minHeight = '0px';
          }
          lines.forEach((l) => l.classList.remove('ch-in'));
          if (box) box.scrollTop = 0;
          i = 0; setTimeout(step, 500);
        }, 2400);
      return;
    }
    lines[i].classList.add('ch-in');
    if (box && box.scrollHeight > box.clientHeight)
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    i++; setTimeout(step, 650);
  };
  setTimeout(step, 420);
}
const chatIO = ('IntersectionObserver' in window)
  ? new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { chatIO.unobserve(e.target); chatPlay(e.target); }
    }), { threshold: .25 })
  : null;
function chatObserve(el) { if (chatIO) chatIO.observe(el); else chatPlay(el); }
// ── 문답(인터뷰) 블록: Q./A. + 「이름: 답」으로 페어 인터뷰 (한 질문에 여러 명 대답) ──
function buildQa(d) {
  const el = document.createElement('div');
  el.className = 'qablk';
  const items = [];
  const cur = () => items[items.length - 1];
  const lastAns = () => { const c = cur(); return c && c.ans.length ? c.ans[c.ans.length - 1] : null; };
  (d.body || '').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const qm = t.match(/^[QqＱ][.:．：]?\s+(.*)$/);
    if (qm) { items.push({ q: qm[1], ans: [] }); return; }
    const am = t.match(/^[AaＡ][.:．：]?\s+(.*)$/);
    if (am) { if (!cur()) items.push({ q: '', ans: [] }); cur().ans.push({ n: '', t: am[1] }); return; }
    const nm = t.match(/^(\S[^:]{0,15}):\s+(.*)$/);
    if (nm && cur()) { cur().ans.push({ n: nm[1].trim(), t: nm[2] }); return; }
    const la = lastAns();
    if (la) la.t += '\n' + t;
    else if (cur()) cur().q += '\n' + t;
  });
  items.forEach((it) => {
    const w = document.createElement('div');
    w.className = 'qa-item';
    if (it.q) {
      const q = document.createElement('div');
      q.className = 'qa-q';
      const qm2 = document.createElement('span');
      qm2.className = 'qm';
      qm2.textContent = 'Q.';
      q.appendChild(qm2);
      q.appendChild(document.createTextNode(it.q));
      w.appendChild(q);
    }
    it.ans.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'qa-a' + (a.n ? ' named' : '');
      if (a.n) {
        const nn = document.createElement('b');
        nn.className = 'qa-an';
        nn.textContent = a.n;
        row.appendChild(nn);
      }
      row.appendChild(document.createTextNode(a.t));
      w.appendChild(row);
    });
    el.appendChild(w);
  });
  return el;
}
function buildQuote(d) {
  const w = document.createElement('div');
  w.className = 'quoblk';
  w.innerHTML = '<span class="qmark">“</span><p>' + esc(d.text || '').replace(/\n/g, '<br>') + '</p>' +
    (d.by ? '<i>— ' + esc(d.by) + '</i>' : '');
  return w;
}

function buildDday(d) {
  const w = document.createElement('div');
  w.className = 'ddblk';
  const target = new Date(d.date + 'T00:00:00');
  let txt = '';
  if (!isNaN(target)) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today) / 86400000);
    if (d.one) {
      // 당일을 1일로 세는 'n일 째' — 당일·지난 날짜에 적용, 미래는 D-n 유지
      txt = diff > 0 ? 'D-' + diff : (-diff + 1) + '일 째';
    } else {
      txt = diff > 0 ? 'D-' + diff : (diff === 0 ? 'D-DAY' : 'D+' + (-diff));
    }
  }
  w.innerHTML = '<b>' + txt + '</b>' + (d.label ? '<span>' + esc(d.label) + '</span>' : '') +
    '<i>' + esc(d.date || '') + '</i>';
  return w;
}

function buildLinks(d) {
  const w = document.createElement('div');
  w.className = 'lnkblk';
  w.innerHTML = (d.items || []).map((it) =>
    '<a class="lnkrow" href="' + esc(it.u || '#') + '" target="_blank" rel="noopener"><span>→ ' + esc(it.t || it.u || '') + '</span><i>↗</i></a>'
  ).join('');
  return w;
}

function buildBanner(bn) {
  const d = document.createElement('div');
  d.className = 'banners';
  d.innerHTML = (bn.items || []).map((it) => {
    if (it.h) return '<a data-bh="' + esc(it.h) + '" href="' + esc(homeUrl(it.h)) + '"><span class="tb">@' + esc(it.h) + '</span></a>';
    return '<a href="' + esc(it.url || '#') + '" target="_blank" rel="noopener"><img src="' + esc(it.img) + '" alt=""></a>';
  }).join('');
  d.querySelectorAll('[data-bh]').forEach(async (a) => {
    const info = await bannerInfo(a.dataset.bh);
    if (!info) { const tb = a.querySelector('.tb'); if (tb) tb.textContent = '@' + a.dataset.bh + ' (없음)'; return; }
    if (info.img) a.innerHTML = '<img src="' + esc(info.img) + '" alt="">' + (info.mut ? '<span class="mut">♥</span>' : '');
    else a.innerHTML = '<span class="tb">' + esc(info.title) + '</span>' + (info.mut ? '<span class="mut">♥</span>' : '');
  });
  return d;
}

const bannerCache = {};
async function bannerInfo(h) {
  if (bannerCache[h] !== undefined) return bannerCache[h];
  try {
    const d = await getDoc(doc(db, 'tsites', h));
    if (!d.exists()) return (bannerCache[h] = null);
    const s = d.data();
    if (s.priv) return (bannerCache[h] = null);
    let mut = false;
    (s.chapters || []).forEach((c) => {
      // 현행: 블록 스택(v17~) / 하위 호환: 옛 el.bn 구조
      (c.blocks || []).forEach((b) => {
        if (b.kind === 'bn') ((b.data?.items) || []).forEach((it) => { if (it.h === st.handle) mut = true; });
      });
      ((c.el?.bn?.items) || []).forEach((it) => { if (it.h === st.handle) mut = true; });
    });
    return (bannerCache[h] = { img: s.myBanner || '', title: s.head?.title || h, mut });
  } catch (e) {
    console.log('[LUVINFO] bannerInfo err', e);
    return null;
  }
}

// ═══════════ 사진 조정 팝업 (공용) ═══════════
let adjT = null, adjCb = null, adjDrag = null;
function openAdjust(target, cb, ratio) {
  adjT = target; adjCb = cb;
  $('#adj-view').style.aspectRatio = ratio || '1';
  target.z = parseInt(target.z) || 100;
  target.x = target.x ?? 50;
  target.y = target.y ?? 50;
  const v = $('#adj-view');
  v.style.backgroundImage = 'none';
  v.style.setProperty('--aju', "url('" + (target.u || target.img || '') + "')");
  $('#adj-zoom').value = target.z;
  adjApply();
  $('#adj-bg').classList.add('on');
  $('#adj').classList.add('on');
}
function adjApply() {
  const v = $('#adj-view');
  v.style.setProperty('--ajs', adjT.z + '% auto');
  v.style.setProperty('--ajp', adjT.x + '% ' + adjT.y + '%');
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
  const nudge = (dx, dy) => { if (!adjT) return; adjT.x = Math.max(0, Math.min(100, (adjT.x ?? 50) + dx)); adjT.y = Math.max(0, Math.min(100, (adjT.y ?? 50) + dy)); adjApply(); };
  $('#adj-l').onclick = () => nudge(-5, 0);
  $('#adj-r').onclick = () => nudge(5, 0);
  $('#adj-u').onclick = () => nudge(0, -5);
  $('#adj-d').onclick = () => nudge(0, 5);
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
  const chs = viewChs();
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
      b.textContent = (st.edit && ch.hidden ? '🙈 ' : '') + (ch.title || String(i + 1).padStart(2, '0'));
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
      if (st.edit && chs[i].hidden) d.style.opacity = '.35';
      d.onclick = () => go(i);
      dots.appendChild(d);
    });
    pg.appendChild(dots);
    pg.appendChild(arrow(1, '›'));
  }
}

function go(i) {
  const chs = viewChs();
  if (!chs.length) return;
  st.cur = ((i % chs.length) + chs.length) % chs.length;
  renderChapter();
  window.scrollTo({ top: 0 });
}

// ── 라이트박스 상태 (←/→ 넘기기용) ──
let lbImgs = [], lbIdx = 0;
function openLb(list, i) {
  lbImgs = list || []; lbIdx = i || 0;
  $('#lb-img').src = lbImgs[lbIdx];
  $('#lightbox').classList.add('on');
}
function lbGo(d) {
  if (lbImgs.length < 2) return;
  lbIdx = (lbIdx + d + lbImgs.length) % lbImgs.length;
  $('#lb-img').src = lbImgs[lbIdx];
}

// ── 키보드: 라이트박스(Esc·←→) > 페이지 넘김(←→, 열람 중일 때만) ──
document.addEventListener('keydown', (e) => {
  const lb = $('#lightbox');
  if (lb && lb.classList.contains('on')) {
    if (e.key === 'Escape') { lb.classList.remove('on'); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { lbGo(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { lbGo(1); e.preventDefault(); }
    return;
  }
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  if (!st.site || st.edit) return;
  if (document.querySelector('.sheet.on')) return;
  const gate = document.getElementById('gate');
  if (gate && gate.classList.contains('show')) return;
  const claim = document.getElementById('claim');
  if (claim && claim.classList.contains('on')) return;
  go(st.cur + (e.key === 'ArrowRight' ? 1 : -1));
});

async function openOps() {
  gid('ops-bg').classList.add('on');
  gid('ops-sheet').classList.add('on');
  gid('ops-out').value = '';
  try { const n = await getDoc(doc(db, 'config', 'tnotice')); renderNoticeList(n.exists() ? tnItems(n.data()) : []); } catch (e) { /* */ }
  markOpsSeen();
  renderInqBox();
}
function closeOps() {
  gid('ops-bg').classList.remove('on');
  gid('ops-sheet').classList.remove('on');
}
function markOpsSeen() {
  localStorage.setItem('li_ops_seen', String(Date.now()));
  const f = gid('fab-ops');
  if (f) f.textContent = '⚙ 운영';
}
// ── 공지: 쌓임형 (러브로그 사양) — tnotice { items:[{id,date,text}...] }, 구형 {text,id,date}는 자동 승계 ──
function tnItems(d) {
  if (!d) return [];
  if (Array.isArray(d.items)) return d.items.filter((x) => x && x.text);
  if (d.text && d.id) return [{ id: d.id, date: d.date || '', text: d.text }];
  return [];
}
function tnSeen() {
  try {
    const raw = localStorage.getItem('li_notice_seen') || '[]';
    if (raw.charAt(0) === '[') return JSON.parse(raw).map(String);
    return [raw]; // 구형: 단일 id 문자열
  } catch (e) { return []; }
}
function tnMarkSeen(ids) {
  const s = new Set(tnSeen()); ids.forEach((i) => s.add(String(i)));
  localStorage.setItem('li_notice_seen', JSON.stringify([...s].slice(-100)));
}
async function tnSave(items) {
  await setDoc(doc(db, 'config', 'tnotice'), { items });
}
function renderNoticeList(items) {
  const box = gid('ops-notice-list');
  if (!box) return;
  box.innerHTML = '';
  items.forEach((it, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid var(--line);font-size:12px;';
    const dt = document.createElement('span');
    dt.style.cssText = 'color:var(--mute);font-size:11px;white-space:nowrap;';
    dt.textContent = (it.date || '').replaceAll('-', '.');
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx);';
    tx.textContent = (it.text || '').split('\n')[0];
    const del = document.createElement('button');
    del.className = 'mini-btn';
    del.textContent = '삭제';
    del.onclick = async () => {
      if (!confirm('이 공지를 지울까요?\n「' + tx.textContent.slice(0, 30) + '…」')) return;
      items.splice(idx, 1);
      try { await tnSave(items); renderNoticeList(items); toast('지웠어요'); }
      catch (e) { toast('삭제 실패 — tnotice 쓰기 규칙 확인'); }
    };
    row.appendChild(dt); row.appendChild(tx); row.appendChild(del);
    box.appendChild(row);
  });
  if (!items.length) {
    box.innerHTML = '<div class="f-note" style="border-top:1px solid var(--line);padding-top:8px;">올린 공지가 없어요.</div>';
  }
}

async function checkNotice() {
  try {
    if (!st.user) return;  // 서비스 공지는 로그인한 이용자에게만 — 구경 온 손님에겐 안 띄움
    const s = await getDoc(doc(db, 'config', 'tnotice'));
    if (!s.exists()) return;
    const items = tnItems(s.data());
    if (!items.length) return;
    const seen = tnSeen();
    const unseen = items.filter((it) => !seen.includes(String(it.id)));
    if (!unseen.length) return;
    const body = gid('notice-body');
    body.innerHTML = '';
    items.slice(0, 5).forEach((it, i) => {
      const wrap = document.createElement('div');
      if (i > 0) wrap.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px dashed var(--line);';
      const head = document.createElement('div');
      head.style.cssText = 'font-size:11px;color:var(--mute);margin-bottom:4px;display:flex;gap:6px;align-items:center;';
      head.textContent = (it.date || '').replaceAll('-', '.');
      if (!seen.includes(String(it.id))) {
        const nw = document.createElement('span');
        nw.textContent = 'NEW!';
        nw.style.cssText = 'color:var(--pri);font-weight:700;font-size:10px;letter-spacing:.06em;';
        head.appendChild(nw);
      }
      const tx = document.createElement('div');
      tx.textContent = it.text;
      wrap.appendChild(head); wrap.appendChild(tx);
      body.appendChild(wrap);
    });
    gid('notice-bg').classList.add('on');
    gid('notice-pop').classList.add('on');
    const close = () => {
      tnMarkSeen(unseen.map((it) => it.id));
      gid('notice-bg').classList.remove('on');
      gid('notice-pop').classList.remove('on');
    };
    gid('notice-ok').onclick = close;
    gid('notice-close').onclick = close;
    gid('notice-bg').onclick = close;
  } catch (e) { /* 공지는 실패해도 조용히 */ }
}

function genCode(prefix) {
  const words = ['star', 'wave', 'luna', 'nova', 'echo', 'aqua', 'iris', 'onyx', 'mint', 'fern'];
  const w = prefix || words[Math.floor(Math.random() * words.length)];
  const n = Math.random().toString(36).slice(2, 6);
  return (w + '-' + n).toLowerCase();
}
async function opsMake() {
  const prefix = gid('ops-prefix').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const count = Math.min(50, Math.max(1, parseInt(gid('ops-count').value) || 1));
  const max = Math.min(99, Math.max(1, parseInt(gid('ops-max').value) || 1));
  // 1차 지정 (선택) — 실존 핸들이면 그대로, 아니면 자유 표기로 심을지 확인
  let ref1 = (gid('ops-ref1') ? gid('ops-ref1').value : '').trim().replace(/^@/, '');
  if (ref1) {
    let known = false;
    if (/^[a-z0-9]{2,20}$/.test(ref1.toLowerCase())) {
      try {
        const rs = await getDoc(doc(db, 'tsites', ref1.toLowerCase()));
        if (rs.exists()) { known = true; ref1 = ref1.toLowerCase(); }
      } catch (e) { /* 조회 실패 시 자유 표기 확인으로 */ }
    }
    if (!known && !confirm('「' + ref1 + '」은(는) 러브인포 가입자 핸들이 아니에요.\n자유 표기로 그대로 심을까요? (트위터 닉 등)')) return;
  }
  const made = [];
  try {
    for (let i = 0; i < count; i++) {
      const c = genCode(prefix);
      await setDoc(doc(db, 'invites', c), Object.assign({ svc: 'luvinfo', max, uses: 0, used: false, at: Date.now() }, ref1 ? { ref: ref1 } : {}));
      made.push(c + (ref1 ? ' (1차:' + ref1 + ')' : ''));
    }
    gid('ops-out').value = made.join('\n');
    toast(made.length + '개 만들었어요 ✓ (코드당 ' + max + '명' + (ref1 ? ' · 1차:' + ref1 : '') + ')');
  } catch (e) {
    console.log('[LUVINFO] ops make err', e);
    toast('코드 생성 실패 — 규칙이 게시됐는지 확인해 주세요');
  }
}

async function openInq() {
  if (!st.user) { toast('문의는 로그인 후 보낼 수 있어요'); return; }
  gid('inq-body').value = '';
  gid('inq-bg').classList.add('on');
  gid('inq-sheet').classList.add('on');
  const mine = gid('inq-mine');
  if (mine) {
    mine.innerHTML = '';
    try {
      const qs = await getDocs(query(collection(db, 'tinquiries'), where('uid', '==', st.user.uid)));
      const rows = [];
      qs.forEach((s) => rows.push(s.data()));
      rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const latest = rows.reduce((m, r) => Math.max(m, r.repliedAt || 0), 0);
      if (latest) localStorage.setItem('li_inq_seen', String(latest));
      if (rows.length) {
        mine.innerHTML = '<label style="display:block;font-size:11px;letter-spacing:.06em;color:var(--dim);margin:14px 0 8px;">내가 보낸 문의</label>' +
          rows.map((r) =>
            '<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:12px;">' +
            '<div style="color:var(--dim);font-size:10.5px;margin-bottom:4px;">' + esc(r.date || '') + '</div>' +
            '<div style="white-space:pre-wrap;word-break:break-word;">' + esc(r.body || '') + '</div>' +
            (r.reply ? '<div style="margin-top:8px;padding:8px 10px;border-left:2px solid var(--pri);background:rgba(127,127,127,.06);white-space:pre-wrap;word-break:break-word;">' + esc(r.reply) + '</div>' : '<div style="margin-top:6px;color:var(--mute);font-size:10.5px;">답변 대기 중</div>') +
            '</div>').join('');
      }
    } catch (e) { /* 본인 read 실패 시 조용히 */ }
  }
}
function closeInq() {
  gid('inq-bg').classList.remove('on');
  gid('inq-sheet').classList.remove('on');
}
async function sendInq() {
  const body = gid('inq-body').value.trim();
  if (!body) { toast('내용을 적어주세요'); return; }
  if (body.length > 2000) { toast('2000자 이내로 적어주세요'); return; }
  try {
    await setDoc(doc(db, 'tinquiries', uid()), {
      uid: st.user.uid,
      handle: st.myHandle || '',
      email: st.user.email || '',
      body,
      ts: Date.now(),
      date: new Date().toISOString().slice(0, 10)
    });
    closeInq();
    toast('문의를 보냈어요 ✓');
  } catch (e) {
    console.log('[LUVINFO] inq err', e);
    toast('전송 실패 — 규칙이 아직 없을 수 있어요 (운영자에게 알려주세요)');
  }
}
async function sendOpsDm() {
  const h = gid('ops-dm-handle').value.trim().replace(/^@/, '').toLowerCase();
  const body = gid('ops-dm-body').value.trim();
  if (!h || !body) { toast('핸들과 내용을 적어주세요'); return; }
  try {
    const qs = await getDocs(query(collection(db, 'tusers'), where('handle', '==', h)));
    let target = null;
    qs.forEach((s) => { target = { uid: s.id, ...s.data() }; });
    if (!target) { toast('@' + h + ' 을(를) 못 찾았어요 — 핸들을 확인해 주세요'); return; }
    const now = Date.now();
    await setDoc(doc(db, 'tinquiries', uid()), {
      uid: target.uid,
      handle: h,
      email: '',
      body: '📮 운영자가 보낸 쪽지예요',
      reply: body,
      fromOps: 1,
      ts: now,
      repliedAt: now,
      date: new Date().toISOString().slice(0, 10)
    });
    gid('ops-dm-body').value = '';
    toast('📮 @' + h + ' 에게 쪽지를 보냈어요 — 다음 접속 때 알림이 떠요');
  } catch (e) { toast('쪽지 보내기 실패: ' + (e.message || e)); }
}

async function checkOpsNoti() {
  // jeste: 마지막 확인 이후 새 문의 → ⚙ 배지
  try {
    const seen = parseInt(localStorage.getItem('li_ops_seen') || '0');
    const qs = await getDocs(collection(db, 'tinquiries'));
    let n = 0;
    qs.forEach((s) => { const d = s.data() || {}; if (!d.fromOps && (d.ts || 0) > seen) n++; });
    if (n > 0) {
      if (gid('fab-ops')) gid('fab-ops').textContent = '⚙ 운영 ●' + n;
      toast('📮 새 문의 ' + n + '건이 있어요 — 눌러서 열기', 4500, openOps);
    }
  } catch (e) { /* 조용히 */ }
}

// ── v120 방명록 새 글 알림 (내 홈에 들어왔을 때) ──
async function checkNewGuest() {
  try {
    if (!st.mine || !st.handle) return;
    const key = 'li_gb_seen_' + st.handle;
    const seen = parseInt(localStorage.getItem(key) || '0');
    const qs = await getDocs(collection(db, 'tsites', st.handle, 'tguest'));
    let n = 0, newest = seen;
    qs.forEach((d) => {
      const g = d.data() || {};
      const ts = parseInt(g.ts) || 0;
      if (ts > newest) newest = ts;
      if (ts > seen && g.uid !== st.user?.uid) n++;
    });
    if (!n) { localStorage.setItem(key, String(newest)); return; }
    localStorage.setItem(key, String(newest));
    toast('📖 방명록에 새 글 ' + n + '개가 있어요 — 눌러서 보기', 6000, () => {
      const gb = document.querySelector('.gbblk');
      if (gb) gb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else toast('이 페이지엔 방명록 블록이 없어요 — 방명록이 있는 페이지에서 확인해 주세요');
    });
  } catch (e) { /* 조회 실패는 조용히 */ }
}

async function checkMyReplies() {
  // 일반 유저: 내 문의에 새 답변 → 알림
  if (!st.user || !st.myHandle || st.myHandle === 'jeste') return;
  try {
    const seen = parseInt(localStorage.getItem('li_inq_seen') || '0');
    const qs = await getDocs(query(collection(db, 'tinquiries'), where('uid', '==', st.user.uid)));
    let nReply = 0, nDm = 0;
    qs.forEach((s) => {
      const d = s.data() || {};
      if (d.reply && (d.repliedAt || 0) > seen) { if (d.fromOps) nDm++; else nReply++; }
    });
    if (nDm > 0 && nReply > 0) toast('📮 운영자 쪽지와 문의 답변이 도착했어요 — 눌러서 바로 확인', 4500, openInq);
    else if (nDm > 0) toast('📮 운영자가 보낸 쪽지가 있어요 — 눌러서 바로 확인', 4500, openInq);
    else if (nReply > 0) toast('📮 문의에 답변이 도착했어요 — 눌러서 바로 확인', 4500, openInq);
  } catch (e) { /* 조용히 */ }
}

async function renderInqBox() {
  const box = gid('inqbox-list');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--mute);font-size:12px;">불러오는 중…</p>';
  try {
    const qs = await getDocs(collection(db, 'tinquiries'));
    const rows = [];
    qs.forEach((s) => rows.push({ id: s.id, ...s.data() }));
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (!rows.length) { box.innerHTML = '<p style="color:var(--mute);font-size:12px;">아직 문의가 없어요.</p>'; return; }
    box.innerHTML = rows.map((r) =>
      '<div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;' + (r.fromOps ? 'opacity:.75;' : '') + '">' +
      '<div style="font-size:11px;color:var(--dim);margin-bottom:6px;">' + esc(r.date || '') + ' · @' + esc(r.handle || '?') + (r.email ? ' · ' + esc(r.email) : '') + (r.fromOps ? ' · 📮 보낸 쪽지' : (r.reply ? ' · ✓ 답변함' : '')) +
      ' <i data-inqdel="' + esc(r.id) + '" style="float:right;cursor:pointer;font-style:normal;color:var(--mute);">🗑</i></div>' +
      (r.fromOps
        ? '<div style="font-size:12.5px;white-space:pre-wrap;word-break:break-word;">' + esc(r.reply || '') + '</div></div>'
        : '<div style="font-size:12.5px;white-space:pre-wrap;word-break:break-word;">' + esc(r.body || '') + '</div>' +
          '<textarea data-inqre="' + esc(r.id) + '" style="min-height:150px;margin-top:8px;width:100%;box-sizing:border-box;font-size:13px;line-height:1.8;resize:vertical;" placeholder="답변 쓰기 — 문의한 사람이 ✉ 문의 창에서 보게 돼요">' + esc(r.reply || '') + '</textarea>' +
          '<div style="margin-top:6px;"><button class="mini-btn" data-inqsave="' + esc(r.id) + '">답변 저장</button></div></div>')
    ).join('');
    box.querySelectorAll('[data-inqdel]').forEach((x) => {
      x.onclick = async () => {
        if (!confirm('이 문의를 지울까요?')) return;
        try { await deleteDoc(doc(db, 'tinquiries', x.dataset.inqdel)); renderInqBox(); toast('지웠어요'); }
        catch (e) { toast('삭제 실패'); }
      };
    });
    box.querySelectorAll('[data-inqsave]').forEach((x) => {
      x.onclick = async () => {
        const ta = box.querySelector('[data-inqre="' + x.dataset.inqsave + '"]');
        try {
          await setDoc(doc(db, 'tinquiries', x.dataset.inqsave), { reply: ta.value, repliedAt: Date.now() }, { merge: true });
          toast('답변 저장 ✓');
        } catch (e) { console.log('[LUVINFO] reply err', e); toast('저장 실패 — 규칙에 update 허용이 있는지 확인해 주세요'); }
      };
    });
  } catch (e) {
    console.log('[LUVINFO] inqbox err', e);
    box.innerHTML = '<p style="color:var(--mute);font-size:12px;">불러오기 실패 — tinquiries 규칙이 게시됐는지 확인해 주세요.</p>';
  }
}

// ── v113 방문자 수: tsites/{h}/tstats/counter — 로그인 방문 1일 1회(세션 기준) 집계 ──
async function fillVisitCnt(el) {
  try {
    const ref = doc(db, 'tsites', st.handle, 'tstats', 'counter');
    const today = new Date().toISOString().slice(0, 10);
    const snap = await getDoc(ref);
    const cur = snap.exists() ? (snap.data() || {}) : {};
    let total = parseInt(cur.total) || 0;
    let tday = cur.day === today ? (parseInt(cur.today) || 0) : 0;
    const key = 'li_cnt_' + st.handle + '_' + today;
    if (st.user && !sessionStorage.getItem(key)) {
      try {
        await setDoc(ref, { total: total + 1, day: today, today: tday + 1 });
        total += 1; tday += 1;
        sessionStorage.setItem(key, '1');
      } catch (e) { /* 규칙 미게시 등 — 표시만 */ }
    }
    el.textContent = '방문 ' + tday + ' · 누적 ' + total;
  } catch (e) { el.textContent = ''; }
}
function renderFoot() {
  $('#hcount').textContent = st.site.heart || 0;
  const liked = localStorage.getItem('sh_like_' + st.handle) === '1';
  $('#heart').classList.toggle('liked', liked);
  $('#heart .h').textContent = liked ? '♥' : '♡';
  const d = new Date(st.site.updated || Date.now());
  $('#upd-date').textContent = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  const ft = gid('foot-txt');
  if (ft) {
    const txt = (st.site.footTxt || '').trim();
    ft.textContent = txt;
    ft.style.display = txt ? '' : 'none';
  }
  const lv = (st.site.luvlog || '').trim();
  if (gid('foot-lv')) {
    gid('foot-lv').style.display = lv ? '' : 'none';
    if (lv && gid('foot-luvlog')) gid('foot-luvlog').href = 'https://' + lv + '.luvlog.me';
  }
  const f = st.site.foot || {};
  const showEl = (id, on) => { const el = gid(id); if (el) el.style.display = on ? '' : 'none'; };
  showEl('heart', f.heart !== false);
  const cp = document.querySelector('.copy-btn'); if (cp) cp.style.display = f.copy === false ? 'none' : '';
  // 링크 줄: 보이는 항목 사이에만 구분점 (꼬리·머리 구분점 금지)
  const hasLv = !!lv, hasGuide = f.guide !== false, hasInq = f.inq !== false;
  showEl('foot-guide', hasGuide);
  showEl('foot-inq', hasInq);
  showEl('foot-lvdot', hasLv && (hasGuide || hasInq));
  showEl('foot-gdot', hasGuide && hasInq);
  showEl('foot-links', hasLv || hasGuide || hasInq);
  const fc = gid('foot-cnt');
  if (fc) {
    if (f.cnt) { fc.style.display = ''; fillVisitCnt(fc); }
    else { fc.style.display = 'none'; }
  }
  // 시스템 줄: 날짜 끄면 가운뎃점도 함께
  showEl('upd-date', f.date !== false);
  showEl('foot-sysdot', f.date !== false);
  const hl = document.querySelector('.heart-line'); if (hl) hl.style.display = (f.heart === false && f.copy === false) ? 'none' : '';
}

let shellBound = false;
function bindShell() {
  if (shellBound) return;
  shellBound = true;
  // 접은 글 · 사진 라이트박스 (위임)
  $('#ch-body').addEventListener('click', (e) => {
    const fh = e.target.closest('.fold-head');
    if (fh) {
      const f = fh.parentElement, fb = f.querySelector('.fold-body');
      const opening = !f.classList.contains('open');
      f.classList.toggle('open');
      if (fb) fb.style.maxHeight = opening ? fb.scrollHeight + 'px' : '';
      return;
    }
    const img = e.target.closest('.cellbody img');
    if (img) {
      const all = [...document.querySelectorAll('.cellbody img')].map((x) => x.src);
      openLb(all, Math.max(0, all.indexOf(img.src)));
    }
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
    const pq = st.cur > 0 ? '?p=' + (st.cur + 1) : '';
    navigator.clipboard?.writeText(subUrl(st.handle) + pq)
      .then(() => toast(pq ? '이 페이지 링크를 복사했어요 ✓ — 바로 ' + (st.cur + 1) + '페이지로 열려요' : '링크를 복사했어요 ✓ — ' + st.handle + '.luvinfo.me'))
      .catch(() => toast('복사에 실패했어요'));
  };
  $('#foot-brand').onclick = (e) => { e.preventDefault(); location.href = BASE; };
  if (gid('foot-inq')) gid('foot-inq').onclick = (e) => {
    e.preventDefault();
    if (st.myHandle === 'jeste') openOps();
    else openInq();
  };
  if (gid('inq-close')) gid('inq-close').onclick = closeInq;
  if (gid('inq-bg')) gid('inq-bg').onclick = closeInq;
  if (gid('inq-send')) gid('inq-send').onclick = sendInq;

  // 운영
  if (gid('ops-close')) gid('ops-close').onclick = closeOps;
  if (gid('ops-bg')) gid('ops-bg').onclick = closeOps;
  if (gid('ops-make')) gid('ops-make').onclick = opsMake;
  if (gid('ops-notice-save')) gid('ops-notice-save').onclick = async () => {
    const text = gid('ops-notice').value.trim();
    if (!text) { toast('공지 내용을 적어주세요'); return; }
    try {
      const n = await getDoc(doc(db, 'config', 'tnotice'));
      const items = n.exists() ? tnItems(n.data()) : [];
      items.unshift({ id: Date.now(), date: new Date().toISOString().slice(0, 10), text });
      await tnSave(items);
      gid('ops-notice').value = '';
      renderNoticeList(items);
      if (gid('ops-notice-stat')) gid('ops-notice-stat').textContent = '올렸어요! 새 항목엔 NEW! 뱃지가 붙어요. 오래된 공지는 아래에서 지우면 돼요.';
    } catch (e) { console.log('[LUVINFO] notice err', e); toast('공지 저장 실패 — tnotice 쓰기 규칙 확인'); }
  };
  if (gid('ops-notice-del')) gid('ops-notice-del').onclick = async () => {
    try {
      const n = await getDoc(doc(db, 'config', 'tnotice'));
      const items = n.exists() ? tnItems(n.data()) : [];
      if (!items.length) { toast('내릴 공지가 없어요'); return; }
      if (!confirm('가장 최근 공지를 내릴까요?\n「' + items[0].text.split('\n')[0].slice(0, 30) + '…」')) return;
      items.shift();
      await tnSave(items);
      renderNoticeList(items);
      if (gid('ops-notice-stat')) gid('ops-notice-stat').textContent = '최근 공지를 내렸어요.';
    } catch (e) { toast('실패'); }
  };
  if (gid('ops-dm-send')) gid('ops-dm-send').onclick = sendOpsDm;
  if (gid('ops-clear')) gid('ops-clear').onclick = () => { gid('ops-out').value = ''; };
  if (gid('ops-noti-reset')) gid('ops-noti-reset').onclick = () => { markOpsSeen(); toast('알림을 초기화했어요'); };
  if (gid('ops-copy')) gid('ops-copy').onclick = () => {
    const v = gid('ops-out').value.trim();
    if (!v) { toast('복사할 코드가 없어요'); return; }
    navigator.clipboard?.writeText(v).then(() => toast('전체 복사!')).catch(() => toast('복사 실패'));
  };
  $('#ob-add').onclick = () => openChapterEdit(null, 'cell');
  $('#ob-addhtml').onclick = () => openChapterEdit(null, 'html');
  $('#ob-deco').onclick = openDeco;
  $('#ob-save').onclick = saveSite;

  // 페이지 도구
  $('#ct-edit').onclick = () => { const ch = viewChs()[st.cur]; if (ch) openChapterEdit(ch, ch.type); };
  $('#ct-up').onclick = () => moveChapter(-1);
  $('#ct-down').onclick = () => moveChapter(1);
  $('#ct-del').onclick = () => {
    const ch = viewChs()[st.cur];
    if (!ch) return;
    if (!confirm('이 페이지를 삭제할까요?')) return;
    const chs = st.site.chapters;
    chs.splice(chs.indexOf(ch), 1);
    setDirty();
    if (st.cur >= viewChs().length) st.cur = Math.max(0, viewChs().length - 1);
    renderChapter();
  };

  // 시트 닫기
  $('#es-close').onclick = closeEditSheet;
  $('#es-cancel').onclick = closeEditSheet;
  $('#edit-bg').onclick = closeEditSheet;
  $('#dc-close').onclick = closeDeco;
  $('#deco-bg').onclick = closeDeco;

  // 스큐(구 index + 신 app) 방어: 한 구획이 죽어도 나머지는 산다
  try { bindDeco(); } catch (e) { console.log('[LUVINFO] bindDeco err (index 구버전 캐시?)', e); }
  try { bindEditor(); } catch (e) {
    console.log('[LUVINFO] bindEditor err (index 구버전 캐시?)', e);
    toast('편집 기능이 일부 로드되지 않았어요 — Ctrl+Shift+R로 새로고침해 주세요');
  }
  try { bindAdjust(); } catch (e) { console.log('[LUVINFO] bindAdjust err (index 구버전 캐시?)', e); }
  const fv = $('#fab-view');
  if (fv) fv.onclick = () => {
    const on = document.body.classList.toggle('mv');
    fv.textContent = on ? '💻' : '📱';
  };
}

function moveChapter(d) {
  const chs = st.site.chapters;
  const vis = viewChs();
  const cur = vis[st.cur];
  const tgt = vis[st.cur + d];
  if (!cur || !tgt) return;
  const a = chs.indexOf(cur), b = chs.indexOf(tgt);
  if (a < 0 || b < 0) return;
  chs[a] = tgt; chs[b] = cur;
  st.cur += d;
  setDirty();
  renderChapter();
}

// ═══════════ 편집 모드 ═══════════
function toggleEdit() {
  const cur = viewChs()[st.cur];
  st.edit = document.body.classList.toggle('edit');
  $('#fab-edit').textContent = st.edit ? '보기 모드' : '✎ 편집';
  if (!st.edit) {
    closeEditSheet(); closeDeco();
    if (st.dirty) toast('저장하지 않은 변경이 있어요 — ✓ 저장을 눌러 주세요');
  }
  const idx = viewChs().indexOf(cur);
  st.cur = idx >= 0 ? idx : 0;
  renderChapter();
}

// ── 페이지 편집 시트 (블록 스택) ──
let work = null;
let isNewCh = false;
let editingBlk = null;

const KIND_LABEL = { txt: '글', pf: '프로필', gal: '갤러리', mu: '음악', stk: '스티커', bn: '배너', lnk: '링크', quo: '인용구', dd: '디데이', chat: '채팅로그', qa: '문답', tl: '타임라인', htm: 'HTML', gb: '방명록' };

function newBlockData(kind) {
  if (kind === 'txt') return { body: '', imgs: [] };
  if (kind === 'pf') return { img: '', z: 100, x: 50, y: 50, pos: 'left', shape: 'circle', size: 64, nm: '', acc: '', ds: '' };
  if (kind === 'gal') return { layout: '3', imgs: [] };
  if (kind === 'mu') return { title: '', artist: '', url: '' };
  if (kind === 'htm') return { body: '' };
  if (kind === 'gb') return {};
  if (kind === 'stk') return { items: [] };
  if (kind === 'bn') return { items: [] };
  if (kind === 'lnk') return { items: [] };
  if (kind === 'quo') return { text: '', by: '' };
  if (kind === 'dd') return { label: '', date: '' };
  if (kind === 'chat') return { lines: [] };
  if (kind === 'qa') return { body: '' };
  if (kind === 'tl') return { items: [] };
  return {};
}

function blkSummary(blk) {
  const d = blk.data || {};
  if (blk.kind === 'txt') return (d.body || '').trim().replace(/\n/g, ' ').slice(0, 26) || '(빈 글)';
  if (blk.kind === 'pf') return d.nm || d.acc || '(이름 없음)';
  if (blk.kind === 'gal') return (d.imgs || []).length + '장 · ' + (d.layout === 'slider' ? '슬라이더' : d.layout + '열');
  if (blk.kind === 'mu') return d.title || '(제목 없음)';
  if (blk.kind === 'stk') return (d.items || []).length + '개';
  if (blk.kind === 'bn') return (d.items || []).length + '개';
  if (blk.kind === 'lnk') return (d.items || []).length + '개';
  if (blk.kind === 'quo') return (d.text || '').slice(0, 14);
  if (blk.kind === 'dd') return d.label || d.date || '';
  if (blk.kind === 'chat') return ((d.lines || chatLegacy(d.body)).length) + '마디';
  if (blk.kind === 'qa') return ((d.body || '').match(/^[QqＱ][.:．：]/gm) || []).length + '문';
  if (blk.kind === 'tl') return ((d.items || tlLegacy(d.body)).length) + '항목';
  return '';
}

function openChapterEdit(ch, type) {
  work = ch || { id: uid(), title: '', pw: '', type, body: '', blocks: type === 'cell' ? [] : undefined, bstyle: {}, wrap: { on: false } };
  isNewCh = !ch;
  editingBlk = null;
  if (type === 'cell') { migrateBlocks(work); work.bstyle = work.bstyle || {}; work.wrap = work.wrap || { on: false }; }
  $('#es-title').textContent = ch ? '페이지 수정' : (type === 'html' ? '새 HTML 페이지' : '새 페이지');
  $('#es-name').value = work.title || '';
  $('#es-pw').value = work.pw || '';
  if (gid('es-hidden')) gid('es-hidden').checked = !!work.hidden;
  if (gid('es-timgpos')) gid('es-timgpos').value = work.timgPos || 'top';
  if (gid('es-timg-chip')) gid('es-timg-chip').textContent = work.timg ? '이미지 있음 ✓' : '없음';
  const isHtml = type === 'html';
  $('#es-cellrow').style.display = isHtml ? 'none' : 'block';
  $('#bl-edit').style.display = 'none';
  $('#es-htmlrow').style.display = isHtml ? 'block' : 'none';
  if (isHtml) {
    if (gid('es-showhead')) gid('es-showhead').checked = !!work.showHead;
    const cached = work.body || htmlCache[work.id];
    if (!cached && work.bodyRef) {
      $('#es-html').value = '불러오는 중…';
      const wid = work.id;
      const refAt = work.bodyRef;
      fetch(refAt).then((r) => r.text()).then((t) => {
        if (!work || work.id !== wid || work.bodyRef !== refAt || work.body) return;
        htmlCache[wid] = t;
        if ($('#es-html').value === '불러오는 중…') $('#es-html').value = t;
      }).catch(() => { if (work && work.id === wid) { $('#es-html').value = ''; toast('본문을 불러오지 못했어요'); } });
    } else {
      $('#es-html').value = cached || '';
    }
  } else {
    $('#ebs-card').value = work.bstyle.card || '';
    $('#ebs-corner').value = work.bstyle.corner || '';
    $('#ebs-op').value = work.bstyle.op || '';
    $('#ew-on').value = work.wrap.on ? '1' : '';
    $('#ew-corner').value = work.wrap.corner || '';
    $('#ew-op').value = work.wrap.op || '';
    renderBlockList();
  }
  $('#edit-bg').classList.add('on');
  $('#edit-sheet').classList.add('on');
}

function renderBlockList() {
  const box = $('#bl-list');
  const blocks = work.blocks || [];
  if (!blocks.length) {
    box.innerHTML = '<div class="bl-empty">아래 ＋ 버튼으로 블록을 쌓아보세요</div>';
    return;
  }
  box.innerHTML = blocks.map((blk, i) =>
    '<div class="blrow" draggable="true" data-bi="' + i + '"><span class="drag" title="끌어서 순서 바꾸기">⠿</span><span class="kind">' + KIND_LABEL[blk.kind] + (blk.label ? ' · <b style="color:var(--tx);font-weight:600;">' + esc(blk.label) + '</b>' : '') + '</span>' +
    '<span class="sum">' + esc(blkSummary(blk)) + '</span>' +
    '<button class="ct" data-bmv="' + i + ',-1" title="위로">↑</button>' +
    '<button class="ct" data-bmv="' + i + ',1" title="아래로">↓</button>' +
    '<button class="ct" data-bed="' + i + '" title="수정">✎</button>' +
    '<button class="ct" data-bcp="' + i + '" title="복제">⧉</button>' +
    '<button class="ct del" data-brm="' + i + '" title="삭제">🗑</button></div>'
  ).join('');
  let dragFrom = null;
  box.querySelectorAll('.blrow').forEach((row) => {
    row.ondragstart = (e) => {
      dragFrom = parseInt(row.dataset.bi);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) { /* */ }
    };
    row.ondragend = () => { row.classList.remove('dragging'); box.querySelectorAll('.blrow').forEach((r) => r.classList.remove('over')); };
    row.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('over'); };
    row.ondragleave = () => row.classList.remove('over');
    row.ondrop = (e) => {
      e.preventDefault();
      row.classList.remove('over');
      let from = dragFrom;
      if (from === null) { const t = parseInt(e.dataTransfer.getData('text/plain')); if (Number.isFinite(t)) from = t; }
      const to = parseInt(row.dataset.bi);
      dragFrom = null;
      if (!Number.isFinite(from) || from === to) return;
      const [mv] = blocks.splice(from, 1);
      blocks.splice(to, 0, mv);
      renderBlockList();
    };
  });
  box.querySelectorAll('[data-bmv]').forEach((x) => {
    x.onclick = () => {
      const [i, d] = x.dataset.bmv.split(',').map(Number);
      const j = i + d;
      if (j < 0 || j >= blocks.length) return;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      renderBlockList();
    };
  });
  box.querySelectorAll('[data-bed]').forEach((x) => {
    x.onclick = () => openBlockEdit(blocks[parseInt(x.dataset.bed)]);
  });
  box.querySelectorAll('[data-bcp]').forEach((x) => {
    x.onclick = () => {
      const i = parseInt(x.dataset.bcp);
      const cp = JSON.parse(JSON.stringify(blocks[i]));
      if (cp.id) cp.id = uid();
      blocks.splice(i + 1, 0, cp);
      renderBlockList();
    };
  });
  box.querySelectorAll('[data-brm]').forEach((x) => {
    x.onclick = () => {
      if (!confirm('이 블록을 삭제할까요?')) return;
      blocks.splice(parseInt(x.dataset.brm), 1);
      renderBlockList();
    };
  });
}

function openBlockEdit(blk) {
  editingBlk = blk;
  if (gid('ble-label')) gid('ble-label').value = blk.label || '';
  $('#es-cellrow').style.display = 'none';
  $('#bl-edit').style.display = 'block';
  ['txt', 'pf', 'gal', 'mu', 'stk', 'bn', 'lnk', 'quo', 'dd', 'chat', 'qa', 'tl', 'htm', 'gb'].forEach((k) => {
    $('#ble-' + k).style.display = blk.kind === k ? 'block' : 'none';
  });
  const d = blk.data;
  if (blk.kind === 'txt') {
    $('#es-body').value = d.body || '';
    renderImgChips(d.imgs = d.imgs || []);
    restoreDraft();
  } else if (blk.kind === 'pf') {
    $('#ep-nm').value = d.nm || '';
    $('#ep-acc').value = d.acc || '';
    $('#ep-ds').value = d.ds || '';
    $('#ep-pos').value = d.pos || 'left';
    $('#ep-shape').value = d.shape || 'circle';
    $('#ep-size').value = parseInt(d.size) || 64;
    $('#ep-sizev').textContent = (parseInt(d.size) || 64) + 'px';
    if (gid('ep-nobox')) gid('ep-nobox').checked = !!d.nobox;
  } else if (blk.kind === 'gal') {
    $('#eg-layout').value = d.layout || '3';
    renderGalChips();
  } else if (blk.kind === 'mu') {
    $('#em-title').value = d.title || '';
    $('#em-artist').value = d.artist || '';
    $('#em-url').value = d.url || '';
  } else if (blk.kind === 'stk') {
    renderStkChips();
  } else if (blk.kind === 'bn') {
    $('#eb-hin').value = '';
    renderBnChips();
  } else if (blk.kind === 'lnk') {
    renderLnkChips();
  } else if (blk.kind === 'quo') {
    $('#eq-text').value = blk.data.text || '';
    $('#eq-by').value = blk.data.by || '';
  } else if (blk.kind === 'dd') {
    $('#ed-label').value = blk.data.label || '';
    $('#ed-date').value = blk.data.date || '';
    if (gid('ed-one')) gid('ed-one').checked = !!blk.data.one;
  } else if (blk.kind === 'chat') {
    chatMigrate(d);
    $('#ech-st').value = d.style || 'msg';
    $('#ech-max').value = +d.maxH > 0 ? +d.maxH : '';
    gid('ech-imgs').checked = d.imgs !== false;
    gid('ech-anim').checked = !!d.anim;
    gid('ech-loop').checked = !!d.loop;
    gid('ech-fold').checked = !!d.fold;
    $('#ech-cl').value = d.cL || '#2a2f3a';
    $('#ech-cr').value = d.cR || '#7c9cff';
    $('#ech-tl').value = d.tL || '#ffffff';
    $('#ech-tr').value = d.tR || '#ffffff';
    $('#ech-ff').value = d.font || '';
    $('#ech-fs').value = d.fs || 12.5;
    gid('ech-fsv').textContent = (d.fs || 12.5) + 'px';
    renderChatEd();
  } else if (blk.kind === 'qa') {
    $('#eqa-body').value = d.body || '';
  } else if (blk.kind === 'tl') {
    tlMigrate(d);
    $('#etl-title').value = d.title || '';
    $('#etl-st').value = d.style || '';
    $('#etl-dot').value = d.dot || '';
    $('#etl-max').value = +d.maxH > 0 ? +d.maxH : '';
    gid('etl-anim').checked = !!d.anim;
    gid('etl-loop').checked = !!d.loop;
    gid('etl-fold').checked = !!d.fold;
    renderTlEd();
  } else if (blk.kind === 'htm') {
    $('#eh-body').value = d.body || '';
  }
  $('#bs-card').value = blk.style?.card || '';
  $('#bs-corner').value = blk.style?.corner || '';
  $('#bs-op').value = blk.style?.op || '';
}

function saveBlockFields() {
  if (!editingBlk) return;
  if (gid('ble-label')) editingBlk.label = gid('ble-label').value.trim().slice(0, 30);
  const d = editingBlk.data;
  if (editingBlk.kind === 'txt') {
    d.body = $('#es-body').value;
  } else if (editingBlk.kind === 'pf') {
    d.nm = $('#ep-nm').value.trim();
    d.acc = $('#ep-acc').value.trim();
    d.ds = $('#ep-ds').value;
    d.pos = $('#ep-pos').value;
    d.shape = $('#ep-shape').value;
    d.size = parseInt($('#ep-size').value) || 64;
    d.nobox = gid('ep-nobox') && gid('ep-nobox').checked ? 1 : 0;
  } else if (editingBlk.kind === 'gal') {
    d.layout = $('#eg-layout').value;
  } else if (editingBlk.kind === 'mu') {
    d.title = $('#em-title').value.trim();
    d.artist = $('#em-artist').value.trim();
    d.url = $('#em-url').value.trim();
  } else if (editingBlk.kind === 'quo') {
    d.text = $('#eq-text').value;
    d.by = $('#eq-by').value.trim();
  } else if (editingBlk.kind === 'dd') {
    d.label = $('#ed-label').value.trim();
    d.date = $('#ed-date').value.trim();
    d.one = gid('ed-one') && gid('ed-one').checked ? 1 : 0;
  } else if (editingBlk.kind === 'qa') {
    d.body = $('#eqa-body').value;
  } else if (editingBlk.kind === 'htm') {
    d.body = $('#eh-body').value;
  }
  editingBlk.style = {
    card: $('#bs-card').value,
    corner: $('#bs-corner').value,
    op: $('#bs-op').value
  };
}

function closeBlockEdit() {
  saveBlockFields();
  if (editingBlk && editingBlk.kind === 'txt') localStorage.removeItem('li_draft_' + st.handle);
  editingBlk = null;
  $('#bl-edit').style.display = 'none';
  $('#es-cellrow').style.display = 'block';
  renderBlockList();
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
  const imgs = editingBlk?.data.imgs || [];
  box.innerHTML = imgs.map((it, i) =>
    '<div class="imgchip"><img src="' + esc(it.u) + '" alt="">' +
    '<i data-gmv="' + i + ',-1" style="color:var(--dim);">◀</i><i data-gmv="' + i + ',1" style="color:var(--dim);">▶</i>' +
    '<i data-adj="' + i + '" style="color:var(--pri);">🔍</i><i data-grm="' + i + '">✕</i></div>'
  ).join('');
  box.querySelectorAll('[data-gmv]').forEach((x) => {
    x.onclick = () => {
      const [i, dd] = x.dataset.gmv.split(',').map(Number);
      const j = i + dd;
      if (j < 0 || j >= imgs.length) return;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      renderGalChips();
    };
  });
  box.querySelectorAll('[data-adj]').forEach((x) => {
    x.onclick = () => openAdjust(imgs[parseInt(x.dataset.adj)], () => setDirty());
  });
  box.querySelectorAll('[data-grm]').forEach((x) => {
    x.onclick = () => { imgs.splice(parseInt(x.dataset.grm), 1); renderGalChips(); };
  });
}

function renderStkChips() {
  const box = $('#esk-imgs');
  const items = editingBlk?.data.items || [];
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

function renderChatEd() {
  const box = gid('ech-list');
  if (!box) return;
  const lines = editingBlk?.data.lines || (editingBlk.data.lines = []);
  box.innerHTML = lines.map((l, i) =>
    '<div class="chl"><div class="chl-h">' +
    '<span class="chl-sd"><button data-csl="' + i + '" class="' + (l.side !== 'r' ? 'on' : '') + '">◀ 왼쪽</button>' +
    '<button data-csr="' + i + '" class="' + (l.side === 'r' ? 'on' : '') + '">오른쪽 ▶</button></span>' +
    '<input class="chl-nm" data-cnm="' + i + '" placeholder="이름 (선택)" value="' + esc(l.name || '') + '">' +
    (l.img ? '<img class="chl-pv" src="' + esc(l.img) + '" alt="">' : '') +
    '<button class="mini-btn" data-cimg="' + i + '" style="font-size:10px;">' + (l.img ? '프사 교체' : '＋프사') + '</button>' +
    (l.img ? '<button class="mini-btn" data-cimx="' + i + '" style="font-size:10px;">프사✕</button>' : '') +
    '<i data-crm="' + i + '" style="cursor:pointer;color:var(--mute);margin-left:auto;">✕</i>' +
    '</div><textarea data-ctx="' + i + '" placeholder="대사">' + esc(l.text || '') + '</textarea></div>'
  ).join('');
  box.querySelectorAll('[data-csl]').forEach((x) => { x.onclick = () => { lines[+x.dataset.csl].side = 'l'; renderChatEd(); }; });
  box.querySelectorAll('[data-csr]').forEach((x) => { x.onclick = () => { lines[+x.dataset.csr].side = 'r'; renderChatEd(); }; });
  box.querySelectorAll('[data-cnm]').forEach((x) => { x.oninput = () => { lines[+x.dataset.cnm].name = x.value; }; });
  box.querySelectorAll('[data-ctx]').forEach((x) => { x.oninput = () => { lines[+x.dataset.ctx].text = x.value; }; });
  box.querySelectorAll('[data-crm]').forEach((x) => { x.onclick = () => { lines.splice(+x.dataset.crm, 1); renderChatEd(); }; });
  box.querySelectorAll('[data-cimg]').forEach((x) => {
    x.onclick = () => uploadOne((url) => { lines[+x.dataset.cimg].img = url; renderChatEd(); });
  });
  box.querySelectorAll('[data-cimx]').forEach((x) => { x.onclick = () => { delete lines[+x.dataset.cimx].img; renderChatEd(); }; });
}
function renderTlEd() {
  const box = gid('etl-list');
  if (!box) return;
  const items = editingBlk?.data.items || (editingBlk.data.items = []);
  box.innerHTML = items.map((it, i) =>
    '<div class="tl-ed"><div class="tlrow">' +
    '<input data-td="' + i + '" placeholder="날짜 (자유 형식)" value="' + esc(it.d || '') + '">' +
    '<input data-ttt="' + i + '" placeholder="제목 (선택)" value="' + esc(it.tt || '') + '" style="flex:1.4;">' +
    '<i data-trm="' + i + '" style="cursor:pointer;color:var(--mute);align-self:center;">✕</i></div>' +
    '<textarea data-tt="' + i + '" placeholder="내용 — 줄바꿈 그대로 표시돼요 (선택)">' + esc(it.t || '') + '</textarea></div>'
  ).join('');
  box.querySelectorAll('[data-td]').forEach((x) => { x.oninput = () => { items[+x.dataset.td].d = x.value; }; });
  box.querySelectorAll('[data-ttt]').forEach((x) => { x.oninput = () => { items[+x.dataset.ttt].tt = x.value; }; });
  box.querySelectorAll('[data-tt]').forEach((x) => { x.oninput = () => { items[+x.dataset.tt].t = x.value; }; });
  box.querySelectorAll('[data-trm]').forEach((x) => { x.onclick = () => { items.splice(+x.dataset.trm, 1); renderTlEd(); }; });
}
function renderLnkChips() {
  const box = $('#el-list');
  if (!box) return;
  const items = editingBlk?.data.items || [];
  box.innerHTML = items.map((it, i) =>
    '<div class="imgchip" style="width:100%;box-sizing:border-box;">' +
    '<input type="text" data-lt="' + i + '" value="' + esc(it.t || '') + '" placeholder="라벨" style="flex:1;min-width:80px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--tx);font-size:11px;padding:5px 7px;font-family:inherit;">' +
    '<input type="text" data-lu="' + i + '" value="' + esc(it.u || '') + '" placeholder="https://…" style="flex:1.4;min-width:110px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--tx);font-size:11px;padding:5px 7px;font-family:inherit;">' +
    '<i data-lrm="' + i + '">✕</i></div>'
  ).join('');
  box.querySelectorAll('[data-lrm]').forEach((x) => { x.onclick = () => { items.splice(parseInt(x.dataset.lrm), 1); renderLnkChips(); }; });
  box.querySelectorAll('[data-lt]').forEach((x) => { x.oninput = () => { items[parseInt(x.dataset.lt)].t = x.value; }; });
  box.querySelectorAll('[data-lu]').forEach((x) => { x.oninput = () => { items[parseInt(x.dataset.lu)].u = x.value.trim(); }; });
}

function renderBnChips() {
  const box = $('#eb-imgs');
  if (!box) return;
  const items = editingBlk?.data.items || [];
  const mv = (i) => '<i data-bnmv="' + i + ',-1" style="cursor:pointer;font-style:normal;color:var(--mute);">◀</i><i data-bnmv="' + i + ',1" style="cursor:pointer;font-style:normal;color:var(--mute);">▶</i>';
  box.innerHTML = items.map((it, i) => {
    if (it.h) return '<div class="imgchip">' + mv(i) + '<b style="color:var(--pri);">@' + esc(it.h) + '</b><i data-bnrm="' + i + '">✕</i></div>';
    return '<div class="imgchip">' + mv(i) + '<img src="' + esc(it.img) + '" alt="">' +
      '<input type="text" data-bnurl="' + i + '" value="' + esc(it.url || '') + '" placeholder="연결 URL" style="width:120px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--tx);font-size:10.5px;padding:4px 6px;font-family:inherit;">' +
      '<i data-bnrm="' + i + '">✕</i></div>';
  }).join('');
  box.querySelectorAll('[data-bnrm]').forEach((x) => {
    x.onclick = () => { items.splice(parseInt(x.dataset.bnrm), 1); renderBnChips(); };
  });
  box.querySelectorAll('[data-bnmv]').forEach((x) => {
    x.onclick = () => {
      const [i, d] = x.dataset.bnmv.split(',').map(Number);
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      renderBnChips();
    };
  });
  box.querySelectorAll('[data-bnurl]').forEach((x) => {
    x.oninput = () => { items[parseInt(x.dataset.bnurl)].url = x.value.trim(); };
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

// 임시저장 (글 블록)
let draftTm = null;
function saveDraft() {
  clearTimeout(draftTm);
  draftTm = setTimeout(() => {
    if (!editingBlk || editingBlk.kind !== 'txt') return;
    const body = $('#es-body').value;
    if (!body.trim()) { localStorage.removeItem('li_draft_' + st.handle); return; }
    try {
      localStorage.setItem('li_draft_' + st.handle, JSON.stringify({ blkId: editingBlk.id, body, at: Date.now() }));
    } catch (e) { /* 무시 */ }
  }, 1200);
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem('li_draft_' + st.handle);
    if (!raw || !editingBlk) return;
    const d = JSON.parse(raw);
    if (d.blkId !== editingBlk.id || !d.body || d.body === $('#es-body').value) return;
    const min = Math.max(1, Math.round((Date.now() - d.at) / 60000));
    if (confirm(min + '분 전에 쓰다 만 내용이 있어요. 이어서 쓸까요?\n[취소]하면 지워져요.')) {
      $('#es-body').value = d.body;
    } else {
      localStorage.removeItem('li_draft_' + st.handle);
    }
  } catch (e) { /* 무시 */ }
}

let editorBound = false;
function bindEditor() {
  if (editorBound) return;
  editorBound = true;
  const ta = () => $('#es-body');
  // 블록 추가
  document.querySelectorAll('#bl-add [data-add]').forEach((b) => {
    b.onclick = () => {
      const kind = b.dataset.add;
      const blk = { id: uid(), kind, data: newBlockData(kind), style: {} };
      work.blocks.push(blk);
      renderBlockList();
      openBlockEdit(blk);
    };
  });
  $('#ble-back').onclick = closeBlockEdit;
  $('#ble-ok').onclick = closeBlockEdit;
  // 서식
  $('#fmt-b').onclick = () => wrapSel(ta(), '**', '**');
  $('#fmt-hl').onclick = () => wrapSel(ta(), '==', '==');
  $('#fmt-u').onclick = () => wrapSel(ta(), '__', '__');
  $('#fmt-s').onclick = () => wrapSel(ta(), '~~', '~~');
  $('#fmt-hr').onclick = () => insertAt(ta(), '\n\n---\n\n');
  $('#es-fold').onclick = () => insertAt(ta(), '\n{접기:제목}\n내용\n{접기끝}\n');
  $('#es-photo').onclick = () => {
    if (!editingBlk) return;
    uploadMulti((urls) => {
      const imgs = editingBlk.data.imgs = editingBlk.data.imgs || [];
      const startN = imgs.length;
      urls.forEach((u) => imgs.push(u));
      const tags = urls.map((_, k) => '[사진' + (startN + k + 1) + ']').join(' ');
      insertAt(ta(), '\n' + tags + '\n');
      renderImgChips(imgs);
    });
  };
  $('#es-body').addEventListener('input', saveDraft);
  $('#es-htmlphoto').onclick = () => uploadOne((url) => insertAt($('#es-html'), '<img src="' + url + '">'));
  if (gid('es-htmlfile')) gid('es-htmlfile').onclick = () => gid('es-htmlfile-input') && gid('es-htmlfile-input').click();
  if (gid('es-timg-up')) gid('es-timg-up').onclick = () => uploadOne((url) => { if (work) { work.timg = url; if (gid('es-timg-chip')) gid('es-timg-chip').textContent = '이미지 있음 ✓'; } });
  if (gid('es-timg-del')) gid('es-timg-del').onclick = () => { if (work) { work.timg = ''; if (gid('es-timg-chip')) gid('es-timg-chip').textContent = '없음'; } };
  if (gid('es-htmlfile-input')) gid('es-htmlfile-input').onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const cur = $('#es-html').value.trim();
      if (cur && cur !== '불러오는 중…' && !confirm('지금 있는 코드를 이 파일 내용으로 바꿀까요?')) return;
      $('#es-html').value = String(rd.result || '');
      toast('파일을 불러왔어요 — 확인 후 ✓ 저장!');
    };
    rd.onerror = () => toast('파일을 읽지 못했어요');
    rd.readAsText(f);
  };

  // 붙여넣기·끌어넣기
  const grabFiles = (list) => Array.from(list || []).filter((f) => f.type && f.type.startsWith('image/'));
  const addPasted = async (files, isHtml) => {
    if (!files.length) return;
    toast('업로드 중… (' + files.length + '장)');
    try {
      const urls = [];
      for (const f of files) { const u = await uploadFile(f); if (u) urls.push(u); }
      if (!urls.length) return;
      if (isHtml) {
        urls.forEach((u) => insertAt($('#es-html'), '<img src="' + u + '">'));
      } else if (editingBlk && editingBlk.kind === 'txt') {
        const imgs = editingBlk.data.imgs = editingBlk.data.imgs || [];
        const startN = imgs.length;
        urls.forEach((u) => imgs.push(u));
        const tags = urls.map((_, k) => '[사진' + (startN + k + 1) + ']').join(' ');
        insertAt($('#es-body'), '\n' + tags + '\n');
        renderImgChips(imgs);
      }
      toast('업로드 완료');
      saveDraft();
    } catch (e) { console.log('[LUVINFO] paste err', e); toast('업로드 실패'); }
  };
  [['#es-body', false], ['#es-html', true]].forEach(([sel, isHtml]) => {
    const el = $(sel);
    el.addEventListener('paste', (e) => {
      const files = grabFiles(e.clipboardData?.files);
      if (files.length) { e.preventDefault(); addPasted(files, isHtml); }
    });
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      const files = grabFiles(e.dataTransfer?.files);
      if (files.length) { e.preventDefault(); addPasted(files, isHtml); }
    });
  });

  // 프로필
  $('#ep-size').oninput = (e) => { $('#ep-sizev').textContent = e.target.value + 'px'; };
  $('#ep-up').onclick = () => {
    if (!editingBlk) return;
    uploadOne((url) => {
      const d = editingBlk.data;
      d.img = url; d.z = 100; d.x = 50; d.y = 50;
      toast('업로드 완료 — 🔍 사진 조정으로 위치를 잡아보세요');
    });
  };
  $('#ep-adj').onclick = () => {
    if (!editingBlk?.data.img) { toast('먼저 사진을 업로드해 주세요'); return; }
    openAdjust(editingBlk.data, null);
  };
  // 갤러리
  $('#eg-up').onclick = () => {
    if (!editingBlk) return;
    uploadMulti((urls) => {
      const d = editingBlk.data;
      d.imgs = (d.imgs || []).concat(urls.map((u) => ({ u, z: 100, x: 50, y: 50 })));
      renderGalChips();
    });
  };
  // 스티커
  $('#esk-up').onclick = () => {
    if (!editingBlk) return;
    uploadMulti((urls) => {
      const d = editingBlk.data;
      d.items = (d.items || []).concat(urls.map((u) => ({ u, size: 64, rot: 0 })));
      renderStkChips();
    });
  };
  // 배너
  if (gid('el-add')) gid('el-add').onclick = () => {
    if (!editingBlk || editingBlk.kind !== 'lnk') return;
    (editingBlk.data.items = editingBlk.data.items || []).push({ t: '', u: '' });
    renderLnkChips();
  };
  if (gid('ech-add')) gid('ech-add').onclick = () => {
    if (!editingBlk || editingBlk.kind !== 'chat') return;
    const ls = (editingBlk.data.lines = editingBlk.data.lines || []);
    ls.push({ side: ls.length && ls[ls.length - 1].side === 'l' ? 'r' : 'l', name: '', text: '' });
    renderChatEd();
  };
  if (gid('etl-add')) gid('etl-add').onclick = () => {
    if (!editingBlk || editingBlk.kind !== 'tl') return;
    (editingBlk.data.items = editingBlk.data.items || []).push({ d: '', tt: '', t: '' });
    renderTlEd();
  };
  const chOpt = (id, fn) => { if (gid(id)) gid(id).oninput = gid(id).onchange = (e) => { if (editingBlk && editingBlk.kind === 'chat') fn(editingBlk.data, e.target); }; };
  chOpt('ech-st', (d, t) => { d.style = t.value; });
  chOpt('ech-max', (d, t) => { d.maxH = parseInt(t.value) || 0; });
  chOpt('ech-imgs', (d, t) => { d.imgs = t.checked; });
  chOpt('ech-anim', (d, t) => { d.anim = t.checked ? 1 : 0; });
  chOpt('ech-loop', (d, t) => { d.loop = t.checked ? 1 : 0; });
  chOpt('ech-fold', (d, t) => { d.fold = t.checked ? 1 : 0; });
  chOpt('ech-cl', (d, t) => { d.cL = t.value; });
  chOpt('ech-cr', (d, t) => { d.cR = t.value; });
  chOpt('ech-tl', (d, t) => { d.tL = t.value; });
  chOpt('ech-tr', (d, t) => { d.tR = t.value; });
  chOpt('ech-ff', (d, t) => { d.font = t.value; });
  chOpt('ech-fs', (d, t) => { d.fs = parseFloat(t.value); if (gid('ech-fsv')) gid('ech-fsv').textContent = t.value + 'px'; });
  if (gid('ech-cx')) gid('ech-cx').onclick = () => {
    if (!editingBlk || editingBlk.kind !== 'chat') return;
    delete editingBlk.data.cL; delete editingBlk.data.cR;
    $('#ech-cl').value = '#2a2f3a'; $('#ech-cr').value = '#7c9cff';
    toast('말풍선을 테마색으로');
  };
  if (gid('ech-tx')) gid('ech-tx').onclick = () => {
    if (!editingBlk || editingBlk.kind !== 'chat') return;
    delete editingBlk.data.tL; delete editingBlk.data.tR;
    $('#ech-tl').value = '#ffffff'; $('#ech-tr').value = '#ffffff';
    toast('글씨색 자동으로');
  };
  const tlOpt = (id, fn) => { if (gid(id)) gid(id).oninput = gid(id).onchange = (e) => { if (editingBlk && editingBlk.kind === 'tl') fn(editingBlk.data, e.target); }; };
  tlOpt('etl-title', (d, t) => { d.title = t.value.trim(); });
  tlOpt('etl-st', (d, t) => { d.style = t.value; });
  tlOpt('etl-dot', (d, t) => { d.dot = t.value.trim(); });
  tlOpt('etl-max', (d, t) => { d.maxH = parseInt(t.value) || 0; });
  tlOpt('etl-anim', (d, t) => { d.anim = t.checked ? 1 : 0; });
  tlOpt('etl-loop', (d, t) => { d.loop = t.checked ? 1 : 0; });
  tlOpt('etl-fold', (d, t) => { d.fold = t.checked ? 1 : 0; });
  $('#eb-addh').onclick = async () => {
    if (!editingBlk) return;
    const inp = $('#eb-hin');
    const h = (inp.value || '').trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9]{2,20}$/.test(h)) { toast('핸들 형식이 아니에요 (영문 소문자·숫자)'); return; }
    if (h === st.handle) { toast('내 핸들은 추가할 수 없어요'); return; }
    const ex = await getDoc(doc(db, 'tsites', h));
    if (!ex.exists()) { toast('@' + h + ' — 존재하지 않는 러브인포예요'); return; }
    editingBlk.data.items.push({ h });
    delete bannerCache[h];
    inp.value = '';
    renderBnChips();
  };
  $('#eb-up').onclick = () => {
    if (!editingBlk) return;
    uploadMulti((urls) => {
      const d = editingBlk.data;
      d.items = (d.items || []).concat(urls.map((u) => ({ img: u, url: '' })));
      renderBnChips();
    });
  };

  $('#es-ok').onclick = confirmChapterEdit;
}

function confirmChapterEdit() {
  if (editingBlk) saveBlockFields();
  work.title = $('#es-name').value.trim();
  work.pw = $('#es-pw').value.trim();
  if (gid('es-hidden')) work.hidden = gid('es-hidden').checked;
    if (gid('es-timgpos')) work.timgPos = gid('es-timgpos').value;
  if (work.type === 'html') {
    work.body = $('#es-html').value;
    if (gid('es-showhead')) work.showHead = gid('es-showhead').checked;
    if (gid('es-timgpos')) work.timgPos = gid('es-timgpos').value;
  } else {
    work.bstyle = {
      card: $('#ebs-card').value,
      corner: $('#ebs-corner').value,
      op: $('#ebs-op').value
    };
    work.wrap = {
      on: $('#ew-on').value === '1',
      corner: $('#ew-corner').value,
      op: $('#ew-op').value
    };
  }
  if (isNewCh) {
    st.site.chapters = st.site.chapters || [];
    st.site.chapters.push(work);
    st.cur = st.site.chapters.length - 1;
  }
  localStorage.removeItem('li_draft_' + st.handle);
  setDirty();
  closeEditSheet();
  renderChapter();
  setTimeout(() => { if (st.dirty) toast('화면에 반영했어요 — 하단 ✓ 저장을 눌러야 서버에 저장돼요!'); }, 400);
}

function closeEditSheet() {
  editingBlk = null;
  $('#edit-bg').classList.remove('on');
  $('#edit-sheet').classList.remove('on');
}

// ── 꾸미기 시트 ──
function openDeco() {
  const t = st.site.theme;
  const p = PRESETS[t.preset || 'white'];
  $('#dc-preset').value = t.preset || 'white';
  $('#dc-bg').value = t.bg || p.bg;
  $('#dc-tx').value = t.tx || p.tx;
  $('#dc-pri').value = t.pri || p.pri;
  $('#dc-font').value = t.font || "'Pretendard'";
  $('#dc-nav').value = t.nav || 'dot';
  $('#dc-num').value = t.num || 'on';
  if (gid('dc-chtitle')) gid('dc-chtitle').value = t.chtitle || '';
  if (gid('dc-luvlog')) gid('dc-luvlog').value = st.site.luvlog || '';
  if (gid('dc-foottxt')) gid('dc-foottxt').value = st.site.footTxt || '';
  if (gid('dc-priv')) gid('dc-priv').value = st.site.priv ? '1' : '';
  const ff = st.site.foot || {};
  [['df-heart', 'heart'], ['df-copy', 'copy'], ['df-guide', 'guide'], ['df-inq', 'inq'], ['df-date', 'date'], ['df-cnt', 'cnt']].forEach(([id, key]) => {
    if (gid(id)) gid(id).checked = key === 'cnt' ? ff[key] === true : ff[key] !== false;
  });
  $('#dc-corner').value = t.corner || '';
  $('#dc-cardop').value = t.cardop || '';
  const _bd = parseInt(t.bgDim), _bdv = Number.isFinite(_bd) ? _bd : 84;
  $('#dc-bgdim').value = _bdv;
  $('#dc-bgdimv').textContent = _bdv + '%';
  $('#dc-valign').value = t.valign || '';
  $('#dc-cardc').value = t.cardC || CARDC[t.preset || 'white'] || '#FFFFFF';
  const hd = st.site.head;
  if (gid('dc-hdrule')) gid('dc-hdrule').onchange = () => {
    st.site.head = st.site.head || {};
    st.site.head.rule = gid('dc-hdrule').checked;
    setDirty(); applyTheme();
  };
  if (gid('dc-hh')) { gid('dc-hh').value = parseInt(hd.h) || 200; gid('dc-hhv').textContent = (parseInt(hd.h) || 200) + 'px'; }
  if (gid('dc-hdrule')) gid('dc-hdrule').checked = (st.site.head || {}).rule !== false;
  if (gid('dc-hy')) gid('dc-hy').value = parseInt(hd.py ?? 50);
  if (gid('dc-hz')) { gid('dc-hz').value = Math.max(100, parseInt(hd.sc) || 100); if (gid('dc-hzv')) gid('dc-hzv').textContent = (Math.max(100, parseInt(hd.sc) || 100)) + '%'; }
  $('#dc-head').value = hd.mode || 'text';
  $('#dc-over').value = hd.over || '';
  $('#dc-title').value = hd.title || '';
  $('#dc-sub').value = hd.sub || '';
  const g = st.site.gate || {};
  $('#dc-gate').value = g.on ? 'on' : 'off';
  $('#dc-gate-opts').style.display = g.on ? 'block' : 'none';
  $('#dc-gate-msg').value = g.msg || '';
  $('#dc-gate-pw').value = isHash(g.pw) ? '' : (g.pw || '');
  $('#dc-gate-pw').placeholder = isHash(g.pw) ? '비밀번호 설정됨 — 바꾸려면 입력, 없애려면 한 글자 쓰고 지우기' : '비밀번호 (비우면 버튼만)';
  $('#dc-gate-style').value = g.style === 'full' ? 'full' : 'card';
  $('#dc-gate-over').value = g.over || '';
  $('#dc-gate-btn').value = g.btn || '';
  $('#dc-gate-btnc').value = g.btnc || '#C9A96E';
  $('#dc-gate-btnt').value = g.btnt || '#111111';
  $('#dc-gate-pwc').value = g.pwc || '#EAEAEA';
  $('#dc-gate-grad').checked = g.grad !== false;
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
  $('#dc-preset').onchange = (e) => {
    const p = e.target.value;
    if (p === (t().preset || 'white')) return;
    if (!confirm('프리셋을 적용하면 현재 색 설정을 프리셋 기본값으로 덮어씁니다. 적용할까요?')) {
      e.target.value = t().preset || 'white';
      return;
    }
    t().preset = p;
    t().bg = ''; t().tx = ''; t().pri = ''; t().cardC = '';
    setDirty();
    applyTheme();
    renderChapter();
    openDeco();
  };
  $('#dc-bg').oninput = (e) => { t().bg = e.target.value; setDirty(); applyTheme(); };
  $('#dc-tx').oninput = (e) => { t().tx = e.target.value; setDirty(); applyTheme(); };
  $('#dc-pri').oninput = (e) => { t().pri = e.target.value; setDirty(); applyTheme(); };
  $('#dc-font').onchange = (e) => { t().font = e.target.value; setDirty(); applyTheme(); };
  $('#dc-nav').onchange = (e) => { t().nav = e.target.value; setDirty(); renderPager(); };
  $('#dc-num').onchange = (e) => { t().num = e.target.value; setDirty(); renderChapter(); };
  if (gid('dc-chtitle')) gid('dc-chtitle').onchange = (e) => { t().chtitle = e.target.value; setDirty(); applyTheme(); };
  [['df-heart', 'heart'], ['df-copy', 'copy'], ['df-guide', 'guide'], ['df-inq', 'inq'], ['df-date', 'date'], ['df-cnt', 'cnt']].forEach(([id, key]) => {
    if (gid(id)) gid(id).onchange = (e) => {
      st.site.foot = st.site.foot || {};
      st.site.foot[key] = e.target.checked;
      setDirty(); renderFoot();
    };
  });
  if (gid('dc-priv')) gid('dc-priv').onchange = (e) => {
    st.site.priv = e.target.value === '1';
    setDirty();
    toast(st.site.priv ? '비공개로 설정 — ✓ 저장해야 적용돼요' : '공개로 설정 — ✓ 저장해야 적용돼요');
  };
  if (gid('dc-foottxt')) gid('dc-foottxt').oninput = (e) => {
    st.site.footTxt = e.target.value.slice(0, 200);
    setDirty(); renderFoot();
  };
  if (gid('dc-luvlog')) gid('dc-luvlog').oninput = (e) => {
    st.site.luvlog = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    setDirty(); renderFoot();
  };
  $('#dc-corner').onchange = (e) => { t().corner = e.target.value; setDirty(); applyTheme(); };
  $('#dc-cardop').onchange = (e) => { t().cardop = e.target.value; setDirty(); applyTheme(); };
  $('#dc-valign').onchange = (e) => { t().valign = e.target.value; setDirty(); applyTheme(); };
  $('#dc-cardc').oninput = (e) => { t().cardC = e.target.value; setDirty(); applyTheme(); };
  $('#dc-cardc-del').onclick = () => { t().cardC = ''; setDirty(); applyTheme(); $('#dc-cardc').value = CARDC[t().preset || 'white'] || '#FFFFFF'; toast('카드 색을 프리셋 기본으로'); };
  $('#dc-mybn-up').onclick = () => uploadOne((url) => { st.site.myBanner = url; setDirty(); toast('내 배너 설정 — 저장을 눌러 주세요'); });
  $('#dc-mybn-del').onclick = () => { st.site.myBanner = ''; setDirty(); toast('내 배너 제거'); };
  $('#dc-backup').onclick = () => {
    const data = JSON.stringify(st.site, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'luvinfo-' + st.handle + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#dc-restore').onclick = () => {
    const fi = $('#file-json');
    fi.value = '';
    fi.onchange = () => {
      const f = fi.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = JSON.parse(rd.result);
          if (!data.chapters) { toast('러브인포 백업 파일이 아니에요'); return; }
          if (!confirm('백업으로 복원하면 지금 내용을 덮어씁니다. 계속할까요?')) return;
          data.ownerUid = st.site.ownerUid;
          data.heart = st.site.heart || 0;
          st.site = data;
          setDirty();
          st.cur = 0;
          applyTheme();
          renderChapter();
          renderFoot();
          toast('복원했어요 — ✓ 저장을 눌러야 서버에 반영돼요');
        } catch (e) { console.log('[LUVINFO] restore err', e); toast('파일을 읽을 수 없어요'); }
      };
      rd.readAsText(f);
    };
    fi.click();
  };
  $('#dc-bgdim').oninput = (e) => { t().bgDim = parseInt(e.target.value); $('#dc-bgdimv').textContent = e.target.value + '%'; setDirty(); applyTheme(); };
  $('#dc-head').onchange = (e) => { st.site.head.mode = e.target.value; setDirty(); applyTheme(); };
  $('#dc-over').oninput = (e) => { st.site.head.over = e.target.value; setDirty(); applyTheme(); };
  $('#dc-title').oninput = (e) => { st.site.head.title = e.target.value; setDirty(); applyTheme(); };
  $('#dc-sub').oninput = (e) => { st.site.head.sub = e.target.value; setDirty(); applyTheme(); };
  $('#dc-himg-up').onclick = () => uploadOne((url) => {
    st.site.head.img = url;
    if ((st.site.head.mode || 'text') === 'text' || st.site.head.mode === 'none') {
      st.site.head.mode = 'both';
      $('#dc-head').value = 'both';
      toast('머리글 이미지 설정 — 구성을 "이미지 + 글"로 바꿨어요');
    } else {
      toast('머리글 이미지 설정');
    }
    setDirty();
    applyTheme();
  });
  $('#dc-himg-del').onclick = () => { st.site.head.img = ''; delete st.site.head.z; delete st.site.head.py; delete st.site.head.sc; setDirty(); applyTheme(); };
  if (gid('dc-lvimport')) gid('dc-lvimport').onclick = async () => {
    const lh = ($('#dc-lvh').value.trim() || st.handle || '').toLowerCase();
    if (!lh) { toast('러브로그 핸들을 입력해 주세요'); return; }
    toast('가져오는 중…');
    let d;
    try {
      const snap = await getDoc(doc(db, 'pages', lh));
      if (!snap.exists()) { toast('러브로그 @' + lh + ' 홈을 못 찾았어요'); return; }
      d = snap.data();
    } catch (e) { console.log('[LUVINFO] lvimport err', e); toast('가져오기 실패'); return; }
    const t = st.site.theme = st.site.theme || {};
    const got = [];
    const pick = (...keys) => { for (const k of keys) { if (d[k] !== undefined && d[k] !== '' && d[k] !== null) return d[k]; } return undefined; };
    const bg = pick('color', 'bg', 'bgC');
    if (bg) { t.bg = bg; got.push('배경색'); }
    const pri = pick('pri', 'priC', 'point');
    if (pri) { t.pri = pri; got.push('포인트색'); }
    if (d.light !== undefined) { t.tx = d.light ? '#24242C' : '#EDEDF2'; got.push('글자색(' + (d.light ? '밝음' : '어둠') + ' 기준)'); }
    const cardC = pick('cardC', 'cardColor');
    if (cardC) { t.cardC = cardC; got.push('카드 색'); }
    const corner = pick('corner');
    if (corner === 'soft' || corner === 'sharp') { t.corner = corner === 'soft' ? 'soft' : 'sharp'; got.push('모서리'); }
    const font = pick('font', 'fontFam');
    if (font) {
      const fv = String(font);
      // 러브로그는 키워드('sans' 등), 러브인포는 CSS 패밀리 — 키워드 맵 우선, 실패 시 문자열 대조
      const FONT_MAP = {
        sans: "'Pretendard'", pretendard: "'Pretendard'",
        serif: "'Noto Serif KR'", myeongjo: "'Nanum Myeongjo'", nanummj: "'Nanum Myeongjo'",
        gowun: "'Gowun Dodum'", gowundodum: "'Gowun Dodum'", gowunbatang: "'Gowun Batang'",
        plex: "'IBM Plex Sans KR'", ibmplex: "'IBM Plex Sans KR'", gaegu: "'Gaegu'"
      };
      const opts = Array.from(document.querySelectorAll('#dc-font option')).map((o) => o.value);
      const mapped = FONT_MAP[fv.toLowerCase()];
      if (mapped && opts.includes(mapped)) { t.font = mapped; got.push('폰트'); }
      else {
        const opt = opts.find((v) => fv.includes(v.replace(/'/g, '')) || v.includes(fv.replace(/'/g, '')));
        if (opt) { t.font = opt; got.push('폰트'); }
      }
    }
    const hd = st.site.head = st.site.head || {};
    const himg = pick('headImg', 'head');
    const heads = Array.isArray(d.heads) ? d.heads.filter(Boolean) : [];
    const img = himg || heads[0];
    if (img && typeof img === 'string') { hd.img = img; delete hd.z; delete hd.py; delete hd.sc; if ((hd.mode || 'text') === 'text' || hd.mode === 'none') hd.mode = 'both'; got.push('머리글 이미지'); }
    const title = pick('title', 'name');
    if (title) { hd.title = String(title); got.push('제목'); }
    const over = [pick('overSym'), pick('overTxt')].filter(Boolean).join(' ');
    if (over) { hd.over = over; got.push('머리글 라벨'); }
    const sub = pick('sub', 'subtitle', 'desc');
    if (sub && typeof sub === 'string') { hd.sub = sub; got.push('부제'); }
    const fav = pick('fav', 'favicon');
    if (fav && typeof fav === 'string') { st.site.favicon = fav; got.push('파비콘'); }
    const bgImg = pick('bgImg');
    if (bgImg && typeof bgImg === 'string') {
      t.bgImg = bgImg;
      const bd = parseInt(pick('bgDim'));
      if (!isNaN(bd)) t.bgDim = Math.min(96, Math.max(0, bd));
      got.push('배경 이미지');
    }
    const gImg = pick('enterImg');
    const gMsg = pick('enterText');
    if (gImg || gMsg) {
      st.site.gate = st.site.gate || { on: false, msg: '', pw: '', img: '' };
      if (gImg) st.site.gate.img = String(gImg);
      if (gMsg) st.site.gate.msg = String(gMsg);
      // 비밀번호는 가져오지 않음 — 러브로그는 암호화 저장이라 형식이 달라요
      got.push('대문 이미지·문구 (비밀번호는 러브인포에서 새로 설정해 주세요)');
    }
    if (!got.length) { toast('가져올 수 있는 설정을 못 찾았어요 — 러브로그 홈 구조가 예상과 달라요'); return; }
    setDirty();
    applyTheme();
    renderChapter();
    openDeco();
    toast('가져왔어요: ' + got.join(' · ') + ' — 마음에 들면 ✓ 저장!');
  };
  if (gid('dc-hy')) gid('dc-hy').oninput = (e) => {
    st.site.head.py = parseInt(e.target.value);
    setDirty(); applyTheme();
  };
  if (gid('dc-hz')) gid('dc-hz').oninput = (e) => {
    st.site.head.sc = parseInt(e.target.value);
    if (gid('dc-hzv')) gid('dc-hzv').textContent = e.target.value + '%';
    setDirty(); applyTheme();
  };
  if (gid('dc-hh')) gid('dc-hh').oninput = (e) => {
    st.site.head.h = parseInt(e.target.value) || 200;
    if (gid('dc-hhv')) gid('dc-hhv').textContent = st.site.head.h + 'px';
    setDirty(); applyTheme();
  };
  if (gid('dc-fav-up')) gid('dc-fav-up').onclick = () => uploadOne((url) => { st.site.favicon = url; setDirty(); applyTheme(); toast('파비콘 적용!'); });
  if (gid('dc-fav-del')) gid('dc-fav-del').onclick = () => { st.site.favicon = ''; setDirty(); applyTheme(); };
  if (gid('dc-reset-home')) gid('dc-reset-home').onclick = async () => {
    const typed = prompt('홈을 처음 상태로 되돌리려면 핸들(' + st.handle + ')을 그대로 입력해 주세요.\n페이지·꾸미기·대문이 전부 사라지고 되돌릴 수 없어요. (핸들·계정·하트는 그대로)');
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== st.handle) { toast('핸들이 달라요 — 초기화 취소'); return; }
    try {
      const fresh = defaultSite(st.site.ownerUid || (st.user && st.user.uid), st.handle);
      fresh.heart = st.site.heart || 0;          // 받은 하트는 보존
      fresh.updated = Date.now();
      await setDoc(doc(db, 'tsites', st.handle), fresh);
      toast('홈을 처음 상태로 되돌렸어요 ✓');
      setTimeout(() => location.reload(), 900);
    } catch (e) { console.log('[LUVINFO] reset home err', e); toast('초기화 실패 — 잠시 후 다시 시도해 주세요'); }
  };
  if (gid('dc-del-home')) gid('dc-del-home').onclick = async () => {
    const typed = prompt('정말 삭제하려면 핸들(' + st.handle + ')을 그대로 입력해 주세요.\n페이지·사진·설정이 전부 사라지고 되돌릴 수 없어요.');
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== st.handle) { toast('핸들이 달라요 — 삭제 취소'); return; }
    try {
      await deleteDoc(doc(db, 'tsites', st.handle));
      await deleteDoc(doc(db, 'tusers', st.user.uid));
      toast('삭제했어요 — 안녕히!');
      setTimeout(() => { signOut(auth).finally(() => location.href = BASE); }, 900);
    } catch (e) { console.log('[LUVINFO] del home err', e); toast('삭제 실패'); }
  };
  $('#dc-bimg-up').onclick = () => uploadOne((url) => { st.site.theme.bgImg = url; setDirty(); applyTheme(); toast('배경 이미지 설정'); });
  $('#dc-bimg-del').onclick = () => { st.site.theme.bgImg = ''; setDirty(); applyTheme(); };
  $('#dc-gate').onchange = (e) => {
    st.site.gate = st.site.gate || {};
    st.site.gate.on = e.target.value === 'on';
    setDirty();
    $('#dc-gate-opts').style.display = st.site.gate.on ? 'block' : 'none';
  };
  const gset = (k, v) => { st.site.gate = st.site.gate || {}; st.site.gate[k] = v; setDirty(); };
  $('#dc-gate-msg').oninput = (e) => gset('msg', e.target.value);
  $('#dc-gate-pw').oninput = (e) => gset('pw', e.target.value);
  $('#dc-gate-style').onchange = (e) => gset('style', e.target.value);
  $('#dc-gate-over').oninput = (e) => gset('over', e.target.value);
  $('#dc-gate-btn').oninput = (e) => gset('btn', e.target.value.trim());
  // 모바일 일부 브라우저는 색 확정 시 change만 발화 — 양쪽 다 바인딩 (v71)
  $('#dc-gate-btnc').oninput = $('#dc-gate-btnc').onchange = (e) => gset('btnc', e.target.value);
  $('#dc-gate-btnt').oninput = $('#dc-gate-btnt').onchange = (e) => gset('btnt', e.target.value);
  $('#dc-gate-pwc').oninput = $('#dc-gate-pwc').onchange = (e) => gset('pwc', e.target.value);
  $('#dc-gate-cx').onclick = () => { gset('btnc', ''); st.site.gate.btnt = ''; st.site.gate.pwc = ''; $('#dc-gate-btnc').value = '#C9A96E'; $('#dc-gate-btnt').value = '#111111'; $('#dc-gate-pwc').value = '#EAEAEA'; toast('버튼·입력칸 기본색으로'); };
  $('#dc-gate-grad').onchange = (e) => gset('grad', e.target.checked);
  $('#dc-gate-pv').onclick = () => { closeDeco(); showGate(st.site.gate || {}, true); };
  const gateAdj = (pre) => {
    const g0 = st.site.gate = st.site.gate || {};
    if (!g0.img) { toast('먼저 대문 이미지를 올려 주세요'); return; }
    const t = { u: g0.img, z: g0[pre + 'z'] ?? g0.z, x: g0[pre + 'x'] ?? g0.x, y: g0[pre + 'y'] ?? g0.y };
    const ratio = pre
      ? (window.innerWidth <= 640 ? (window.innerWidth / window.innerHeight).toFixed(3) : '390 / 695')
      : (Math.max(window.innerWidth, 900) / Math.max(window.innerHeight, 500)).toFixed(3);
    openAdjust(t, () => { g0[pre + 'z'] = t.z; g0[pre + 'x'] = t.x; g0[pre + 'y'] = t.y; setDirty(); toast(pre ? '모바일 대문 사진 조정 저장 대기' : '대문 사진 조정 저장 대기'); }, ratio);
  };
  $('#dc-gadj').onclick = () => gateAdj('');
  $('#dc-gadj-m').onclick = () => gateAdj('m');
  $('#dc-gimg-up').onclick = () => uploadOne((url) => { st.site.gate.img = url; setDirty(); toast('대문 이미지 설정'); });
  $('#dc-gimg-del').onclick = () => { st.site.gate.img = ''; setDirty(); };
  $('#dc-css').oninput = (e) => { t().css = e.target.value; setDirty(); $('#usercss').textContent = e.target.value; };
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
async function offloadBigHtml() {
  for (const ch of st.site.chapters || []) {
    if (ch.type !== 'html') continue;
    const body = ch.body || '';
    if (body.length > 150000) {
      const path = 'tsites/' + st.handle + '/html_' + ch.id + '_' + Date.now() + '.html';
      const r = sref(storage, path);
      await uploadBytes(r, new Blob([body], { type: 'text/html; charset=utf-8' }));
      ch.bodyRef = await getDownloadURL(r);
      htmlCache[ch.id] = body;
      ch.body = '';
    } else if (ch.bodyRef && body) {
      ch.bodyRef = '';
      delete htmlCache[ch.id];
    }
  }
}

async function saveSite() {
  if (!st.mine) return;
  delete st.site._migrated;
  st.site.updated = Date.now();
  if (st.site.gate && st.site.gate.pw && !isHash(st.site.gate.pw)) st.site.gate.pw = await sha256(st.site.gate.pw);
  try { await offloadBigHtml(); }
  catch (e) {
    console.log('[LUVINFO] offload err', e);
    toast('큰 HTML 페이지 보관에 실패했어요 — 다시 시도해 주세요');
    return;
  }
  // undefined 필드는 Firestore가 거부하므로 저장 직전 전부 제거 (배열 속은 null로)
  const payload = JSON.parse(JSON.stringify(st.site));
  const size = new Blob([JSON.stringify(payload)]).size;
  if (size > 950000) {
    toast('용량 초과에 가까워요 (' + Math.round(size / 1024) + 'KB / 최대 약 1MB) — HTML 페이지을 줄여 주세요');
    if (size > 1000000) return;
  }
  try {
    await setDoc(doc(db, 'tsites', st.handle), payload);
    st.dirty = false;
    const sb = document.getElementById('ob-save');
    if (sb) sb.classList.remove('attn');
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
