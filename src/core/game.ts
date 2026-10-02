import {
  CATALOG, RARITY_WEIGHTS, REGEN_AMOUNT,
  SHIELD_ON_SPAWN, SPLASH_DIVISOR, STARTER_DECK,
  PACK_PRICE, REWARD_WIN, REWARD_FLAWLESS,
  MIN_DECK_SIZE, MAX_DECK_SIZE,
  FIELD_COLS, FIELD_SLOTS, WITCH_POISON_CHANCE,
} from './cards';
import { RNG } from './rng';
import type { AbilityId, BattleEvent, CardId, CardInstance, MenuTab, Phase, Screen, Side } from './types';

export type InventorySort = 'default' | 'name' | 'attack' | 'health' | 'rarity';
export type InventoryFilter = 'all' | 'common' | 'rare' | 'epic';

export const SAVE_VERSION = 14;

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

// ---------- ГЕНЕРАЦИЯ ID ----------

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- ГЕОМЕТРИЯ ПОЛЯ ----------

export function slotRow(slot: number): number {
  return Math.floor(slot / FIELD_COLS);
}

export function slotCol(slot: number): number {
  return slot % FIELD_COLS;
}

export function frontOf(slot: number): number {
  return slotCol(slot);
}

export function backOf(slot: number): number {
  return FIELD_COLS + slotCol(slot);
}

// ---------- ХЕЛПЕРЫ ----------

export function defHasAbility(defId: CardId, ability: AbilityId): boolean {
  return CATALOG[defId].abilities.includes(ability);
}

export function hasAbility(card: CardInstance, ability: AbilityId): boolean {
  return defHasAbility(card.defId, ability);
}

