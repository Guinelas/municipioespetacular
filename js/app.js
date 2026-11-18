'use strict';

/* DB */
const DB_KEY = 'municipioY_db_v1';
const SESSION_KEY = 'municipioY_session';

const seedData = {
  news: [
    { id: 1, title: 'Município lança programa de apoio à comunidade', summary: 'Nova iniciativa municipal reforça o apoio às associações e aos projetos locais.', date: '2026-10-12', category: 'Município' },
    { id: 2, title: 'Obras de requalificação avançam no centro', summary: 'Intervenção pretende melhorar os espaços públicos e a mobilidade pedonal.', date: '2026-10-08', category: 'Obras' },
    { id: 3, title: 'Biblioteca municipal recebe novas atividades', summary: 'Consulte a programação cultural e participe nas atividades para todas as idades.', date: '2026-10-02', category: 'Cultura' }
  ],
  events: [
    { id: 1, title: 'Feira de Outono', date: '2026-11-28', parish: 'Centro', category: 'Comunidade', description: 'Produtos locais, artesanato e atividades para toda a família.' },
    { id: 2, title: 'Concerto no Jardim', date: '2026-12-05', parish: 'Ribeira', category: 'Cultura', description: 'Uma noite de música e convívio ao ar livre.' },
    { id: 3, title: 'Caminhada pela Natureza', date: '2026-12-12', parish: 'Serra', category: 'Desporto', description: 'Percurso guiado para descobrir a paisagem local.' }
  ],
  calls: [
    { id: 1, title: 'Bolsa de Apoio ao Estudo 2026/27', description: 'Apoio a estudantes residentes no município.', deadline: '2026-12-20' },
    { id: 2, title: 'Programa de Apoio ao Associativismo', description: 'Candidaturas para projetos de associações locais.', deadline: '2027-01-15' }
  ],
  users: [{ id: 1, name: 'Administrador', email: 'admin@municipio.pt', password: 'admin123', role: 'admin' }],
  applications: [],
  proposals: []
};

const USER_ROLES = ['citizen', 'company', 'organizer'];
const APPLICATION_STATUSES = ['Recebida', 'Em análise', 'Aprovada', 'Rejeitada'];

/** localStorage pode falhar */
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function loadDB() {
  const fresh = structuredClone(seedData);
  const raw = storageGet(DB_KEY);
  if (!raw) { storageSet(DB_KEY, JSON.stringify(fresh)); return fresh; }
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') throw new Error('DB inválida');
    // Garante que todas as coleções existem (bases criadas por versões anteriores).
    for (const key of Object.keys(fresh)) {
      if (!Array.isArray(saved[key])) saved[key] = fresh[key];
    }
    delete saved.projects; delete saved.parishes; // agora vivem no HTML
    // Garante que o administrador de demonstração existe sempre.
    if (!saved.users.some(u => u.role === 'admin')) saved.users.unshift(fresh.users[0]);
    return saved;
  } catch (e) {
    console.warn('Base de dados corrompida, a repor valores iniciais:', e);
    storageSet(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function saveDB() {
  if (!storageSet(DB_KEY, JSON.stringify(db))) {
    setMessage('Não foi possível guardar os dados (armazenamento do navegador indisponível).', 'danger');
  }
}

let db = loadDB();

/** Identificador único (Date.now() */
let idSeed = 0;
function newId() { return Date.now() * 1000 + (idSeed++ % 1000); }

function currentUser() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function startSession(u) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role }));
}
/*u*/
const $ = (id) => document.getElementById(id);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ESCAPES[c]);
}

