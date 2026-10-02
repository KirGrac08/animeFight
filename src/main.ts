import './style.css';
import { ABILITY_INFO, CATALOG, PACK_PRICE } from './core/cards';
import * as G from './core/game';
import * as Auth from './auth';
import type { CardInstance, MenuTab } from './core/types';

const app = document.getElementById('app')!;

// ============================================================
// Состояние приложения (экран входа / игра)
// ============================================================

type AuthTab = 'login' | 'register';

interface AppUi {
  mode: 'auth' | 'game';
  authTab: AuthTab;
  currentUser: string | null;
  error: string | null;
}

const ui: AppUi = {
  mode: 'auth',
  authTab: 'login',
  currentUser: null,
  error: null,
};

let state: G.GameState | null = null;

// Восстанавливаем сессию при запуске
function bootstrap() {
  const nick = Auth.getSession();
  if (!nick) return;
  ui.currentUser = nick;
  state = Auth.loadGame(nick) ?? G.createInitialState();
  ui.mode = 'game';
}

// ============================================================
// Карта
// ============================================================

function cardEl(card: CardInstance, onClick?: () => void): HTMLElement {
  const def = CATALOG[card.defId];
  const el = document.createElement('div');
  el.className = `card ${def.rarity}`;
  const hpPct = Math.max(0, card.currentHp) / def.health;

  const abilityLines = def.abilities.map(
    a => `${ABILITY_INFO[a].icon} ${ABILITY_INFO[a].label} — ${ABILITY_INFO[a].desc}`,
  );
  el.title = [
    `${def.name} (${def.rarity})`,
    `⚔ ${def.attack}   ❤ ${def.health}`,
    abilityLines.length ? '' : null,
    ...abilityLines,
  ].filter(Boolean).join('\n');

  const abilitiesIcons = def.abilities.map(a => ABILITY_INFO[a].icon).join(' ');

  let badges = '';
  if (card.shield > 0) badges += `<div class="badge shield">🛡 ${card.shield}</div>`;
  if (card.poison > 0) badges += `<div class="badge poison">☠ ${card.poison}</div>`;

  el.innerHTML = `
    <div class="art">${def.art}</div>
    <div class="name">${def.name}</div>
    <div class="abilities">${abilitiesIcons}</div>
    <div class="stats">
      <span class="atk">⚔ ${def.attack}</span>
      <span class="hp">❤ ${Math.max(0, card.currentHp)}/${def.health}</span>
    </div>
    <div class="hpbar"><div style="width:${hpPct * 100}%"></div></div>
    ${badges}
  `;

  if (onClick) {
    el.classList.add('clickable');
    el.addEventListener('click', onClick);
  }
  return el;
}

function row(label: string, cards: CardInstance[], onCard?: (c: CardInstance) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lbl = document.createElement('div');
  lbl.className = 'label';
  lbl.textContent = label;
  wrap.appendChild(lbl);
  const field = document.createElement('div');
  field.className = 'field';
  if (cards.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '—';
    field.appendChild(empty);
  } else {
    cards.forEach(c => field.appendChild(cardEl(c, onCard ? () => onCard(c) : undefined)));
  }
  wrap.appendChild(field);
  return wrap;
}

// ============================================================
// Экран входа
// ============================================================

function renderAuthScreen() {
  const wrap = document.createElement('div');
  wrap.className = 'auth';

  const title = document.createElement('h1');
  title.className = 'menu-title';
  title.textContent = '⚔️ Card Battle';
  wrap.appendChild(title);

  const panel = document.createElement('div');
  panel.className = 'auth-panel';

  // Табы
  const tabs = document.createElement('div');
  tabs.className = 'auth-tabs';
  (['login', 'register'] as AuthTab[]).forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `auth-tab ${ui.authTab === tab ? 'active' : ''}`;
    btn.textContent = tab === 'login' ? 'Вход' : 'Регистрация';
    btn.onclick = () => { ui.authTab = tab; ui.error = null; render(); };
    tabs.appendChild(btn);
  });
  panel.appendChild(tabs);

  // Поля
  const nickInput = document.createElement('input');
  nickInput.type = 'text';
  nickInput.placeholder = 'Ник';
  nickInput.autocomplete = 'username';

  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.placeholder = 'Пароль';
  passInput.autocomplete = ui.authTab === 'login' ? 'current-password' : 'new-password';

  const submit = async () => {
    ui.error = null;
    try {
      const nick = nickInput.value.trim();
      const pass = passInput.value;
      if (ui.authTab === 'register') {
        await Auth.register(nick, pass);
      } else {
        await Auth.login(nick, pass);
      }
      // Успех — входим
      ui.currentUser = nick;
      Auth.setSession(nick);
      state = Auth.loadGame(nick) ?? G.createInitialState();
      ui.mode = 'game';
      render();
    } catch (e) {
      ui.error = (e as Error).message;
      render();
    }
  };

  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') passInput.focus(); });
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  panel.appendChild(nickInput);
  panel.appendChild(passInput);

  if (ui.error) {
    const err = document.createElement('div');
    err.className = 'auth-error';
    err.textContent = ui.error;
    panel.appendChild(err);
  }

  const btn = document.createElement('button');
  btn.className = 'primary-btn';
  btn.style.width = '100%';
  btn.textContent = ui.authTab === 'login' ? 'Войти' : 'Создать аккаунт';
  btn.onclick = submit;
  panel.appendChild(btn);

  const hint = document.createElement('div');
  hint.className = 'auth-hint';
  hint.textContent = 'Данные хранятся локально в браузере. Для реального мультиплеера нужен сервер.';
  panel.appendChild(hint);

  wrap.appendChild(panel);
  app.appendChild(wrap);
}