export function isRanged(card: CardInstance): boolean {
  return CATALOG[card.defId].attackType === 'ranged';
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

export function fieldCards(side: Side): CardInstance[] {
  return side.field.filter((c): c is CardInstance => c !== null);
}

export function aliveCount(side: Side): number {
  return side.field.filter(c => c !== null && c.currentHp > 0).length;
}

export function emptySlots(side: Side): number {
  return side.field.filter(c => c === null).length;
}

function hasLivingWitch(field: (CardInstance | null)[]): boolean {
  return field.some(c => c !== null && c.currentHp > 0 && hasAbility(c, 'witch'));
}

function instantiate(defId: CardId): CardInstance {
  const def = CATALOG[defId];
  return {
    instanceId: genId(),
    defId,
    currentHp: def.health,
    shield: defHasAbility(defId, 'shield') ? SHIELD_ON_SPAWN : 0,
    poison: 0,
  };
}

function emptyField(): (CardInstance | null)[] {
  return new Array(FIELD_SLOTS).fill(null);
}

function emptySide(): Side {
  return { hand: [], field: emptyField(), lost: [] };
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
    player: emptySide(),
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
  refillHand(state);
  spawnEnemyWave(state);
  return state;
}

export function refillHand(state: GameState): void {
  const ids = new Set(getDeckIds(state));
  const onField = new Set(
    state.player.field.filter((c): c is CardInstance => c !== null).map(c => c.instanceId)
  );
  const inHand = new Set(state.player.hand.map(c => c.instanceId));

  const missing = state.collection.filter(
    c => ids.has(c.instanceId) && !onField.has(c.instanceId) && !inHand.has(c.instanceId)
  );
  state.player.hand.push(...shuffle(missing, state.rng));
}

function spawnEnemyWave(state: GameState): void {
  const melee: CardId[]  = ['goblin', 'slime', 'knight'];
  const ranged: CardId[] = ['archer'];
  if (state.turn > 4) { melee.push('vampire'); ranged.push('mage'); }
  if (state.turn > 6) { melee.push('berserker'); }
  if (state.turn > 8) { ranged.push('dragon'); }
  if (state.turn > 10) { ranged.push('witch'); }

  const frontSlots = [0, 1, 2, 3];
  const backSlots  = [4, 5, 6, 7];

  const maxNew = Math.min(6, 1 + Math.floor(state.turn / 2));
  let spawned = 0;

  for (const s of backSlots) {
    if (spawned >= maxNew) break;
    if (!state.enemy.field[s]) {
      state.enemy.field[s] = instantiate(state.rng.pick(ranged));
      spawned++;
    }
  }
  for (const s of frontSlots) {
    if (spawned >= maxNew) break;
    if (!state.enemy.field[s]) {
      state.enemy.field[s] = instantiate(state.rng.pick(melee));
      spawned++;
    }
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
  syncPlayerHandWithDeck(state);
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
  syncPlayerHandWithDeck(state);
  return true;
}

export function isDeckReady(state: GameState): boolean {
  return getDeckIds(state).length >= MIN_DECK_SIZE;
}

export function toggleCardInDeck(state: GameState, instanceId: string): boolean {
  const safe = state.screen === 'menu' ||
    (state.phase === 'placing' && aliveCount(state.player) === 0);
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

  syncPlayerHandWithDeck(state);
  return true;
}

function syncPlayerHandWithDeck(state: GameState): void {
  const safe = state.screen === 'menu' ||
    (state.phase === 'placing' && aliveCount(state.player) === 0);
  if (!safe) return;

  state.player.hand = [];
  refillHand(state);
}

// ---------- ДЕЙСТВИЯ НА ПОЛЕ ----------

export function placeCardInSlot(state: GameState, instanceId: string, slot: number): boolean {
  if (state.phase !== 'placing') return false;
  if (slot < 0 || slot >= FIELD_SLOTS) return false;
  if (state.player.field[slot]) return false;

  const idx = state.player.hand.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return false;

  const [card] = state.player.hand.splice(idx, 1);
  state.player.field[slot] = card;
  return true;
}

export function swapSlots(state: GameState, a: number, b: number): boolean {
  if (state.phase !== 'placing') return false;
  if (a === b) return false;
  if (a < 0 || a >= FIELD_SLOTS) return false;
  if (b < 0 || b >= FIELD_SLOTS) return false;

  const ca = state.player.field[a];
  const cb = state.player.field[b];
  if (!ca && !cb) return false;

  state.player.field[a] = cb;
  state.player.field[b] = ca;
  return true;
}

export function returnCardToHand(state: GameState, slot: number): boolean {
  if (state.phase !== 'placing') return false;
  if (slot < 0 || slot >= FIELD_SLOTS) return false;

  const card = state.player.field[slot];
  if (!card) return false;

  state.player.field[slot] = null;
  state.player.hand.push(card);
  return true;
}

// ---------- ОБЪЕДИНЕНИЕ КАРТ ----------

export interface MergeResult {
  ok: boolean;
  message: string;
  result?: CardInstance;
}

export function canMerge(state: GameState, id1: string, id2: string): { ok: boolean; reason: string } {
  if (id1 === id2) return { ok: false, reason: 'Нужны две разные карты' };

  const c1 = state.collection.find(c => c.instanceId === id1);
  const c2 = state.collection.find(c => c.instanceId === id2);
  if (!c1 || !c2) return { ok: false, reason: 'Карта не найдена в коллекции' };

  const onField = state.player.field.some(
    c => c && (c.instanceId === id1 || c.instanceId === id2)
  );
  if (onField) return { ok: false, reason: 'Карта на поле — сначала убери её' };

  const r1 = CATALOG[c1.defId].rarity;
  const r2 = CATALOG[c2.defId].rarity;

  if (r1 !== r2) return { ok: false, reason: 'Нужны карты одной редкости' };
  if (r1 === 'epic') return { ok: false, reason: 'Эпические карты нельзя объединять' };

  return { ok: true, reason: '' };
}

export function mergeCards(state: GameState, id1: string, id2: string): MergeResult {
  const check = canMerge(state, id1, id2);
  if (!check.ok) return { ok: false, message: check.reason };

  const c1 = state.collection.find(c => c.instanceId === id1)!;
  const c2 = state.collection.find(c => c.instanceId === id2)!;
  const d1 = CATALOG[c1.defId];
  const d2 = CATALOG[c2.defId];

  const targetRarity = d1.rarity === 'common' ? 'rare' : 'epic';
  const pool = Object.values(CATALOG).filter(c => c.rarity === targetRarity);

  if (pool.length === 0) {
    return { ok: false, message: 'Нет карт для результата' };
  }

  const toRemove = new Set([id1, id2]);
  state.collection = state.collection.filter(c => !toRemove.has(c.instanceId));
  for (const deck of state.decks) {
    deck.cardIds = deck.cardIds.filter(id => !toRemove.has(id));
  }

  const def = state.rng.pick(pool);
  const card = instantiate(def.id);
  state.collection.push(card);

  const activeDeck = getActiveDeck(state);
  if (activeDeck.cardIds.length < MAX_DECK_SIZE) {
    activeDeck.cardIds.push(card.instanceId);
  }

  state.log.push(`🔮 ${d1.name} + ${d2.name} → ${def.name}`);
  syncPlayerHandWithDeck(state);

  return { ok: true, message: `Получена: ${def.name}`, result: card };
}

// ---------- НАВИГАЦИЯ ----------

export function goToMenu(state: GameState): void {
  state.screen = 'menu';
  state.showInventory = false;
}

export function goToBattle(state: GameState): void {
  if (!isDeckReady(state)) return;

  const needsReset =
    state.phase === 'pack' ||
    state.phase === 'spoils' ||
    (aliveCount(state.player) === 0 && state.player.hand.length === 0);

  if (needsReset) {
    state.turn = 1;
    state.player.field = emptyField();
    state.player.hand = [];
    state.enemy.field = emptyField();
    state.spoils = [];
    state.log = ['Начало нового сражения.'];
    state.phase = 'placing';
    refillHand(state);
    spawnEnemyWave(state);
  }

  state.screen = 'battle';
  state.showInventory = false;
}

export function setMenuTab(state: GameState, tab: MenuTab): void {
  state.menuTab = tab;
}

export function toggleInventory(state: GameState): void {
  state.showInventory = !state.showInventory;
}

export function setInventorySort(state: GameState, sort: InventorySort): void {
  state.inventorySort = sort;
}

export function setInventoryFilter(state: GameState, filter: InventoryFilter): void {
  state.inventoryFilter = filter;
}

// ---------- БОЙ ----------

export function resolveBattle(state: GameState): void {
  if (state.phase !== 'placing') return;

  const anyPlayer = aliveCount(state.player) > 0;
  const anyEnemy  = aliveCount(state.enemy) > 0;
  if (!anyPlayer || !anyEnemy) return;

  state.phase = 'battle';
  state.log = [];
  state.battleEvents = [];

  tickStartOfTurn(state.player.field, state.enemy.field, state.log, 'Ваш',        state.battleEvents, state.rng);
  tickStartOfTurn(state.enemy.field,  state.player.field, state.log, 'Вражеский',  state.battleEvents, state.rng);

  const playerDead: CardInstance[] = [];
  const enemyDead:  CardInstance[] = [];

  playerDead.push(...cleanupField(state.player, state.log, true, state.battleEvents));
  enemyDead.push(...cleanupField(state.enemy,  state.log, false, state.battleEvents));

  const attacks: { attacker: CardInstance; defender: CardInstance; slot: number }[] = [];

  for (let s = 0; s < FIELD_SLOTS; s++) {
    const pc = state.player.field[s];
    if (pc && pc.currentHp > 0) {
      const target = pickTarget(state.enemy.field, s, isRanged(pc));
      if (target) attacks.push({ attacker: pc, defender: target, slot: s });
    }
  }
  for (let s = 0; s < FIELD_SLOTS; s++) {
    const ec = state.enemy.field[s];
    if (ec && ec.currentHp > 0) {
      const target = pickTarget(state.player.field, s, isRanged(ec));
      if (target) attacks.push({ attacker: ec, defender: target, slot: s });
    }
  }

  for (const atk of attacks) {
    if (atk.attacker.currentHp <= 0) continue;
    if (atk.defender.currentHp <= 0) continue;
    fightPair(atk.attacker, atk.defender, atk.slot, state);
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

  if (enemyDead.length > 0) {
    state.spoils.push(...enemyDead.map(c => instantiate(c.defId)));
  }

  awardCrystals(state, playerDead);
  state.turn++;

  const playerHasCards =
    aliveCount(state.player) > 0 || state.player.hand.length > 0;

  if (!playerHasCards) {
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

  state.phase = 'placing';
  refillHand(state);
  spawnEnemyWave(state);
}

function pickTarget(
  enemyField: (CardInstance | null)[],
  attackerSlot: number,
  ranged: boolean,
): CardInstance | null {
  const front = enemyField[frontOf(attackerSlot)];
  const back  = enemyField[backOf(attackerSlot)];
  const frontAlive = !!(front && front.currentHp > 0);
  const backAlive  = !!(back  && back.currentHp  > 0);

  if (ranged) {
    if (backAlive)  return back;
    if (frontAlive) return front;
  } else {
    if (frontAlive) return front;
    if (backAlive)  return back;
  }
  return null;
}

function awardCrystals(state: GameState, playerDead: CardInstance[]): void {
  const survived = aliveCount(state.player);
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

function tickStartOfTurn(
  ownField: (CardInstance | null)[],
  opponentField: (CardInstance | null)[],
  log: string[],
  owner: string,
  events: BattleEvent[],
  rng: RNG,
): void {
  const oppHasWitch = hasLivingWitch(opponentField);

  for (const card of ownField) {
    if (!card || card.currentHp <= 0) continue;
    const def = CATALOG[card.defId];

    if (oppHasWitch) {
      card.currentHp -= 1;
      log.push(`🌙 ${owner} ${def.name} теряет 1 HP от проклятия`);
      events.push({ type: 'witchAura', targetId: card.instanceId, damage: 1 });
    }

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

  void rng;
}

function cleanupField(
  side: Side,
  log: string[],
  isPlayer: boolean,
  events: BattleEvent[],
): CardInstance[] {
  const dead: CardInstance[] = [];
  for (let i = 0; i < FIELD_SLOTS; i++) {
    const c = side.field[i];
    if (c && c.currentHp <= 0) {
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
      side.field[i] = null;
    }
  }
  return dead;
}

function fightPair(
  pc: CardInstance,
  ec: CardInstance,
  slot: number,
  state: GameState,
): void {
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
    splashAround(state.enemy.field, slot, dmg, state, `💥 Ваш ${pDef.name} задевает`);
  }
  if (hasAbility(ec, 'splash')) {
    const dmg = Math.floor(eDef.attack / SPLASH_DIVISOR);
    splashAround(state.player.field, slot, dmg, state, `💥 Вражеский ${eDef.name} задевает`);
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

  const attackerIsPlayer = state.player.field.some(c => c === attacker);
  const defenderSide = attackerIsPlayer ? state.enemy.field : state.player.field;
  if (hasLivingWitch(defenderSide)) {
    dmg = Math.max(1, Math.floor(dmg / 2));
  }

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

  if (hasAbility(attacker, 'witch')) {
    if (state.rng.next() < WITCH_POISON_CHANCE) {
      const enemyField = attackerIsPlayer ? state.enemy.field : state.player.field;
      let poisoned = 0;
      for (const ec of enemyField) {
        if (!ec || ec.currentHp <= 0) continue;
        ec.poison += 1;
        state.battleEvents.push({ type: 'poison', targetId: ec.instanceId, stacks: ec.poison });
        poisoned++;
      }
      if (poisoned > 0) {
        state.log.push(`🌙 Ведьма проклинает всех! ${poisoned} врагов отравлены`);
      }
    }
  }
}

function splashAround(
  field: (CardInstance | null)[],
  slot: number,
  dmg: number,
  state: GameState,
  prefix: string,
): void {
  if (dmg <= 0) return;
  const row = slotRow(slot);
  const col = slotCol(slot);

  for (const offset of [-1, 1]) {
    const nc = col + offset;
    if (nc < 0 || nc >= FIELD_COLS) continue;
    const idx = row * FIELD_COLS + nc;
    const neighbor = field[idx];
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
    state.phase = 'placing';
    goToMenu(state);
  } else if (state.screen === 'menu') {
    refillHand(state);
  }
}

export function buyPack(state: GameState): boolean {
  if (state.crystals < PACK_PRICE) return false;
  state.crystals -= PACK_PRICE;
  const rolled = rollPackCards(state);
  state.log = [`💎 Куплен пак за ${PACK_PRICE}: ${rolled.map(c => CATALOG[c.defId].name).join(', ')}`];

  if (state.screen === 'menu') {
    refillHand(state);
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

export function startNextRound(state: GameState): void {
  state.phase = 'placing';
  refillHand(state);
  spawnEnemyWave(state);
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

export function sortedFilteredAllCards(state: GameState): CardInstance[] {
  const filter = state.inventoryFilter;
  const sort = state.inventorySort;

  let list = state.collection.slice();
  if (filter !== 'all') {
    list = list.filter(c => CATALOG[c.defId].rarity === filter);
  }

  switch (sort) {
    case 'name':
      list.sort((a, b) => CATALOG[a.defId].name.localeCompare(CATALOG[b.defId].name));
      break;
    case 'attack':
      list.sort((a, b) => CATALOG[b.defId].attack - CATALOG[a.defId].attack);
      break;
    case 'health':
      list.sort((a, b) => CATALOG[b.defId].health - CATALOG[a.defId].health);
      break;
    case 'rarity':
      list.sort((a, b) =>
        RARITY_ORDER[CATALOG[b.defId].rarity] - RARITY_ORDER[CATALOG[a.defId].rarity]
      );
      break;
  }

  return list;
}

export function countByDefId(state: GameState, defId: CardId): number {
  return state.collection.filter(c => c.defId === defId).length;
}

export function countInActiveDeckByDefId(state: GameState, defId: CardId): number {
  const ids = new Set(getDeckIds(state));
  return state.collection.filter(c => c.defId === defId && ids.has(c.instanceId)).length;
}