function pad(n) { return String(n).padStart(2, '0'); }
/** Data de hoje no formato YYYY-MM-DD, na hora LOCAL (toISOString usa UTC e falha perto da meia-noite). */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function datePT(value) {
  if (!value) return '';
  const d = new Date(value + 'T12:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('pt-PT');
}

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function setMessage(message, type = 'success') {
  let box = $('message-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'message-box';
    box.className = 'container mt-3';
    box.setAttribute('aria-live', 'polite');
    const main = document.querySelector('main');
    if (main) main.prepend(box); else document.body.prepend(box);
  }
  box.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${escapeHTML(message)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button></div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Só aceita redirecionamentos para páginas locais (evita open-redirect via ?next=). */
function safeNext(value) {
  return /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(value || '') ? value : null;
}

function callStatus(call) {
  return call.deadline && call.deadline < todayISO() ? 'Encerrado' : 'Aberto';
}

/* atualização de menu cards */
function updateNav() {
  const user = currentUser();
  const btn = $('nav-login-btn');
  if (btn && user) {
    btn.textContent = user.name.split(' ')[0];
    btn.href = 'minha-area.html';
  }
  if (user?.role === 'admin') $('nav-admin-link')?.classList.remove('d-none');
}

/** Cards */
function createCard(item, type) {
  const isEvent = type === 'event';
  const isNews = type === 'news';
  const meta = item.meta ?? (isEvent ? `${datePT(item.date)} · ${item.parish}` : isNews ? datePT(item.date) : '');
  const tag = item.tag ?? (isEvent ? item.category : isNews ? (item.category || 'Notícia') : (item.category || ''));
  const visual = item.visual ?? (isEvent ? 'Agenda municipal' : isNews ? 'Informação municipal' : 'Projeto municipal');

  return `
    <div class="col-md-6 col-lg-4">
      <article class="content-card">
        <div class="card-visual">${escapeHTML(visual)}</div>
        <div class="card-body">
          ${tag ? `<span class="tag">${escapeHTML(tag)}</span>` : ''}
          ${meta ? `<div class="meta mt-3">${escapeHTML(meta)}</div>` : ''}
          <h3 class="mt-2">${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(item.summary || item.description || '')}</p>
        </div>
      </article>
    </div>`;
}

const emptyState = (text) => `<div class="col-12"><div class="empty-state">${text}</div></div>`;
const byDateDesc = (a, b) => b.date.localeCompare(a.date);
const byDateAsc = (a, b) => a.date.localeCompare(b.date);

/* páginas que dependem das listas */
function renderHome() {
  const n = $('home-news');
  const e = $('home-events');
  if (n) n.innerHTML = db.news.slice().sort(byDateDesc).slice(0, 3).map(x => createCard(x, 'news')).join('');
  if (e) {
    const today = todayISO();
    const upcoming = db.events.filter(x => x.date >= today).sort(byDateAsc).slice(0, 3);
    e.innerHTML = upcoming.length
      ? upcoming.map(x => createCard(x, 'event')).join('')
      : emptyState('Não há eventos agendados de momento.');
  }
}

function renderNews() {
  const target = $('news-list');
  if (!target) return;
  const q = norm($('news-search')?.value);
  const items = db.news.filter(x => norm(`${x.title} ${x.summary}`).includes(q)).sort(byDateDesc);
  target.innerHTML = items.length ? items.map(x => createCard(x, 'news')).join('') : emptyState('Não foram encontradas notícias.');
}

function renderEvents() {
  const target = $('events-list');
  if (!target) return;

  const q = norm($('event-search')?.value);
  const cat = $('event-category')?.value || '';
  const par = $('event-parish')?.value || '';
  const today = todayISO();

  const items = db.events
    .filter(x => norm(`${x.title} ${x.parish} ${x.description}`).includes(q) && (!cat || x.category === cat) && (!par || x.parish === par))
    .sort(byDateAsc);

  target.innerHTML = items.length
    ? items.map(x => {
        const status = x.date < today ? 'Realizado' : x.date === today ? 'A decorrer' : 'Agendado';
        return createCard({ ...x, tag: `${x.category} · ${status}` }, 'event');
      }).join('')
    : emptyState('Não existem eventos para os filtros selecionados.');
}

function renderCalls() {
  const el = $('calls-list');
  if (!el) return;
  const user = currentUser();
  el.innerHTML = db.calls.map(x => {
    const open = callStatus(x) === 'Aberto';
    const href = user
      ? `minha-area.html?call=${x.id}`
      : `login.html?next=${encodeURIComponent(`minha-area.html?call=${x.id}`)}`;
    return `
    <div class="col-md-6">
      <article class="content-card">
        <div class="card-body">
          <span class="tag${open ? '' : ' tag-closed'}">${callStatus(x)}</span>
          <h3 class="mt-3">${escapeHTML(x.title)}</h3>
          <p>${escapeHTML(x.description)}</p>
          <div class="meta mb-3">Prazo: ${datePT(x.deadline)}</div>
          ${open
            ? `<a href="${href}" class="btn btn-brand">Candidatar-me</a>`
            : '<button class="btn btn-brand" disabled>Candidaturas encerradas</button>'}
        </div>
      </article>
    </div>`;
  }).join('') || emptyState('Não existem concursos publicados.');
}

/* iniciar sessao */
function handleAuth() {
  const login = $('login-form');
  const register = $('register-form');
  if (!login || !register) return;

  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));
  const user = currentUser();
  if (user) { location.replace(next || (user.role === 'admin' ? 'admin.html' : 'minha-area.html')); return; }

  const tabs = document.querySelectorAll('[data-auth]');
  const showTab = (name) => {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.auth === name));
    login.hidden = name !== 'login';
    register.hidden = name !== 'register';
  };
  tabs.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.auth)));

  login.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(login));
    const email = String(d.email).trim().toLowerCase();
    const u = db.users.find(x => x.email.toLowerCase() === email && x.password === d.password);
    if (!u) return setMessage('Email ou palavra-passe incorretos.', 'danger');
    startSession(u);
    location.href = next || (u.role === 'admin' ? 'admin.html' : 'minha-area.html');
  });

  register.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(register));
    const email = String(d.email).trim().toLowerCase();
    const name = String(d.name).trim();
    if (!name) return setMessage('Indique o seu nome.', 'danger');
    if (db.users.some(x => x.email.toLowerCase() === email)) return setMessage('Já existe uma conta com esse email.', 'danger');
    const u = {
      id: newId(), name, email, password: d.password,
      role: USER_ROLES.includes(d.role) ? d.role : 'citizen' // nunca aceitar "admin" vindo do formulário
    };
    db.users.push(u);
    saveDB();
    startSession(u);
    location.href = next || 'minha-area.html';
  });
}

