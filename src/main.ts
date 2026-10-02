import './style.css';
import {
  ABILITY_INFO, CATALOG, PACK_PRICE,
  MIN_DECK_SIZE, MAX_DECK_SIZE,
  FIELD_SLOTS,
} from './core/cards';
import * as G from './core/game';
import * as Auth from './auth';
import type { CardInstance, MenuTab, BattleEvent } from './core/types';

const app = document.getElementById('app')!;

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

interface DragState {
  instanceId?: string;
  fromSlot?: number;
}
let drag: DragState | null = null;

let mergeMode = false;
let mergeSelected: string[] = [];

const ANIM = {
  beforeBattle:  500,
  afterBattle:   700,
  preAttack:     80,
  preDeath:      150,
  duration: {
    attack:      550,
    splash:      400,
    death:       650,
    poisonTick:  450,
    shield:      350,
    heal:        400,
    poison:      350,
    witchAura:   220,
  },
} as const;

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
  small?: boolean;
}

function cardEl(card: CardInstance, opts: CardOpts = {}): HTMLElement {
  const def = CATALOG[card.defId];
  const el = document.createElement('div');
  el.className = `card ${def.rarity}`;
  if (opts.small) el.classList.add('small');
  el.dataset.cardId = card.instanceId;
  el.dataset.attackType = def.attackType;

  if (opts.inDeck) el.classList.add('in-deck');
  if (opts.partialDeck) el.classList.add('partially-in-deck');

  const hpPct = Math.max(0, card.currentHp) / def.health;

  const abilityLines = def.abilities.map(
    a => `${ABILITY_INFO[a].icon} ${ABILITY_INFO[a].label} — ${ABILITY_INFO[a].desc}`,
  );
  el.title = [
    `${def.name} (${def.rarity}, ${def.attackType === 'ranged' ? 'дальний' : 'ближний'})`,
    `⚔ ${def.attack}   ❤ ${def.health}`,
    abilityLines.length ? '' : null,
    ...abilityLines,
  ].filter(Boolean).join('\n');

  const abilitiesIcons = def.abilities.map(a => ABILITY_INFO[a].icon).join(' ');
  const typeIcon = def.attackType === 'ranged' ? '🎯' : '💪';

  let badges = '';
  if (card.shield > 0) badges += `<div class="badge shield">🛡 ${card.shield}</div>`;
  if (card.poison > 0) badges += `<div class="badge poison">☠ ${card.poison}</div>`;

  el.innerHTML = `
    <div class="type-badge">${typeIcon}</div>
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

  const deckLabel = document.createElement('span');
  deckLabel.className = 'deck-label';
  const active = G.getActiveDeck(state!);
  deckLabel.textContent = `🎴 ${active.name} (${active.cardIds.length}/${MAX_DECK_SIZE})`;
  bar.appendChild(deckLabel);

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
    btn.onclick = () => {
      mergeMode = false;
      mergeSelected = [];
      G.setMenuTab(state!, id);
      render();
    };
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
  const active = G.getActiveDeck(state!);
  const deckReady = G.isDeckReady(state!);
  const deckSize = active.cardIds.length;

  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.innerHTML = `
    <h2>Тренировочный бой</h2>
    <p>Сразись с волной противников. Карты, потерянные в бою, исчезают навсегда.
    Выжившие остаются на поле. Победа: 💎 +1, без потерь: 💎 +3.</p>
    <div class="stats-row">
      <span>🎴 Колода: <b>${active.name}</b></span>
      <span>Размер: <b class="${deckReady ? 'ok' : 'bad'}">${deckSize} / ${MAX_DECK_SIZE}</b>
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
  btn.textContent = deckReady ? '⚔️ Начать бой' : `⚠️ Добавь карту (${deckSize}/${MIN_DECK_SIZE})`;
  btn.disabled = !deckReady;
  btn.onclick = () => { G.goToBattle(state!); render(); };
  btnRow.appendChild(btn);

  const toInv = document.createElement('button');
  toInv.className = 'btn-secondary';
  toInv.textContent = '📦 Колоды';
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

function deckSelector(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'deck-selector';

  const label = document.createElement('span');
  label.className = 'ctrl-label';
  label.textContent = 'Колода:';
  wrap.appendChild(label);

  const chips = document.createElement('div');
  chips.className = 'deck-chips';
  state!.decks.forEach(deck => {
    const chip = document.createElement('button');
    chip.className = `deck-chip ${deck.id === state!.activeDeckId ? 'active' : ''}`;
    chip.textContent = `${deck.name} (${deck.cardIds.length})`;
    chip.disabled = mergeMode;
    chip.onclick = () => { G.setActiveDeck(state!, deck.id); render(); };
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);

  const actions = document.createElement('div');
  actions.className = 'deck-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'chip';
  addBtn.textContent = '+ Новая';
  addBtn.disabled = mergeMode;
  addBtn.onclick = () => {
    const name = prompt('Название новой колоды:', `Колода ${state!.decks.length + 1}`);
    if (name === null) return;
    G.createDeck(state!, name || undefined);
    render();
  };
  actions.appendChild(addBtn);

  const renameBtn = document.createElement('button');
  renameBtn.className = 'chip';
  renameBtn.textContent = '✎ Переименовать';
  renameBtn.disabled = mergeMode;
  renameBtn.onclick = () => {
    const active = G.getActiveDeck(state!);
    const name = prompt('Новое название:', active.name);
    if (name === null) return;
    G.renameDeck(state!, active.id, name);
    render();
  };
  actions.appendChild(renameBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'chip danger';
  delBtn.textContent = '🗑 Удалить';
  delBtn.disabled = state!.decks.length <= 1 || mergeMode;
  delBtn.onclick = () => {
    const active = G.getActiveDeck(state!);
    if (!confirm(`Удалить колоду «${active.name}»?`)) return;
    G.deleteDeck(state!, active.id);
    render();
  };
  actions.appendChild(delBtn);

  wrap.appendChild(actions);
  return wrap;
}

function mergeBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'merge-bar';

  const hint = document.createElement('span');
  hint.className = 'merge-hint';
  if (!mergeMode) {
    hint.textContent = '🔮 Объедини 2 карты одной редкости, чтобы получить 1 карту выше.';
  } else if (mergeSelected.length === 0) {
    hint.textContent = 'Выбери первую карту';
  } else if (mergeSelected.length === 1) {
    hint.textContent = 'Выбери вторую карту той же редкости';
  } else {
    hint.textContent = 'Готово — нажми «Объединить»';
  }
  bar.appendChild(hint);

  const actions = document.createElement('div');
  actions.className = 'merge-actions';

  if (!mergeMode) {
    const startBtn = document.createElement('button');
    startBtn.className = 'chip';
    startBtn.textContent = '🔮 Объединить карты';
    startBtn.onclick = () => {
      mergeMode = true;
      mergeSelected = [];
      render();
    };
    actions.appendChild(startBtn);
  } else {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'chip';
    cancelBtn.textContent = '✕ Отмена';
    cancelBtn.onclick = () => {
      mergeMode = false;
      mergeSelected = [];
      render();
    };
    actions.appendChild(cancelBtn);

    if (mergeSelected.length === 2) {
      const mergeBtn = document.createElement('button');
      mergeBtn.className = 'chip active';
      mergeBtn.textContent = '🔮 Объединить';
      mergeBtn.onclick = () => {
        if (!state) return;
        const [id1, id2] = mergeSelected;
        const res = G.mergeCards(state, id1, id2);
        if (!res.ok) {
          alert(res.message);
          return;
        }
        mergeMode = false;
        mergeSelected = [];
        render();
      };
      actions.appendChild(mergeBtn);
    }
  }

  bar.appendChild(actions);
  return bar;
}

function inventoryContent(): HTMLElement {
  const wrap = document.createElement('div');

  wrap.appendChild(mergeBar());
  wrap.appendChild(deckSelector());

  const active = G.getActiveDeck(state!);
  const inDeck = active.cardIds.length;
  const ready = G.isDeckReady(state!);

  const deckInfo = document.createElement('div');
  deckInfo.className = 'deck-info';
  if (mergeMode) {
    deckInfo.innerHTML = `🔮 Выбрано: <b>${mergeSelected.length} / 2</b> — клик по карте для выбора`;
  } else {
    deckInfo.innerHTML = `
      🎴 В колоде «${active.name}»: <b class="${ready ? 'ok' : 'bad'}">${inDeck} / ${MAX_DECK_SIZE}</b>
      <small>(минимум ${MIN_DECK_SIZE}, максимум ${MAX_DECK_SIZE})</small>
      &nbsp;·&nbsp; клик по карте — добавить/убрать
    `;
  }
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
  colTitle.textContent = mergeMode
    ? `Выбор карт для объединения (${state!.collection.length})`
    : `Коллекция (${state!.collection.length})`;
  wrap.appendChild(colTitle);

  const colGrid = document.createElement('div');
  colGrid.className = 'inventory-grid';

  if (mergeMode) {
    // === РЕЖИМ ОБЪЕДИНЕНИЯ ===
    const allCards = G.sortedFilteredAllCards(state!);

    if (allCards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Пусто';
      colGrid.appendChild(empty);
    } else {
      allCards.forEach(card => {
        const isSelected = mergeSelected.includes(card.instanceId);
        const el = cardEl(card);
        el.classList.add('merge-card');
        el.dataset.merge = '1';
        if (isSelected) el.classList.add('merge-selected');

        // Если уже выбрана одна карта — несовместимые гасим
        if (mergeSelected.length === 1 && !isSelected) {
          const firstId = mergeSelected[0];
          const c1 = state!.collection.find(c => c.instanceId === firstId);
          const r1 = c1 ? CATALOG[c1.defId].rarity : '';
          const r2 = CATALOG[card.defId].rarity;
          if (r1 !== r2 || r1 === 'epic') {
            el.classList.add('merge-incompatible');
          }
        }

        colGrid.appendChild(el);
      });

      // Один обработчик на всю сетку — без дублей
      colGrid.onclick = (e) => {
        const target = (e.target as HTMLElement).closest('.card[data-merge]') as HTMLElement | null;
        if (!target) return;
        e.stopPropagation();
        e.preventDefault();

        const id = target.dataset.cardId;
        if (!id || !state) return;

        // Клик по уже выбранной — снять выбор
        const idx = mergeSelected.indexOf(id);
        if (idx >= 0) {
          mergeSelected.splice(idx, 1);
          render();
          return;
        }

        // Уже 2 — игнор
        if (mergeSelected.length >= 2) return;

        // Клик по первой
        if (mergeSelected.length === 0) {
          mergeSelected = [id];
          render();
          return;
        }

        // Клик по второй — проверяем совместимость
        const check = G.canMerge(state, mergeSelected[0], id);
        if (!check.ok) {
          // Несовместима — заменяем выбор этой картой
          mergeSelected = [id];
          render();
          return;
        }

        mergeSelected = [mergeSelected[0], id];
        render();
      };
    }
  } else {
    // === ОБЫЧНЫЙ РЕЖИМ ===
    const visible = G.sortAndFilterCollection(state!);

    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Пусто';
      colGrid.appendChild(empty);
    } else {
      visible.forEach(sample => {
        const count = G.countByDefId(state!, sample.defId);
        const inDeckCount = G.countInActiveDeckByDefId(state!, sample.defId);
        const allInDeck = inDeckCount === count && count > 0;
        const someInDeck = inDeckCount > 0 && inDeckCount < count;

        const el = cardEl(sample, {
          showCount: count,
          inDeck: allInDeck,
          partialDeck: someInDeck,
          deckToggle: () => {
            const copies = state!.collection.filter(c => c.defId === sample.defId);
            const target = allInDeck
              ? copies.find(c => G.isInActiveDeck(state!, c.instanceId))
              : copies.find(c => !G.isInActiveDeck(state!, c.instanceId));
            if (!target) return;
            G.toggleCardInDeck(state!, target.instanceId);
            render();
          },
        });
        colGrid.appendChild(el);
      });
    }
  }
  wrap.appendChild(colGrid);

  if (state!.player.lost.length > 0 && !mergeMode) {
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
// Игровое поле
// ============================================================

function renderBoardSide(
  side: 'player' | 'enemy',
  field: (CardInstance | null)[],
  interactive: boolean,
): HTMLElement {
  const board = document.createElement('div');
  board.className = `board board-${side}`;

  const orderedSlots = [4, 5, 6, 7, 0, 1, 2, 3];

  orderedSlots.forEach((slot, idx) => {
    if (idx === 4) {
      const divider = document.createElement('div');
      divider.className = 'board-divider';
      board.appendChild(divider);
    }

    const cell = document.createElement('div');
    cell.className = 'slot';
    cell.dataset.slot = String(slot);
    cell.dataset.side = side;

    if (idx < 4) cell.classList.add('back-row');
    else cell.classList.add('front-row');

    const card = field[slot];
    if (card) {
      const el = cardEl(card, { small: true });

      if (interactive) {
        el.classList.add('draggable');
        el.setAttribute('draggable', 'true');

        el.addEventListener('dragstart', (e) => {
          drag = { fromSlot: slot };
          e.dataTransfer?.setData('text/plain', card.instanceId);
          e.dataTransfer!.effectAllowed = 'move';
          el.classList.add('dragging');
        });
        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
        });

        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (!state) return;
          if (state.phase !== 'placing') return;
          G.returnCardToHand(state, slot);
          render();
        });
      }

      cell.appendChild(el);
      cell.classList.add('occupied');
    } else {
      const empty = document.createElement('div');
      empty.className = 'slot-empty';
      cell.appendChild(empty);
    }

    if (interactive) {
      setupDropTarget(cell, side, slot);
    }

    board.appendChild(cell);
  });

  return board;
}