// ============================================================
// Общая верхняя панель (ник, кристаллы, выход)
// ============================================================

function renderTopBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'top-bar';

  const nick = document.createElement('span');
  nick.className = 'nick';
  nick.textContent = `👤 ${ui.currentUser ?? '—'}`;
  bar.appendChild(nick);

  const crystals = document.createElement('span');
  crystals.className = 'crystals';
  crystals.textContent = `💎 ${state!.crystals}`;
  bar.appendChild(crystals);

  const logout = document.createElement('button');
  logout.className = 'icon-btn';
  logout.textContent = '🚪 Выйти';
  logout.onclick = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    Auth.clearSession();
    ui.currentUser = null;
    ui.mode = 'auth';
    ui.authTab = 'login';
    state = null;
    render();
  };
  bar.appendChild(logout);

  return bar;
}

// ============================================================
// МЕНЮ
// ============================================================

function renderMenu() {
  const menu = document.createElement('div');
  menu.className = 'menu';

  menu.appendChild(renderTopBar());

  const title = document.createElement('h1');
  title.className = 'menu-title';
  title.textContent = '⚔️ Card Battle';
  menu.appendChild(title);

  const tabs = document.createElement('div');
  tabs.className = 'menu-tabs';
  const tabDefs: { id: MenuTab; label: string }[] = [
    { id: 'battle',    label: '⚔️ Бой' },
    { id: 'rating',    label: '🏆 Рейтинг' },
    { id: 'inventory', label: '📦 Инвентарь' },
    { id: 'packs',     label: `🎁 Паки${state!.packs > 0 ? ` (${state!.packs})` : ''}` },
  ];
  tabDefs.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = `tab ${state!.menuTab === id ? 'active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => { G.setMenuTab(state!, id); render(); };
    tabs.appendChild(btn);
  });
  menu.appendChild(tabs);

  const content = document.createElement('div');
  content.className = 'menu-content';

  switch (state!.menuTab) {
    case 'battle':    renderBattleTab(content);    break;
    case 'rating':    renderRatingTab(content);    break;
    case 'inventory': content.appendChild(inventoryContent()); break;
    case 'packs':     renderPacksTab(content);     break;
  }
  menu.appendChild(content);
  app.appendChild(menu);
}

function renderBattleTab(root: HTMLElement) {
  const card = document.createElement('div');
  card.className = 'menu-panel';
  card.innerHTML = `
    <h2>Тренировочный бой</h2>
    <p>Сразись с волной противников. Карты, потерянные в бою, исчезают навсегда.
    Победа: 💎 +1. Победа без потерь: 💎 +3. Поражение: 💎 +0.</p>
    <div class="stats-row">
      <span>📚 Колода: ${state!.player.deck.length}</span>
      <span>✋ Рука: ${state!.player.hand.length}</span>
      <span>🪦 Потеряно: ${state!.player.lost.length}</span>
      <span>💎 Кристаллы: ${state!.crystals}</span>
    </div>
  `;

  const btn = document.createElement('button');
  btn.className = 'primary-btn';
  btn.textContent = '⚔️ Начать бой';
  btn.disabled = state!.player.deck.length + state!.player.hand.length === 0;
  btn.onclick = () => { G.goToBattle(state!); render(); };
  card.appendChild(btn);

  const soon = document.createElement('div');
  soon.className = 'soon';
  soon.textContent = '🌐 Подбор реальных противников — скоро';
  card.appendChild(soon);

  root.appendChild(card);
}

function renderRatingTab(root: HTMLElement) {
  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.innerHTML = `
    <h2>🏆 Рейтинг</h2>
    <p>Таблица лидеров появится вместе с онлайн-режимом.</p>
  `;
  const placeholder = document.createElement('div');
  placeholder.className = 'rating-placeholder';
  for (let i = 1; i <= 5; i++) {
    const line = document.createElement('div');
    line.className = 'rating-line';
    line.innerHTML = `<span class="rank">#${i}</span><span class="name">— — —</span><span class="mmr">—</span>`;
    placeholder.appendChild(line);
  }
  panel.appendChild(placeholder);
  root.appendChild(panel);
}

