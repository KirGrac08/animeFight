import {
  CATALOG, RARITY_WEIGHTS, REGEN_AMOUNT,
  SHIELD_ON_SPAWN, SPLASH_DIVISOR, STARTER_DECK,
  PACK_PRICE, REWARD_WIN, REWARD_FLAWLESS,
  MIN_DECK_SIZE, MAX_DECK_SIZE, MAX_FIELD_SIZE,
} from './cards';
import { RNG } from './rng';
import type { AbilityId, BattleEvent, CardId, CardInstance, MenuTab, Phase, Screen, Side } from './types';

export type InventorySort = 'default' | 'name' | 'attack' | 'health' | 'rarity';
export type InventoryFilter = 'all' | 'common' | 'rare' | 'epic';

export const SAVE_VERSION = 7;

export interface Deck {
  id: string;
  name: string;
  cardIds: string[];
}

export interface GameState {
  version: number;
  rng: RNG;
  turn: number;
  phase: Phase;
  player: Side;
  enemy: Side;
  packs: number;
  crystals: number;
  log: string[];
  battleEvents: BattleEvent[];

  collection: CardInstance[];
  decks: Deck[];
  activeDeckId: string;
  spoils: CardInstance[];
  showInventory: boolean;

  screen: Screen;
  menuTab: MenuTab;
  inventorySort: InventorySort;
  inventoryFilter: InventoryFilter;
}

let idCounter = 0;

// ---------- ХЕЛПЕРЫ ----------

export function defHasAbility(defId: CardId, ability: AbilityId): boolean {
  return CATALOG[defId].abilities.includes(ability);
}

export function hasAbility(card: CardInstance, ability: AbilityId): boolean {
  return defHasAbility(card.defId, ability);
}

export function getActiveDeck(state: GameState): Deck {
  return state.decks.find(d => d.id === state.activeDeckId) ?? state.decks[0];
}

export function getDeckIds(state: GameState): string[] {
  return getActiveDeck(state).cardIds;
}

export function isInActiveDeck(state: GameState, instanceId: string): boolean {
  return getDeckIds(state).includes(instanceId);
}

function instantiate(defId: CardId): CardInstance {
  const def = CATALOG[defId];
  return {
    instanceId: `c${++idCounter}`,
    defId,
    currentHp: def.health,
    shield: defHasAbility(defId, 'shield') ? SHIELD_ON_SPAWN : 0,
    poison: 0,
  };
}

