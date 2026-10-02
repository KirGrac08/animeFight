import './style.css';
import { ABILITY_INFO, CATALOG, PACK_PRICE, MIN_DECK_SIZE, MAX_DECK_SIZE } from './core/cards';
import * as G from './core/game';
import * as Auth from './auth';
import type { CardInstance, MenuTab, BattleEvent } from './core/types';

const app = document.getElementById('app')!;

// ============================================================
// UI-состояние
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
let isAnimating = false;

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

interface CardOpts {
  onClick?: () => void;
  inDeck?: boolean;
  partialDeck?: boolean;
  showCount?: number;
  deckToggle?: () => void;
}

function cardEl(card: CardInstance, opts: CardOpts = {}): HTMLElement {
  const def = CATALOG[card.defId];
  const el = document.createElement('div');
  el.className = `card ${def.rarity}`;
  el.dataset.cardId = card.instanceId;

  if (opts.inDeck) el.classList.add('in-deck');
  if (opts.partialDeck) el.classList.add('partially-in-deck');

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
    ${opts.showCount && opts.showCount > 1 ? `<div class="count-badge">×${opts.showCount}</div>` : ''}
    ${opts.inDeck ? `<div class="deck-mark">✓</div>` : ''}
  `;

  if (opts.deckToggle) {
    el.classList.add('clickable');
    el.addEventListener('click', opts.deckToggle);
  } else if (opts.onClick) {
    el.classList.add('clickable');
    el.addEventListener('click', opts.onClick);
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
    cards.forEach(c => field.appendChild(cardEl(c, onCard ? { onClick: () => onCard(c) } : {})));
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
  hint.textContent = 'Данные хранятся локально в браузере.';
  panel.appendChild(hint);

  wrap.appendChild(panel);
  app.appendChild(wrap);
}

// ============================================================
// Верхняя панель
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
// Меню
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
    { id: 'inventory', label: '📦 Коллекция' },
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
  const deckReady = G.isDeckReady(state!);
  const deckSize = state!.deckIds.length;

  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.innerHTML = `
    <h2>Тренировочный бой</h2>
    <p>Сразись с волной противников. Карты, потерянные в бою, исчезают навсегда.
    Победа: 💎 +1. Победа без потерь: 💎 +3.</p>
    <div class="stats-row">
      <span>🎴 Дека: <b class="${deckReady ? 'ok' : 'bad'}">${deckSize} / ${MAX_DECK_SIZE}</b>
            <small>(мин. ${MIN_DECK_SIZE})</small></span>
      <span>📦 Коллекция: ${state!.collection.length}</span>
      <span>🪦 Потеряно: ${state!.player.lost.length}</span>
      <span>💎 ${state!.crystals}</span>
    </div>
  `;

  const btnRow = document.createElement('div');
  btnRow.className = 'controls';

  const btn = document.createElement('button');
  btn.className = 'primary-btn';
  btn.textContent = deckReady ? '⚔️ Начать бой' : `⚠️ Собери деку (${deckSize}/${MIN_DECK_SIZE})`;
  btn.disabled = !deckReady;
  btn.onclick = () => { G.goToBattle(state!); render(); };
  btnRow.appendChild(btn);

  const toInv = document.createElement('button');
  toInv.className = 'btn-secondary';
  toInv.textContent = '📦 Собрать деку';
  toInv.onclick = () => { G.setMenuTab(state!, 'inventory'); render(); };
  btnRow.appendChild(toInv);

  panel.appendChild(btnRow);

  const soon = document.createElement('div');
  soon.className = 'soon';
  soon.textContent = '🌐 Подбор реальных противников — скоро';
  panel.appendChild(soon);

  root.appendChild(panel);
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

  const rowBox = document.createElement('div');
  rowBox.className = 'controls';

  const openBtn = document.createElement('button');
  openBtn.className = 'primary-btn pack';
  openBtn.textContent = '🎁 Открыть пак';
  openBtn.disabled = state!.packs <= 0;
  openBtn.onclick = () => { G.openPack(state!); render(); };
  rowBox.appendChild(openBtn);

  const buyBtn = document.createElement('button');
  buyBtn.className = 'primary-btn';
  buyBtn.textContent = `💎 Купить за ${PACK_PRICE}`;
  buyBtn.disabled = state!.crystals < PACK_PRICE;
  buyBtn.onclick = () => {
    const ok = G.buyPack(state!);
    if (!ok) alert('Недостаточно кристаллов');
    render();
  };
  rowBox.appendChild(buyBtn);

  panel.appendChild(rowBox);

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
// Инвентарь
// ============================================================

function inventoryContent(): HTMLElement {
  const wrap = document.createElement('div');

  const deckInfo = document.createElement('div');
  deckInfo.className = 'deck-info';
  const inDeck = state!.deckIds.length;
  const ready = G.isDeckReady(state!);
  deckInfo.innerHTML = `
    🎴 В боевой деке: <b class="${ready ? 'ok' : 'bad'}">${inDeck} / ${MAX_DECK_SIZE}</b>
    <small>(минимум ${MIN_DECK_SIZE})</small>
    &nbsp;·&nbsp; клик по карте — добавить/убрать
  `;
  wrap.appendChild(deckInfo);

  const sortRow = document.createElement('div');
  sortRow.className = 'controls-row';
  const sortLabel = document.createElement('span');
  sortLabel.className = 'ctrl-label';
  sortLabel.textContent = 'Сортировка:';
  sortRow.appendChild(sortLabel);
  const sorts: { id: G.InventorySort; label: string }[] = [
    { id: 'default', label: 'По умолчанию' },
    { id: 'name',    label: 'По имени' },
    { id: 'attack',  label: 'По атаке' },
    { id: 'health',  label: 'По HP' },
    { id: 'rarity',  label: 'По редкости' },
  ];
  sorts.forEach(s => {
    const btn = document.createElement('button');
    btn.className = `chip ${state!.inventorySort === s.id ? 'active' : ''}`;
    btn.textContent = s.label;
    btn.onclick = () => { G.setInventorySort(state!, s.id); render(); };
    sortRow.appendChild(btn);
  });
  wrap.appendChild(sortRow);

  const filterRow = document.createElement('div');
  filterRow.className = 'controls-row';
  const filterLabel = document.createElement('span');
  filterLabel.className = 'ctrl-label';
  filterLabel.textContent = 'Фильтр:';
  filterRow.appendChild(filterLabel);
  const filters: { id: G.InventoryFilter; label: string }[] = [
    { id: 'all',    label: 'Все' },
    { id: 'common', label: 'Обычные' },
    { id: 'rare',   label: 'Редкие' },
    { id: 'epic',   label: 'Эпические' },
  ];
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `chip ${state!.inventoryFilter === f.id ? 'active' : ''}`;
    btn.textContent = f.label;
    btn.onclick = () => { G.setInventoryFilter(state!, f.id); render(); };
    filterRow.appendChild(btn);
  });
  wrap.appendChild(filterRow);

  const colTitle = document.createElement('h3');
  colTitle.textContent = `Коллекция (${state!.collection.length})`;
  wrap.appendChild(colTitle);

  const colGrid = document.createElement('div');
  colGrid.className = 'inventory-grid';
  const visible = G.sortAndFilterCollection(state!);

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Пусто';
    colGrid.appendChild(empty);
  } else {
    visible.forEach(sample => {
      const count = G.countByDefId(state!, sample.defId);
      const inDeckCount = G.countInDeckByDefId(state!, sample.defId);
      const allInDeck = inDeckCount === count && count > 0;
      const someInDeck = inDeckCount > 0 && inDeckCount < count;

      const el = cardEl(sample, {
        showCount: count,
        inDeck: allInDeck,
        partialDeck: someInDeck,
        deckToggle: () => {
          const copies = state!.collection.filter(c => c.defId === sample.defId);
          const target = allInDeck
            ? copies.find(c => G.isInDeck(state!, c.instanceId))
            : copies.find(c => !G.isInDeck(state!, c.instanceId));
          if (!target) return;
          G.toggleCardInDeck(state!, target.instanceId);
          render();
        },
      });
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
    const lostCounts = new Map<string, { sample: CardInstance; count: number }>();
    for (const c of state!.player.lost) {
      const e = lostCounts.get(c.defId);
      if (e) e.count++;
      else lostCounts.set(c.defId, { sample: c, count: 1 });
    }
    lostCounts.forEach(({ sample, count }) => {
      const el = cardEl(sample, { showCount: count });
      el.classList.add('lost');
      lostGrid.appendChild(el);
    });
    wrap.appendChild(lostGrid);
  }

  return wrap;
}

// ============================================================
// Анимации боя
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function eventDuration(ev: BattleEvent): number {
  switch (ev.type) {
    case 'attack':     return 220;
    case 'splash':     return 140;
    case 'death':      return 320;
    case 'poisonTick': return 160;
    case 'shield':     return 120;
    case 'heal':       return 140;
    case 'poison':     return 120;
  }
}

function getCardEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
}

function flashEvent(ev: BattleEvent): void {
  switch (ev.type) {
    case 'attack':
      getCardEl(ev.attackerId)?.classList.add('attacking');
      getCardEl(ev.defenderId)?.classList.add('hit');
      setTimeout(() => {
        getCardEl(ev.attackerId)?.classList.remove('attacking');
        getCardEl(ev.defenderId)?.classList.remove('hit');
      }, 300);
      break;
    case 'splash':
      getCardEl(ev.targetId)?.classList.add('hit');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('hit'), 250);
      break;
    case 'heal':
      getCardEl(ev.targetId)?.classList.add('healed');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('healed'), 300);
      break;
    case 'shield':
      getCardEl(ev.targetId)?.classList.add('shielded');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('shielded'), 250);
      break;
    case 'poison':
    case 'poisonTick':
      getCardEl(ev.targetId)?.classList.add('poisoned');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('poisoned'), 250);
      break;
    case 'death':
      getCardEl(ev.cardId)?.classList.add('dying');
      break;
  }
}

function applyEventToField(player: CardInstance[], enemy: CardInstance[], ev: BattleEvent): void {
  const find = (id: string) => [...player, ...enemy].find(c => c.instanceId === id);

  switch (ev.type) {
    case 'attack': {
      const target = find(ev.defenderId);
      if (target) target.currentHp -= ev.damage;
      break;
    }
    case 'poisonTick':
    case 'splash': {
      const target = find(ev.targetId);
      if (target) target.currentHp -= ev.damage;
      break;
    }
    case 'heal': {
      const target = find(ev.targetId);
      if (target) target.currentHp += ev.amount;
      break;
    }
    case 'shield': {
      const target = find(ev.targetId);
      if (target) target.shield = Math.max(0, target.shield - ev.absorbed);
      break;
    }
    case 'poison': {
      const target = find(ev.targetId);
      if (target) target.poison = ev.stacks;
      break;
    }
    case 'death': {
      const arr = ev.side === 'player' ? player : enemy;
      const idx = arr.findIndex(c => c.instanceId === ev.cardId);
      if (idx >= 0) arr.splice(idx, 1);
      break;
    }
  }
}

async function animateBattle(): Promise<void> {
  if (!state || isAnimating) return;
  if (state.phase !== 'placing' || state.player.field.length === 0) return;

  isAnimating = true;

  // Снимок «до боя»
  const displayPlayer = state.player.field.map(c => ({ ...c }));
  const displayEnemy  = state.enemy.field.map(c => ({ ...c }));

  // Прогон боя — state мутируется
  G.resolveBattle(state);
  const events = state.battleEvents.slice();
  const postPlayer = state.player.field;
  const postEnemy  = state.enemy.field;

  // Показываем «до боя»
  state.player.field = displayPlayer;
  state.enemy.field  = displayEnemy;
  render();
  await sleep(250);

  // Проигрываем события
  for (const ev of events) {
    flashEvent(ev);
    applyEventToField(state.player.field, state.enemy.field, ev);
    render();
    await sleep(eventDuration(ev));
  }

  // Возвращаем финальные поля
  state.player.field = postPlayer;
  state.enemy.field  = postEnemy;
  isAnimating = false;
  render();
}

// ============================================================
// Экран боя
// ============================================================

function renderBattleScreen() {
  app.appendChild(renderTopBar());

  const header = document.createElement('div');
  header.className = 'header';

  const stats = [
    `🌀 Ход ${state!.turn}`,
    `🎴 Дека: ${state!.deckIds.length}`,
    `📚 Осталось: ${state!.player.deck.length}`,
    `✋ Рука: ${state!.player.hand.length}`,
    `🪦 Потеряно: ${state!.player.lost.length}`,
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
  invBtn.disabled = isAnimating;
  invBtn.onclick = () => { G.toggleInventory(state!); render(); };
  header.appendChild(invBtn);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'icon-btn';
  menuBtn.textContent = '☰ Меню';
  menuBtn.disabled = isAnimating;
  menuBtn.onclick = () => { G.goToMenu(state!); render(); };
  header.appendChild(menuBtn);

  app.appendChild(header);

  app.appendChild(row('Враг', state!.enemy.field));
  app.appendChild(row('Ваше поле', state!.player.field));

  const handRow = row('Рука', state!.player.hand, (c) => {
    if (isAnimating) return;
    if (G.placeCard(state!, c.instanceId)) render();
  });
  handRow.classList.add('hand');
  app.appendChild(handRow);

  const controls = document.createElement('div');
  controls.className = 'controls';
  if (state!.phase === 'placing') {
    const btn = document.createElement('button');
    btn.textContent = isAnimating ? '⚔️ Бой...' : '⚔️ В бой';
    btn.disabled = state!.player.field.length === 0 || isAnimating;
    btn.onclick = () => { animateBattle(); };
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
    cards.appendChild(cardEl(c, {
      onClick: () => {
        G.takeSpoil(state!, c.instanceId);
        render();
      },
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
  h2.textContent = '📦 Коллекция';
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
// Главный рендер
// ============================================================

function render() {
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