function renderPacksTab(root: HTMLElement) {
  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.innerHTML = `
    <h2>🎁 Паки</h2>
    <p>Каждый пак даёт 3 случайные карты. Редкость: обычная / редкая / эпическая.</p>
  `;

  const count = document.createElement('div');
  count.className = 'pack-count';
  count.innerHTML = `Доступно паков: <b>${state!.packs}</b> &nbsp;·&nbsp; 💎 ${state!.crystals}`;
  panel.appendChild(count);

  const row = document.createElement('div');
  row.className = 'controls';

  const openBtn = document.createElement('button');
  openBtn.className = 'primary-btn pack';
  openBtn.textContent = '🎁 Открыть пак';
  openBtn.disabled = state!.packs <= 0;
  openBtn.onclick = () => { G.openPack(state!); render(); };
  row.appendChild(openBtn);

  const buyBtn = document.createElement('button');
  buyBtn.className = 'primary-btn';
  buyBtn.textContent = `💎 Купить за ${PACK_PRICE}`;
  buyBtn.disabled = state!.crystals < PACK_PRICE;
  buyBtn.onclick = () => {
    const ok = G.buyPack(state!);
    if (!ok) alert('Недостаточно кристаллов');
    render();
  };
  row.appendChild(buyBtn);

  panel.appendChild(row);

  if (state!.log.length) {
    const logTitle = document.createElement('h3');
    logTitle.style.marginTop = '20px';
    logTitle.textContent = 'Последнее событие';
    panel.appendChild(logTitle);
    const logBox = document.createElement('div');
    logBox.className = 'log compact';
    state!.log.forEach(l => {
      const line = document.createElement('div');
      line.textContent = l;
      logBox.appendChild(line);
    });
    panel.appendChild(logBox);
  }

  root.appendChild(panel);
}

// ============================================================
// ИНВЕНТАРЬ
// ============================================================

function inventoryContent(): HTMLElement {
  const wrap = document.createElement('div');

  const colTitle = document.createElement('h3');
  colTitle.textContent = `Коллекция (${state!.collection.length})`;
  wrap.appendChild(colTitle);

  const colGrid = document.createElement('div');
  colGrid.className = 'inventory-grid';
  if (state!.collection.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Пусто';
    colGrid.appendChild(empty);
  } else {
    const counts = new Map<string, CardInstance>();
    for (const c of state!.collection) {
      if (!counts.has(c.defId)) counts.set(c.defId, c);
    }
    counts.forEach((sample, defId) => {
      const count = state!.collection.filter(c => c.defId === defId).length;
      const el = cardEl(sample);
      if (count > 1) {
        const badge = document.createElement('div');
        badge.className = 'count-badge';
        badge.textContent = `×${count}`;
        el.appendChild(badge);
      }
      colGrid.appendChild(el);
    });
  }
  wrap.appendChild(colGrid);

  if (state!.player.lost.length > 0) {
    const lostTitle = document.createElement('h3');
    lostTitle.style.marginTop = '24px';
    lostTitle.textContent = `🪦 Потеряно навсегда (${state!.player.lost.length})`;
    wrap.appendChild(lostTitle);

    const lostGrid = document.createElement('div');
    lostGrid.className = 'inventory-grid';
    const lostCounts = new Map<string, CardInstance>();
    for (const c of state!.player.lost) {
      if (!lostCounts.has(c.defId)) lostCounts.set(c.defId, c);
    }
    lostCounts.forEach((sample, defId) => {
      const count = state!.player.lost.filter(c => c.defId === defId).length;
      const el = cardEl(sample);
      el.classList.add('lost');
      if (count > 1) {
        const badge = document.createElement('div');
        badge.className = 'count-badge';
        badge.textContent = `×${count}`;
        el.appendChild(badge);
      }
      lostGrid.appendChild(el);
    });
    wrap.appendChild(lostGrid);
  }

  return wrap;
}

