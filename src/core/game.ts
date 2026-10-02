import {
  CATALOG, RARITY_WEIGHTS, REGEN_AMOUNT,
  SHIELD_ON_SPAWN, SPLASH_DIVISOR, STARTER_DECK,
  PACK_PRICE, REWARD_WIN, REWARD_FLAWLESS,
} from './cards';
import { RNG } from './rng';
import type { AbilityId, CardId, CardInstance, MenuTab, Phase, Screen, Side } from './types';

export interface GameState {
  rng: RNG;
  turn: number;
  phase: Phase;
  player: Side;
  enemy: Side;
  packs: number;
  crystals: number;
  log: string[];

  collection: CardInstance[];
  spoils: CardInstance[];
  showInventory: boolean;

  screen: Screen;
  menuTab: MenuTab;
}

let idCounter = 0;

// ---------- ХЕЛПЕРЫ ----------

export function defHasAbility(defId: CardId, ability: AbilityId): boolean {
  return CATALOG[defId].abilities.includes(ability);
}

export function hasAbility(card: CardInstance, ability: AbilityId): boolean {
  return defHasAbility(card.defId, ability);
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

// ---------- ИНИЦИАЛИЗАЦИЯ ----------

export function createInitialState(seed?: number): GameState {
  const deck = STARTER_DECK.map(instantiate);
  const state: GameState = {
    rng: new RNG(seed),
    turn: 1,
    phase: 'placing',
    player: { ...emptySide(), deck },
    enemy: emptySide(),
    packs: 1,
    crystals: 0,
    log: ['Добро пожаловать.'],
    collection: [...deck],
    spoils: [],
    showInventory: false,
    screen: 'menu',
    menuTab: 'battle',
  };
  drawUpTo(state, 'player', 3);
  spawnEnemyWave(state);
  return state;
}

export function drawUpTo(state: GameState, side: 'player' | 'enemy', n: number): void {
  const s = state[side];
  while (s.hand.length < n && s.deck.length > 0) {
    s.hand.push(s.deck.shift()!);
  }
}

function spawnEnemyWave(state: GameState): void {
  const pool: CardId[] = ['goblin', 'slime', 'archer', 'knight'];
  if (state.turn > 4) pool.push('mage', 'vampire');
  if (state.turn > 6) pool.push('berserker');
  if (state.turn > 8) pool.push('dragon');

  const count = Math.min(3, 1 + Math.floor(state.turn / 2));
  state.enemy.field = [];
  for (let i = 0; i < count; i++) {
    state.enemy.field.push(instantiate(state.rng.pick(pool)));
  }
}

// ---------- ДЕЙСТВИЯ ----------

export function placeCard(state: GameState, instanceId: string): boolean {
  if (state.phase !== 'placing') return false;
  if (state.player.field.length >= 3) return false;
  const idx = state.player.hand.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return false;
  const [card] = state.player.hand.splice(idx, 1);
  state.player.field.push(card);
  return true;
}

export function goToMenu(state: GameState): void {
  state.screen = 'menu';
  state.showInventory = false;
}

export function goToBattle(state: GameState): void {
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

  tickStartOfTurn(state.player.field, state.log, 'Ваш');
  tickStartOfTurn(state.enemy.field,  state.log, 'Вражеский');

  const playerDead: CardInstance[] = [];
  const enemyDead:  CardInstance[] = [];

  playerDead.push(...cleanupField(state.player, state.log, true));
  enemyDead.push(...cleanupField(state.enemy,  state.log, false));

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

  playerDead.push(...cleanupField(state.player, state.log, true));
  enemyDead.push(...cleanupField(state.enemy,  state.log, false));

  if (playerDead.length > 0) {
    const deadIds = new Set(playerDead.map(c => c.instanceId));
    state.collection = state.collection.filter(c => !deadIds.has(c.instanceId));
  }

  if (enemyDead.length > 0) {
    state.spoils = enemyDead.map(c => instantiate(c.defId));
  }

  awardCrystals(state, playerDead);

  state.turn++;

  const total =
    state.player.deck.length + state.player.hand.length + state.player.field.length;

  if (total === 0) {
    state.phase = 'pack';
    state.packs++;
    state.log.push('🎁 Все карты потеряны! Доступен пак.');
    return;
  }

  if (state.spoils.length > 0) {
    state.phase = 'spoils';
    state.log.push('🏆 Выберите трофей!');
    return;
  }

  startNextRound(state);
}

function startNextRound(state: GameState): void {
  state.phase = 'placing';
  drawUpTo(state, 'player', 3);
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

function tickStartOfTurn(field: CardInstance[], log: string[], owner: string): void {
  for (const card of field) {
    if (card.currentHp <= 0) continue;
    const def = CATALOG[card.defId];

    if (hasAbility(card, 'regen') && card.currentHp < def.health) {
      const healed = Math.min(REGEN_AMOUNT, def.health - card.currentHp);
      card.currentHp += healed;
      log.push(`💚 ${owner} ${def.name} +${healed} HP`);
    }

    if (card.poison > 0) {
      card.currentHp -= card.poison;
      log.push(`☠️ ${owner} ${def.name} получает ${card.poison} от яда`);
      card.poison--;
    }
  }
}

function cleanupField(side: Side, log: string[], isPlayer: boolean): CardInstance[] {
  const dead: CardInstance[] = [];
  side.field = side.field.filter(c => {
    if (c.currentHp <= 0) {
      dead.push(c);
      if (isPlayer) {
        side.lost.push(c);
        log.push(`💀 ${CATALOG[c.defId].name} потерян навсегда`);
      }
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
    if (absorbed > 0) state.log.push(`🛡️ ${dDef.name} поглощает ${absorbed}`);
  }

  defender.currentHp -= dmg;

  if (hasAbility(attacker, 'lifesteal') && dmg > 0) {
    const before = attacker.currentHp;
    attacker.currentHp = Math.min(attacker.currentHp + dmg, aDef.health);
    if (attacker.currentHp > before) {
      state.log.push(`🩸 ${aDef.name} +${attacker.currentHp - before} HP`);
    }
  }

  if (hasAbility(attacker, 'poison') && defender.currentHp > 0) {
    defender.poison += 1;
    state.log.push(`☠️ ${dDef.name} отравлен (${defender.poison})`);
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
    }
    neighbor.currentHp -= d;
    state.log.push(`${prefix} ${CATALOG[neighbor.defId].name} (${d})`);
  }
}

// ---------- ТРОФЕИ ----------

export function takeSpoil(state: GameState, instanceId: string): void {
  if (state.phase !== 'spoils') return;
  const idx = state.spoils.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return;
  const [card] = state.spoils.splice(idx, 1);
  state.collection.push(card);
  state.player.deck.push(card);
  state.log.push(`🏆 Получено: ${CATALOG[card.defId].name}`);
  state.spoils = [];
  startNextRound(state);
}

export function skipSpoils(state: GameState): void {
  if (state.phase !== 'spoils') return;
  state.spoils = [];
  state.log.push('Трофеи пропущены.');
  startNextRound(state);
}

// ---------- ПАКИ ----------

function rollPackCards(state: GameState): CardInstance[] {
  const pool = Object.values(CATALOG);
  const rolled: CardInstance[] = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity(state.rng, RARITY_WEIGHTS);
    const candidates = pool.filter(c => c.rarity === rarity);
    const def = state.rng.pick(candidates.length ? candidates : pool);
    const card = instantiate(def.id);
    state.player.deck.push(card);
    state.collection.push(card);
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
  }
}

export function buyPack(state: GameState): boolean {
  if (state.crystals < PACK_PRICE) return false;
  state.crystals -= PACK_PRICE;
  const rolled = rollPackCards(state);
  state.log = [`💎 Куплен пак за ${PACK_PRICE}: ${rolled.map(c => CATALOG[c.defId].name).join(', ')}`];
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