function setupDropTarget(cell: HTMLElement, side: 'player' | 'enemy', slot: number): void {
  cell.addEventListener('dragover', (e) => {
    if (side !== 'player') return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    cell.classList.add('drop-hover');
  });
  cell.addEventListener('dragleave', () => {
    cell.classList.remove('drop-hover');
  });
  cell.addEventListener('drop', (e) => {
    if (side !== 'player') return;
    e.preventDefault();
    e.stopPropagation();
    cell.classList.remove('drop-hover');
    if (!state || !drag) return;

    if (drag.instanceId) {
      G.placeCardInSlot(state, drag.instanceId, slot);
    } else if (drag.fromSlot !== undefined) {
      G.swapSlots(state, drag.fromSlot, slot);
    }
    drag = null;
    render();
  });
}

// ============================================================
// Рука
// ============================================================

function renderHand(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'hand';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `Рука (${state!.player.hand.length}) — перетащи в слот или кликни`;
  wrap.appendChild(label);

  const field = document.createElement('div');
  field.className = 'hand-field';

  setupHandDropZone(field);

  if (state!.player.hand.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Рука пуста';
    field.appendChild(empty);
  } else {
    state!.player.hand.forEach(card => {
      const el = cardEl(card, { small: true });
      el.classList.add('draggable', 'in-hand');
      el.setAttribute('draggable', 'true');

      el.addEventListener('dragstart', (e) => {
        drag = { instanceId: card.instanceId };
        e.dataTransfer?.setData('text/plain', card.instanceId);
        e.dataTransfer!.effectAllowed = 'move';
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      el.addEventListener('click', () => {
        if (!state) return;
        if (state.phase !== 'placing') return;
        const free = state.player.field.findIndex(s => s === null);
        if (free === -1) {
          alert('Все слоты заняты. Верни карту с поля или начни бой.');
          return;
        }
        G.placeCardInSlot(state, card.instanceId, free);
        render();
      });

      field.appendChild(el);
    });
  }

  wrap.appendChild(field);
  return wrap;
}

function setupHandDropZone(zone: HTMLElement): void {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    zone.classList.add('drop-hover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-hover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drop-hover');
    if (!state || !drag) return;
    if (drag.fromSlot !== undefined) {
      G.returnCardToHand(state, drag.fromSlot);
      drag = null;
      render();
    }
  });
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
    `✋ Рука: ${state!.player.hand.length}`,
    `⚔ На поле: ${G.aliveCount(state!.player)}/${FIELD_SLOTS}`,
    `🪦 Потеряно: ${state!.player.lost.length}`,
    `🏆 Трофеи: ${state!.spoils.length}`,
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

  const arena = document.createElement('div');
  arena.className = 'arena';

  const enemyLabel = document.createElement('div');
  enemyLabel.className = 'arena-label';
  enemyLabel.textContent = '🔴 ПРОТИВНИК';
  arena.appendChild(enemyLabel);

  arena.appendChild(renderBoardSide('enemy', state!.enemy.field, false));

  const centerLine = document.createElement('div');
  centerLine.className = 'arena-center';
  arena.appendChild(centerLine);

  arena.appendChild(renderBoardSide('player', state!.player.field, !isAnimating));

  const playerLabel = document.createElement('div');
  playerLabel.className = 'arena-label';
  playerLabel.textContent = '🟢 ВЫ';
  arena.appendChild(playerLabel);

  app.appendChild(arena);

  app.appendChild(renderHand());

  const controls = document.createElement('div');
  controls.className = 'controls';

  if (isAnimating) {
    const btn = document.createElement('button');
    btn.textContent = '⚔️ Бой...';
    btn.disabled = true;
    controls.appendChild(btn);
  } else if (state!.phase === 'placing') {
    const btn = document.createElement('button');
    btn.textContent = '⚔️ В бой';
    btn.disabled = G.aliveCount(state!.player) === 0;
    btn.onclick = () => { animateBattle(); };
    controls.appendChild(btn);
  } else if (state!.phase === 'pack') {
    const btn = document.createElement('button');
    btn.className = 'pack';
    btn.textContent = '🎁 Открыть пак';
    btn.onclick = () => { G.openPack(state!); render(); };
    controls.appendChild(btn);

    const toMenuBtn = document.createElement('button');
    toMenuBtn.className = 'btn-secondary';
    toMenuBtn.textContent = '↩ Вернуться в меню';
    toMenuBtn.onclick = () => { G.goToMenu(state!); render(); };
    controls.appendChild(toMenuBtn);
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

  if (!isAnimating) {
    if (state!.phase === 'spoils') renderSpoilsOverlay();
    if (state!.showInventory)     renderInventoryOverlay();
  }
}

// ============================================================
// Анимации боя
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function eventDuration(ev: BattleEvent): number {
  switch (ev.type) {
    case 'attack':     return ANIM.duration.attack;
    case 'splash':     return ANIM.duration.splash;
    case 'death':      return ANIM.duration.death;
    case 'poisonTick': return ANIM.duration.poisonTick;
    case 'shield':     return ANIM.duration.shield;
    case 'heal':       return ANIM.duration.heal;
    case 'poison':     return ANIM.duration.poison;
    case 'witchAura':  return ANIM.duration.witchAura;
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
      }, 400);
      break;
    case 'splash':
      getCardEl(ev.targetId)?.classList.add('hit');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('hit'), 350);
      break;
    case 'heal':
      getCardEl(ev.targetId)?.classList.add('healed');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('healed'), 400);
      break;
    case 'shield':
      getCardEl(ev.targetId)?.classList.add('shielded');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('shielded'), 350);
      break;
    case 'poison':
    case 'poisonTick':
    case 'witchAura':
      getCardEl(ev.targetId)?.classList.add('poisoned');
      setTimeout(() => getCardEl(ev.targetId)?.classList.remove('poisoned'), 350);
      break;
    case 'death':
      getCardEl(ev.cardId)?.classList.add('dying');
      break;
  }
}