function emptySide(): Side {
  return { deck: [], hand: [], field: [], lost: [] };
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeckId(): string {
  return `deck-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Всё, что было в колоде, перекладываем в руку
function drawAllToHand(state: GameState): void {
  const s = state.player;
  s.hand.push(...s.deck);
  s.deck = [];
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------

export function createInitialState(seed?: number): GameState {
  const deck = STARTER_DECK.map(instantiate);
  const firstDeck: Deck = {
    id: newDeckId(),
    name: 'Стартовая',
    cardIds: deck.map(c => c.instanceId),
  };
  const state: GameState = {
    version: SAVE_VERSION,
    rng: new RNG(seed),
    turn: 1,
    phase: 'placing',
    player: { ...emptySide(), deck: [...deck] },
    enemy: emptySide(),
    packs: 1,
    crystals: 0,
    log: ['Добро пожаловать.'],
    battleEvents: [],
    collection: [...deck],
    decks: [firstDeck],
    activeDeckId: firstDeck.id,
    spoils: [],
    showInventory: false,
    screen: 'menu',
    menuTab: 'battle',
    inventorySort: 'default',
    inventoryFilter: 'all',
  };
  rebuildDeck(state);
  drawAllToHand(state);
  spawnEnemyWave(state);
  return state;
}

function rebuildDeck(state: GameState): void {
  const ids = new Set(getDeckIds(state));
  const cards = state.collection.filter(c => ids.has(c.instanceId));
  state.player.deck = shuffle(cards, state.rng);
}

function spawnEnemyWave(state: GameState): void {
  const pool: CardId[] = ['goblin', 'slime', 'archer', 'knight'];
  if (state.turn > 4) pool.push('mage', 'vampire');
  if (state.turn > 6) pool.push('berserker');
  if (state.turn > 8) pool.push('dragon');

  const count = Math.min(MAX_FIELD_SIZE, 1 + Math.floor(state.turn / 2));
  state.enemy.field = [];
  for (let i = 0; i < count; i++) {
    state.enemy.field.push(instantiate(state.rng.pick(pool)));
  }
}

// ---------- УПРАВЛЕНИЕ КОЛОДАМИ ----------

export function createDeck(state: GameState, name?: string): Deck {
  const deck: Deck = {
    id: newDeckId(),
    name: name ?? `Колода ${state.decks.length + 1}`,
    cardIds: [],
  };
  state.decks.push(deck);
  state.activeDeckId = deck.id;
  return deck;
}

export function deleteDeck(state: GameState, deckId: string): boolean {
  if (state.decks.length <= 1) return false;
  const idx = state.decks.findIndex(d => d.id === deckId);
  if (idx === -1) return false;
  state.decks.splice(idx, 1);
  if (state.activeDeckId === deckId) {
    state.activeDeckId = state.decks[0].id;
  }
  refreshPlayerDeckIfSafe(state);
  return true;
}

export function renameDeck(state: GameState, deckId: string, name: string): boolean {
  const deck = state.decks.find(d => d.id === deckId);
  if (!deck) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  deck.name = trimmed.slice(0, 30);
  return true;
}

export function setActiveDeck(state: GameState, deckId: string): boolean {
  if (!state.decks.some(d => d.id === deckId)) return false;
  state.activeDeckId = deckId;
  refreshPlayerDeckIfSafe(state);
  return true;
}

export function isDeckReady(state: GameState): boolean {
  return getDeckIds(state).length >= MIN_DECK_SIZE;
}

export function toggleCardInDeck(state: GameState, instanceId: string): boolean {
  const safe = state.screen === 'menu' ||
    (state.phase === 'placing' && state.player.field.length === 0);
  if (!safe) return false;

  const inCollection = state.collection.some(c => c.instanceId === instanceId);
  if (!inCollection) return false;

  const deck = getActiveDeck(state);
  const idx = deck.cardIds.indexOf(instanceId);

  if (idx >= 0) {
    if (deck.cardIds.length <= MIN_DECK_SIZE) return false;
    deck.cardIds.splice(idx, 1);
  } else {
    if (deck.cardIds.length >= MAX_DECK_SIZE) return false;
    deck.cardIds.push(instanceId);
  }

  refreshPlayerDeckIfSafe(state);
  return true;
}

function refreshPlayerDeckIfSafe(state: GameState): void {
  const safe = state.screen === 'menu' ||
    (state.phase === 'placing' && state.player.field.length === 0);
  if (!safe) return;

  state.player.hand = [];
  state.player.field = [];
  rebuildDeck(state);
  drawAllToHand(state);
}

// ---------- ДЕЙСТВИЯ В БОЮ ----------

export function placeCard(state: GameState, instanceId: string): boolean {
  if (state.phase !== 'placing') return false;
  if (state.player.field.length >= MAX_FIELD_SIZE) return false;
  const idx = state.player.hand.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return false;
  const [card] = state.player.hand.splice(idx, 1);
  state.player.field.push(card);
  return true;
}

// ---------- СОРТИРОВКА / ФИЛЬТР ----------

export function setInventorySort(state: GameState, sort: InventorySort): void {
  state.inventorySort = sort;
}

export function setInventoryFilter(state: GameState, filter: InventoryFilter): void {
  state.inventoryFilter = filter;
}

// ---------- НАВИГАЦИЯ ----------

export function goToMenu(state: GameState): void {
  state.screen = 'menu';
  state.showInventory = false;
}

export function goToBattle(state: GameState): void {
  if (!isDeckReady(state)) return;
  state.screen = 'battle';
  state.showInventory = false;
}

export function setMenuTab(state: GameState, tab: MenuTab): void {
  state.menuTab = tab;
}

export function toggleInventory(state: GameState): void {
  state.showInventory = !state.showInventory;
}

// ---------- БОЙ ----------

export function resolveBattle(state: GameState): void {
  if (state.phase !== 'placing' || state.player.field.length === 0) return;
  state.phase = 'battle';
  state.log = [];
  state.battleEvents = [];

  tickStartOfTurn(state.player.field, state.log, 'Ваш', state.battleEvents);
  tickStartOfTurn(state.enemy.field,  state.log, 'Вражеский', state.battleEvents);

  const playerDead: CardInstance[] = [];
  const enemyDead:  CardInstance[] = [];

  playerDead.push(...cleanupField(state.player, state.log, true, state.battleEvents));
  enemyDead.push(...cleanupField(state.enemy,  state.log, false, state.battleEvents));

  const p = state.player.field;
  const e = state.enemy.field;
  const pairs = Math.max(p.length, e.length);

  for (let i = 0; i < pairs; i++) {
    const pc = p[i];
    const ec = e[i];
    if (pc && pc.currentHp > 0 && ec && ec.currentHp > 0) {
      fightPair(pc, ec, i, state);
    }
  }

  playerDead.push(...cleanupField(state.player, state.log, true, state.battleEvents));
  enemyDead.push(...cleanupField(state.enemy,  state.log, false, state.battleEvents));

  if (playerDead.length > 0) {
    const deadIds = new Set(playerDead.map(c => c.instanceId));
    state.collection = state.collection.filter(c => !deadIds.has(c.instanceId));
    for (const deck of state.decks) {
      deck.cardIds = deck.cardIds.filter(id => !deadIds.has(id));
    }
  }

  // Трофеи копятся всё сражение
  if (enemyDead.length > 0) {
    state.spoils.push(...enemyDead.map(c => instantiate(c.defId)));
  }

  awardCrystals(state, playerDead);

  state.turn++;

  const totalDeck =
    state.player.deck.length + state.player.hand.length + state.player.field.length;

  if (totalDeck === 0) {
    state.packs++;
    state.log.push('🎁 Сражение окончено. Все карты потеряны — доступен пак!');

    if (state.spoils.length > 0) {
      state.phase = 'spoils';
      state.log.push(`🏆 Трофеи за сражение: ${state.spoils.length}. Выберите одну!`);
    } else {
      state.phase = 'pack';
    }
    return;
  }

  startNextRound(state);
}

export function startNextRound(state: GameState): void {
  state.player.field = [];
  state.player.hand = [];
  rebuildDeck(state);
  state.phase = 'placing';
  drawAllToHand(state);
  spawnEnemyWave(state);
}

function awardCrystals(state: GameState, playerDead: CardInstance[]): void {
  const survived = state.player.field.length;

  if (survived === 0) {
    state.log.push(`❌ Поражение в раунде. 💎 +0`);
    return;
  }

  if (playerDead.length === 0) {
    state.crystals += REWARD_FLAWLESS;
    state.log.push(`✨ Победа без потерь! 💎 +${REWARD_FLAWLESS}`);
  } else {
    state.crystals += REWARD_WIN;
    state.log.push(`✅ Победа. 💎 +${REWARD_WIN}`);
  }
}

function tickStartOfTurn(field: CardInstance[], log: string[], owner: string, events: BattleEvent[]): void {
  for (const card of field) {
    if (card.currentHp <= 0) continue;
    const def = CATALOG[card.defId];

    if (hasAbility(card, 'regen') && card.currentHp < def.health) {
      const healed = Math.min(REGEN_AMOUNT, def.health - card.currentHp);
      card.currentHp += healed;
      log.push(`💚 ${owner} ${def.name} +${healed} HP`);
      events.push({ type: 'heal', targetId: card.instanceId, amount: healed });
    }

    if (card.poison > 0) {
      card.currentHp -= card.poison;
      log.push(`☠️ ${owner} ${def.name} получает ${card.poison} от яда`);
      events.push({ type: 'poisonTick', targetId: card.instanceId, damage: card.poison });
      card.poison--;
    }
  }
}

function cleanupField(side: Side, log: string[], isPlayer: boolean, events: BattleEvent[]): CardInstance[] {
  const dead: CardInstance[] = [];
  side.field = side.field.filter(c => {
    if (c.currentHp <= 0) {
      dead.push(c);
      if (isPlayer) {
        side.lost.push(c);
        log.push(`💀 ${CATALOG[c.defId].name} потерян навсегда`);
      }
      events.push({
        type: 'death',
        cardId: c.instanceId,
        side: isPlayer ? 'player' : 'enemy',
      });
      return false;
    }
    return true;
  });
  return dead;
}

function fightPair(pc: CardInstance, ec: CardInstance, idx: number, state: GameState): void {
  const pDef = CATALOG[pc.defId];
  const eDef = CATALOG[ec.defId];

  const pcFirst = hasAbility(pc, 'first_strike');
  const ecFirst = hasAbility(ec, 'first_strike');

  if (pcFirst && !ecFirst) {
    doAttack(pc, ec, state);
    if (ec.currentHp > 0) doAttack(ec, pc, state);
  } else if (ecFirst && !pcFirst) {
    doAttack(ec, pc, state);
    if (pc.currentHp > 0) doAttack(pc, ec, state);
  } else {
    doAttack(pc, ec, state);
    doAttack(ec, pc, state);
  }

  if (hasAbility(pc, 'splash')) {
    const dmg = Math.floor(pDef.attack / SPLASH_DIVISOR);
    splashAround(state.enemy.field, idx, dmg, state, `💥 Ваш ${pDef.name} задевает`);
  }
  if (hasAbility(ec, 'splash')) {
    const dmg = Math.floor(eDef.attack / SPLASH_DIVISOR);
    splashAround(state.player.field, idx, dmg, state, `💥 Вражеский ${eDef.name} задевает`);
  }
}

function doAttack(attacker: CardInstance, defender: CardInstance, state: GameState): void {
  const aDef = CATALOG[attacker.defId];
  const dDef = CATALOG[defender.defId];
  const hits = hasAbility(attacker, 'double_strike') ? 2 : 1;
  for (let h = 0; h < hits; h++) {
    if (defender.currentHp <= 0) break;
    strikeOnce(attacker, defender, aDef, dDef, state, h === 0);
  }
}

function strikeOnce(
  attacker: CardInstance,
  defender: CardInstance,
  aDef: { name: string; art: string; attack: number; health: number },
  dDef: { name: string; art: string },
  state: GameState,
  logHit: boolean,
): void {
  if (logHit) {
    state.log.push(`${aDef.art} ${aDef.name} → ${dDef.art} ${dDef.name} (${aDef.attack})`);
  }

  let dmg = aDef.attack;

  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg);
    defender.shield -= absorbed;
    dmg -= absorbed;
    if (absorbed > 0) {
      state.log.push(`🛡️ ${dDef.name} поглощает ${absorbed}`);
      state.battleEvents.push({ type: 'shield', targetId: defender.instanceId, absorbed });
    }
  }

  defender.currentHp -= dmg;

  state.battleEvents.push({
    type: 'attack',
    attackerId: attacker.instanceId,
    defenderId: defender.instanceId,
    damage: dmg,
  });

  if (hasAbility(attacker, 'lifesteal') && dmg > 0) {
    const before = attacker.currentHp;
    attacker.currentHp = Math.min(attacker.currentHp + dmg, aDef.health);
    const healed = attacker.currentHp - before;
    if (healed > 0) {
      state.log.push(`🩸 ${aDef.name} +${healed} HP`);
      state.battleEvents.push({ type: 'heal', targetId: attacker.instanceId, amount: healed });
    }
  }

  if (hasAbility(attacker, 'poison') && defender.currentHp > 0) {
    defender.poison += 1;
    state.log.push(`☠️ ${dDef.name} отравлен (${defender.poison})`);
    state.battleEvents.push({ type: 'poison', targetId: defender.instanceId, stacks: defender.poison });
  }
}

function splashAround(
  field: CardInstance[],
  targetIdx: number,
  dmg: number,
  state: GameState,
  prefix: string,
): void {
  if (dmg <= 0) return;
  for (const offset of [-1, 1]) {
    const neighbor = field[targetIdx + offset];
    if (!neighbor || neighbor.currentHp <= 0) continue;
    let d = dmg;
    if (neighbor.shield > 0) {
      const absorbed = Math.min(neighbor.shield, d);
      neighbor.shield -= absorbed;
      d -= absorbed;
      if (absorbed > 0) {
        state.battleEvents.push({ type: 'shield', targetId: neighbor.instanceId, absorbed });
      }
    }
    neighbor.currentHp -= d;
    state.log.push(`${prefix} ${CATALOG[neighbor.defId].name} (${d})`);
    if (d > 0) {
      state.battleEvents.push({ type: 'splash', targetId: neighbor.instanceId, damage: d });
    }
  }
}

// ---------- ТРОФЕИ ----------

export function takeSpoil(state: GameState, instanceId: string): void {
  if (state.phase !== 'spoils') return;
  const idx = state.spoils.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return;
  const [card] = state.spoils.splice(idx, 1);
  state.collection.push(card);

  const deck = getActiveDeck(state);
  if (deck.cardIds.length < MAX_DECK_SIZE) {
    deck.cardIds.push(card.instanceId);
  }

  state.log.push(`🏆 Получено: ${CATALOG[card.defId].name}`);
  state.spoils = [];
  state.phase = 'pack';
}

export function skipSpoils(state: GameState): void {
  if (state.phase !== 'spoils') return;
  state.spoils = [];
  state.log.push('Трофеи пропущены.');
  state.phase = 'pack';
}

// ---------- ПАКИ ----------

function rollPackCards(state: GameState): CardInstance[] {
  const pool = Object.values(CATALOG);
  const rolled: CardInstance[] = [];
  const deck = getActiveDeck(state);

  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity(state.rng, RARITY_WEIGHTS);
    const candidates = pool.filter(c => c.rarity === rarity);
    const def = state.rng.pick(candidates.length ? candidates : pool);
    const card = instantiate(def.id);
    state.collection.push(card);
    if (deck.cardIds.length < MAX_DECK_SIZE) {
      deck.cardIds.push(card.instanceId);
    }
    rolled.push(card);
  }
  return rolled;
}

export function openPack(state: GameState): void {
  if (state.packs <= 0) return;
  state.packs--;
  const rolled = rollPackCards(state);
  state.log = [`🎁 Пак: ${rolled.map(c => CATALOG[c.defId].name).join(', ')}`];

  if (state.phase === 'pack') {
    startNextRound(state);
  } else if (state.screen === 'menu') {
    rebuildDeck(state);
    drawAllToHand(state);
  }
}

export function buyPack(state: GameState): boolean {
  if (state.crystals < PACK_PRICE) return false;
  state.crystals -= PACK_PRICE;
  const rolled = rollPackCards(state);
  state.log = [`💎 Куплен пак за ${PACK_PRICE}: ${rolled.map(c => CATALOG[c.defId].name).join(', ')}`];

  if (state.screen === 'menu') {
    rebuildDeck(state);
    drawAllToHand(state);
  }
  return true;
}

function rollRarity(rng: RNG, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

// ---------- СОРТИРОВКА / ФИЛЬТР ----------

const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2 };

export function sortAndFilterCollection(state: GameState): CardInstance[] {
  const filter = state.inventoryFilter;
  const sort = state.inventorySort;

  let list = state.collection.slice();
  if (filter !== 'all') {
    list = list.filter(c => CATALOG[c.defId].rarity === filter);
  }

  const byDef = new Map<string, { sample: CardInstance; count: number }>();
  for (const c of list) {
    const existing = byDef.get(c.defId);
    if (existing) existing.count++;
    else byDef.set(c.defId, { sample: c, count: 1 });
  }

  const grouped = [...byDef.values()];

  switch (sort) {
    case 'name':
      grouped.sort((a, b) => CATALOG[a.sample.defId].name.localeCompare(CATALOG[b.sample.defId].name));
      break;
    case 'attack':
      grouped.sort((a, b) => CATALOG[b.sample.defId].attack - CATALOG[a.sample.defId].attack);
      break;
    case 'health':
      grouped.sort((a, b) => CATALOG[b.sample.defId].health - CATALOG[a.sample.defId].health);
      break;
    case 'rarity':
      grouped.sort((a, b) =>
        RARITY_ORDER[CATALOG[b.sample.defId].rarity] - RARITY_ORDER[CATALOG[a.sample.defId].rarity]
      );
      break;
  }

  return grouped.map(g => g.sample);
}

export function countByDefId(state: GameState, defId: CardId): number {
  return state.collection.filter(c => c.defId === defId).length;
}

export function countInActiveDeckByDefId(state: GameState, defId: CardId): number {
  const ids = new Set(getDeckIds(state));
  return state.collection.filter(c => c.defId === defId && ids.has(c.instanceId)).length;
}