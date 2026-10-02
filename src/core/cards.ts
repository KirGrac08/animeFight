import type { AbilityId, CardDef, CardId } from './types';

export const CATALOG: Record<CardId, CardDef> = {
  goblin:    { id: 'goblin',    name: 'Гоблин',  art: '👹', attack: 2, health: 2, rarity: 'common', abilities: [] },
  slime:     { id: 'slime',     name: 'Слизень', art: '🟢', attack: 1, health: 4, rarity: 'common', abilities: ['regen'] },
  archer:    { id: 'archer',    name: 'Лучник',  art: '🏹', attack: 3, health: 1, rarity: 'common', abilities: ['first_strike'] },
  knight:    { id: 'knight',    name: 'Рыцарь',  art: '⚔️', attack: 3, health: 5, rarity: 'rare',   abilities: ['shield'] },
  mage:      { id: 'mage',      name: 'Маг',     art: '🧙', attack: 4, health: 2, rarity: 'rare',   abilities: ['poison'] },
  vampire:   { id: 'vampire',   name: 'Вампир',  art: '🧛', attack: 3, health: 3, rarity: 'rare',   abilities: ['lifesteal'] },
  berserker: { id: 'berserker', name: 'Берсерк', art: '🪓', attack: 3, health: 4, rarity: 'epic',   abilities: ['double_strike'] },
  dragon:    { id: 'dragon',    name: 'Дракон',  art: '🐉', attack: 6, health: 7, rarity: 'epic',   abilities: ['splash'] },
};

export const ABILITY_INFO: Record<AbilityId, { icon: string; label: string; desc: string }> = {
  first_strike:  { icon: '⚡',    label: 'Первый удар',   desc: 'Бьёт до ответного удара' },
  double_strike: { icon: '⚔️⚔️', label: 'Двойной удар', desc: 'Атакует дважды за ход' },
  lifesteal:     { icon: '🩸',    label: 'Вампиризм',     desc: 'Восстанавливает HP на нанесённый урон' },
  poison:        { icon: '☠️',    label: 'Яд',           desc: 'Накладывает 1 стак яда при ударе' },
  regen:         { icon: '💚',    label: 'Регенерация',   desc: '+1 HP в начале хода' },
  shield:        { icon: '🛡️',    label: 'Щит',           desc: 'Начинает бой с 2 щитами' },
  splash:        { icon: '💥',    label: 'Сплеш',         desc: 'Задевает соседей на половину урона' },
};

export const STARTER_DECK: CardId[] = [
  'goblin', 'slime', 'archer', 'knight', 'mage', 'goblin',
];

export const RARITY_WEIGHTS: Record<string, number> = {
  common: 60, rare: 30, epic: 10,
};

export const SHIELD_ON_SPAWN = 2;
export const REGEN_AMOUNT = 1;
export const SPLASH_DIVISOR = 2;
export const PACK_PRICE = 12;   // 💎 за пак
export const REWARD_WIN = 1;
export const REWARD_FLAWLESS = 3;
export const MIN_DECK_SIZE = 3;
export const MAX_DECK_SIZE = 15;