function applyEventToField(
  player: (CardInstance | null)[],
  enemy: (CardInstance | null)[],
  ev: BattleEvent,
): void {
  const find = (id: string): CardInstance | undefined => {
    for (const c of [...player, ...enemy]) {
      if (c && c.instanceId === id) return c;
    }
    return undefined;
  };

  const removeCard = (arr: (CardInstance | null)[], id: string): void => {
    const idx = arr.findIndex(c => c && c.instanceId === id);
    if (idx >= 0) arr[idx] = null;
  };

  switch (ev.type) {
    case 'attack': {
      const target = find(ev.defenderId);
      if (target) target.currentHp -= ev.damage;
      break;
    }
    case 'poisonTick':
    case 'splash':
    case 'witchAura': {
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
      removeCard(arr, ev.cardId);
      break;
    }
  }
}

function getCardById(id: string): CardInstance | undefined {
  if (!state) return undefined;
  for (const c of [...state.player.field, ...state.enemy.field]) {
    if (c && c.instanceId === id) return c;
  }
  return undefined;
}

function updateCardDom(id: string, card: CardInstance | undefined): void {
  if (!card) return;
  const el = getCardEl(id);
  if (!el) return;

  const def = CATALOG[card.defId];

  const hpText = el.querySelector('.hp');
  if (hpText) hpText.textContent = `❤ ${Math.max(0, card.currentHp)}/${def.health}`;

  const hpBarInner = el.querySelector<HTMLElement>('.hpbar > div');
  if (hpBarInner) {
    const pct = Math.max(0, card.currentHp) / def.health;
    hpBarInner.style.width = `${pct * 100}%`;
  }

  let shieldBadge = el.querySelector<HTMLElement>('.badge.shield');
  if (card.shield > 0) {
    if (!shieldBadge) {
      shieldBadge = document.createElement('div');
      shieldBadge.className = 'badge shield';
      el.appendChild(shieldBadge);
    }
    shieldBadge.textContent = `🛡 ${card.shield}`;
  } else if (shieldBadge) {
    shieldBadge.remove();
  }

  let poisonBadge = el.querySelector<HTMLElement>('.badge.poison');
  if (card.poison > 0) {
    if (!poisonBadge) {
      poisonBadge = document.createElement('div');
      poisonBadge.className = 'badge poison';
      el.appendChild(poisonBadge);
    }
    poisonBadge.textContent = `☠ ${card.poison}`;
  } else if (poisonBadge) {
    poisonBadge.remove();
  }
}