// ============================================================
// БОЙ
// ============================================================

function renderBattleScreen() {
  app.appendChild(renderTopBar());

  const header = document.createElement('div');
  header.className = 'header';

  const stats = [
    `🌀 Ход ${state!.turn}`,
    `📚 Колода: ${state!.player.deck.length}`,
    `✋ Рука: ${state!.player.hand.length}`,
    `🪦 Потеряно: ${state!.player.lost.length}`,
    `🎁 Паки: ${state!.packs}`,
    `💎 ${state!.crystals}`,
  ];
  stats.forEach(s => {
    const span = document.createElement('span');
    span.textContent = s;
    header.appendChild(span);
  });

  const invBtn = document.createElement('button');
  invBtn.className = 'icon-btn';
  invBtn.textContent = `📦 (${state!.collection.length})`;
  invBtn.onclick = () => { G.toggleInventory(state!); render(); };
  header.appendChild(invBtn);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'icon-btn';
  menuBtn.textContent = '☰ Меню';
  menuBtn.onclick = () => { G.goToMenu(state!); render(); };
  header.appendChild(menuBtn);

  app.appendChild(header);

  app.appendChild(row('Враг', state!.enemy.field));
  app.appendChild(row('Ваше поле', state!.player.field));

  const handRow = row('Рука', state!.player.hand, (c) => {
    if (G.placeCard(state!, c.instanceId)) render();
  });
  handRow.classList.add('hand');
  app.appendChild(handRow);

  const controls = document.createElement('div');
  controls.className = 'controls';
  if (state!.phase === 'placing') {
    const btn = document.createElement('button');
    btn.textContent = '⚔️ В бой';
    btn.disabled = state!.player.field.length === 0;
    btn.onclick = () => { G.resolveBattle(state!); render(); };
    controls.appendChild(btn);
  } else if (state!.phase === 'pack') {
    const btn = document.createElement('button');
    btn.className = 'pack';
    btn.textContent = '🎁 Открыть пак';
    btn.onclick = () => { G.openPack(state!); render(); };
    controls.appendChild(btn);
  }
  app.appendChild(controls);

  const log = document.createElement('div');
  log.className = 'log';
  state!.log.forEach(l => {
    const line = document.createElement('div');
    line.textContent = l;
    log.appendChild(line);
  });
  app.appendChild(log);

  if (state!.phase === 'spoils') renderSpoilsOverlay();
  if (state!.showInventory)     renderInventoryOverlay();
}

function renderSpoilsOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'spoils-overlay';

  const title = document.createElement('div');
  title.className = 'spoils-title';
  title.textContent = '🏆 Трофеи боя';
  overlay.appendChild(title);

  const hint = document.createElement('div');
  hint.className = 'spoils-hint';
  hint.textContent = 'Выберите одну карту, чтобы забрать её в коллекцию';
  overlay.appendChild(hint);

  const cards = document.createElement('div');
  cards.className = 'spoils-cards';
  state!.spoils.forEach(c => {
    cards.appendChild(cardEl(c, () => {
      G.takeSpoil(state!, c.instanceId);
      render();
    }));
  });
  overlay.appendChild(cards);

  const skip = document.createElement('button');
  skip.className = 'btn-secondary';
  skip.textContent = 'Пропустить';
  skip.onclick = () => { G.skipSpoils(state!); render(); };
  overlay.appendChild(skip);

  app.appendChild(overlay);
}

function renderInventoryOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { G.toggleInventory(state!); render(); }
  });

  const panel = document.createElement('div');
  panel.className = 'inventory-panel';

  const header = document.createElement('div');
  header.className = 'inventory-header';
  const h2 = document.createElement('h2');
  h2.textContent = '📦 Инвентарь';
  header.appendChild(h2);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-secondary';
  closeBtn.textContent = '✕ Закрыть';
  closeBtn.onclick = () => { G.toggleInventory(state!); render(); };
  header.appendChild(closeBtn);
  panel.appendChild(header);

  panel.appendChild(inventoryContent());
  overlay.appendChild(panel);
  app.appendChild(overlay);
}

// ============================================================
// ГЛАВНЫЙ РЕНДЕР
// ============================================================

function render() {
  // Автосохранение после каждого действия в игре
  if (ui.mode === 'game' && state && ui.currentUser) {
    Auth.saveGame(ui.currentUser, state);
  }

  app.innerHTML = '';

  if (ui.mode === 'auth') {
    renderAuthScreen();
    return;
  }

  if (state!.screen === 'menu') renderMenu();
  else renderBattleScreen();
}

bootstrap();
render();