function renderAccount() {
  const user = currentUser();
  $('account-name').textContent = user.name;
  $('account-email').textContent = user.email;

  const mine = db.applications.filter(a => a.userId === user.id);
  $('my-applications').innerHTML = mine.map(a => `
    <div class="col-md-6">
      <div class="stat-card">
        <strong>${escapeHTML(a.call)}</strong>
        <span class="status">${escapeHTML(a.status)}</span>
        <p class="small text-secondary mt-2 mb-0">Submetida em ${datePT(a.date)}${a.fileName ? ` · ${escapeHTML(a.fileName)}` : ''}</p>
      </div>
    </div>`).join('') || emptyState('Ainda não submeteu candidaturas.');
}

function renderApplicationForm() {
  const select = $('application-call');
  const form = $('application-form');
  if (!select || !form) return;
  const open = db.calls.filter(c => callStatus(c) === 'Aberto');
  const wanted = new URLSearchParams(location.search).get('call');
  const previous = select.value;

  select.innerHTML = open.map(c => `<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('');
  const preferred = previous || wanted;
  if (preferred && open.some(c => String(c.id) === String(preferred))) select.value = preferred;

  const noCalls = open.length === 0;
  form.querySelectorAll('select, textarea, input, button').forEach(el => { el.disabled = noCalls; });
  if (noCalls) select.innerHTML = '<option value="">Sem concursos abertos</option>';
}

function handleAccount() {
  const content = $('account-content');
  if (!content) return;

  const user = currentUser();
  if (!user) return; // sem sessão: o HTML já mostra o aviso "Inicie sessão"

  $('account-guest').hidden = true;
  content.hidden = false;
  $('application-card').hidden = false;
  renderAccount();
  renderApplicationForm();

  $('logout').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = 'index.html';
  });

  const form = $('application-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const call = db.calls.find(c => String(c.id) === d.get('call'));
    if (!call || callStatus(call) !== 'Aberto') return setMessage('Este concurso já não está aberto.', 'danger');
    if (db.applications.some(a => a.userId === user.id && a.callId === call.id)) {
      return setMessage('Já submeteu uma candidatura a este concurso.', 'warning');
    }
    const file = form.elements.document.files[0];
    db.applications.push({
      id: newId(), userId: user.id, userName: user.name,
      callId: call.id, call: call.title, message: String(d.get('message')).trim(),
      fileName: file?.name || '', date: todayISO(), status: 'Recebida'
    });
    saveDB();
    form.reset();
    renderAccount();
    renderApplicationForm();
    setMessage('Candidatura submetida com sucesso.');
  });
}

function handleEventSubmission() {
  const form = $('event-submit-form');
  if (!form) return;
  form.elements.date.min = todayISO();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const user = currentUser();
    db.proposals.push({
      id: newId(),
      title: d.title.trim(), category: d.category, date: d.date,
      parish: d.parish.trim(), description: d.description.trim(),
      author: user?.name || 'Visitante', status: 'Pendente', createdAt: todayISO()
    });
    saveDB();
    form.reset();
    setMessage('Proposta enviada. Será analisada pela equipa municipal.');
  });
}

/* Parte de administração */
function renderAdmin() {
  const pending = db.proposals.filter(p => p.status === 'Pendente');

  $('stat-news').textContent = db.news.length;
  $('stat-events').textContent = db.events.length;
  $('stat-applications').textContent = db.applications.length;
  $('stat-proposals').textContent = pending.length;

  $('admin-applications').innerHTML = db.applications.map(a => `
    <tr>
      <td>${escapeHTML(a.userName)}</td>
      <td>${escapeHTML(a.call)}</td>
      <td>${datePT(a.date)}</td>
      <td><span class="status">${escapeHTML(a.status)}</span></td>
      <td>
        <select class="form-select form-select-sm" data-app="${a.id}" aria-label="Alterar estado">
          ${APPLICATION_STATUSES.map(s => `<option${a.status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('') || '<tr><td colspan="5">Sem candidaturas.</td></tr>';

  $('admin-proposals').innerHTML = pending.map(p => `
    <div class="d-flex justify-content-between align-items-center border-bottom py-2 gap-3 flex-wrap">
      <span>
        <small class="text-secondary">${escapeHTML(p.category)} · ${datePT(p.date)} · ${escapeHTML(p.parish)} · por ${escapeHTML(p.author)}</small><br>
        <strong>${escapeHTML(p.title)}</strong><br>
        <small>${escapeHTML(p.description)}</small>
      </span>
      <span class="d-flex gap-2">
        <button class="btn btn-sm btn-brand" data-proposal="approve" data-id="${p.id}">Aprovar</button>
        <button class="btn btn-sm btn-outline-danger" data-proposal="reject" data-id="${p.id}">Rejeitar</button>
      </span>
    </div>`).join('') || '<p class="text-secondary mb-0">Sem propostas pendentes.</p>';

  $('admin-content-list').innerHTML = [
    ...db.news.map(x => ({ kind: 'news', label: 'Notícia', ...x })),
    ...db.events.map(x => ({ kind: 'event', label: 'Evento', ...x }))
  ].map(x => `
    <div class="d-flex justify-content-between align-items-center border-bottom py-2 gap-3">
      <span><small class="text-secondary">${x.label}</small><br>${escapeHTML(x.title)}</span>
      <button class="btn btn-sm btn-outline-danger" data-delete="${x.kind}" data-id="${x.id}">Eliminar</button>
    </div>`).join('') || '<p class="text-secondary mb-0">Sem conteúdos.</p>';
}

function handleAdmin() {
  const guard = $('admin-guard');
  const panel = $('admin-panel');
  if (!guard || !panel) return;

  if (currentUser()?.role !== 'admin') return; // acesso reservado
  guard.hidden = true;
  panel.hidden = false;
  renderAdmin();

  // eventos
  panel.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const d = Object.fromEntries(new FormData(form));
    if (form.id === 'admin-news-form') {
      db.news.unshift({ id: newId(), title: d.title.trim(), summary: d.summary.trim(), date: todayISO(), category: 'Município' });
    } else if (form.id === 'admin-event-form') {
      db.events.push({ id: newId(), title: d.title.trim(), date: d.date, parish: d.parish.trim(), category: d.category, description: 'Evento publicado pelo Município Y.' });
    } else return;
    saveDB();
    form.reset();
    renderAdmin();
  });

  panel.addEventListener('change', e => {
    const id = e.target.dataset.app;
    if (!id) return;
    const app = db.applications.find(a => String(a.id) === id);
    if (!app) return;
    app.status = e.target.value;
    saveDB();
    renderAdmin();
  });

  panel.addEventListener('click', e => {
    const del = e.target.closest('[data-delete]');
    const prop = e.target.closest('[data-proposal]');

    if (del) {
      if (!confirm('Eliminar este conteúdo?')) return;
      const key = del.dataset.delete === 'news' ? 'news' : 'events';
      db[key] = db[key].filter(x => String(x.id) !== del.dataset.id);
    } else if (prop) {
      const p = db.proposals.find(x => String(x.id) === prop.dataset.id);
      if (!p) return;
      if (prop.dataset.proposal === 'approve') {
        p.status = 'Aprovada';
        db.events.push({ id: newId(), title: p.title, date: p.date, parish: p.parish, category: p.category, description: p.description });
      } else {
        p.status = 'Rejeitada';
      }
    } else return;

    saveDB();
    renderAdmin();
  });
}

/* Arranque */
function renderPublic() {
  renderHome();
  renderNews();
  renderEvents();
  renderCalls();
}

function init() {
  updateNav();
  renderPublic();
  handleAuth();
  handleAccount();
  handleEventSubmission();
  handleAdmin();

  $('news-search')?.addEventListener('input', renderNews);
  ['event-search', 'event-category', 'event-parish'].forEach(id => $(id)?.addEventListener('input', renderEvents));

  // Mantém vários separadores sincronizados (alterações feitas noutro separador).
  window.addEventListener('storage', e => {
    if (e.key !== DB_KEY) return;
    db = loadDB();
    renderPublic();
    if ($('admin-panel') && !$('admin-panel').hidden) renderAdmin();
    if (!$('account-content')?.hidden && currentUser()) { renderAccount(); renderApplicationForm(); }
  });

  // Service Worker: só em http(s), nunca em file://
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('PWA indisponível:', err));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
