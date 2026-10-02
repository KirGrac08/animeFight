import type { AbilityId, CardDef, CardId } from '../types';

import goblin from './goblin';
import slime from './slime';
import archer from './archer';
import knight from './knight';
import mage from './mage';
import vampire from './vampire';
import berserker from './berserker';
import dragon from './dragon';
import witch from './witch';

// ============================================================
// КАТАЛОГ ВСЕХ КАРТ
// Чтобы добавить новую — создай файл рядом и добавь сюда одну строку.
// ============================================================

export const CATALOG: Record<CardId, CardDef> = {
  goblin,
  slime,
  archer,
  knight,
  mage,
  vampire,
  berserker,
  dragon,
  witch,
};

// ============================================================
// ОПИСАНИЕ СПОСОБНОСТЕЙ
// ============================================================

export const ABILITY_INFO: Record<AbilityId, { icon: string; label: string; desc: string }> = {
  first_strike:  { icon: '⚡',    label: 'Первый удар',   desc: 'Бьёт до ответного удара' },
  double_strike: { icon: '⚔️⚔️', label: 'Двойной удар',  desc: 'Атакует дважды за ход' },
  lifesteal:     { icon: '🩸',    label: 'Вампиризм',     desc: 'Восстанавливает HP на нанесённый урон' },
  poison:        { icon: '☠️',    label: 'Яд',            desc: 'Накладывает 1 стак яда при ударе' },
  regen:         { icon: '💚',    label: 'Регенерация',   desc: '+1 HP в начале хода' },
  shield:        { icon: '🛡️',    label: 'Щит',           desc: 'Начинает бой с 2 щитами' },
  splash:        { icon: '💥',    label: 'Сплеш',         desc: 'Задевает соседей по ряду на половину урона' },
  witch:         { icon: '🌙',    label: 'Проклятие',     desc: 'Пока жива: враги бьют вдвое слабее, теряют 1 HP/ход. 25% при атаке — отравить всех' },
};

// ============================================================
// СТАРТОВАЯ КОЛОДА И РЕДКОСТЬ
// ============================================================

export const STARTER_DECK: CardId[] = [
  'goblin', 'slime', 'archer', 'knight', 'mage', 'goblin',
];

export const RARITY_WEIGHTS: Record<string, number> = {
  common: 60, rare: 30, epic: 10,
};

// ============================================================
// КОНСТАНТЫ БАЛАНСА
// ============================================================

export const SHIELD_ON_SPAWN = 2;
export const REGEN_AMOUNT = 1;
export const SPLASH_DIVISOR = 2;
export const WITCH_POISON_CHANCE = 0.25;

export const FIELD_COLS = 4;
export const FIELD_ROWS = 2;
export const FIELD_SLOTS = FIELD_COLS * FIELD_ROWS;

export const MIN_DECK_SIZE = 1;
export const MAX_DECK_SIZE = 12;

export const PACK_PRICE = 12;
export const REWARD_WIN = 1;
export const REWARD_FLAWLESS = 3;