function removeCardDom(id: string): void {
  const el = getCardEl(id);
  if (!el) return;
  setTimeout(() => {
    const parent = el.parentElement;
    el.remove();
    if (parent && !parent.querySelector('.card')) {
      parent.classList.remove('occupied');
      const empty = document.createElement('div');
      empty.className = 'slot-empty';
      parent.appendChild(empty);
    }
  }, ANIM.duration.death);
}

async function animateBattle(): Promise<void> {
  if (!state || isAnimating) return;
  if (state.phase !== 'placing') return;
  if (G.aliveCount(state.player) === 0) return;

  isAnimating = true;

  const displayPlayer = state.player.field.map(c => c ? { ...c } : null);
  const displayEnemy  = state.enemy.field.map(c => c ? { ...c } : null);

  G.resolveBattle(state);
  const events = state.battleEvents.slice();
  const postPlayer = state.player.field;
  const postEnemy  = state.enemy.field;

  state.player.field = displayPlayer;
  state.enemy.field  = displayEnemy;
  render();
  await sleep(ANIM.beforeBattle);

  for (const ev of events) {
    if (ev.type === 'death')  await sleep(ANIM.preDeath);
    if (ev.type === 'attack') await sleep(ANIM.preAttack);

    flashEvent(ev);
    applyEventToField(state.player.field, state.enemy.field, ev);

    switch (ev.type) {
      case 'attack':
        updateCardDom(ev.defenderId, getCardById(ev.defenderId));
        break;
      case 'splash':
      case 'poisonTick':
      case 'heal':
      case 'shield':
      case 'poison':
      case 'witchAura':
        updateCardDom(ev.targetId, getCardById(ev.targetId));
        break;
      case 'death':
        removeCardDom(ev.cardId);
        break;
    }

    await sleep(eventDuration(ev));
  }

  state.player.field = postPlayer;
  state.enemy.field  = postEnemy;
  await sleep(ANIM.afterBattle);

  isAnimating = false;
  render();
}

// ============================================================
// Оверлеи
// ============================================================

function renderSpoilsOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'spoils-overlay';

  const title = document.createElement('div');
  title.className = 'spoils-title';
  title.textContent = '🏆 Трофеи за сражение';
  overlay.appendChild(title);

  const hint = document.createElement('div');
  hint.className = 'spoils-hint';
  hint.textContent = `Собрано за бой: ${state!.spoils.length}. Возьмите одну карту в коллекцию.`;
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
    if (e.target === overlay) {
      mergeMode = false;
      mergeSelected = [];
      G.toggleInventory(state!);
      render();
    }
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
  closeBtn.onclick = () => {
    mergeMode = false;
    mergeSelected = [];
    G.toggleInventory(state!);
    render();
  };
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