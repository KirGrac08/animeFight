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
import skeleton from './skeleton';
import shaman from './shaman';
import priest from './priest';
import necromancer from './necromancer';
import iceElemental from './ice_elemental';
import golem from './golem';
import assassin from './assassin';

// ============================================================
// КАТАЛОГ
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
  skeleton,
  shaman,
  priest,
  necromancer,
  ice_elemental: iceElemental,
  golem,
  assassin,
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
  witch:         { icon: '🌙',    label: 'Проклятие',     desc: 'Пока жива: враги бьют вдвое слабее, теряют 1 HP/ход. 25% — отравить всех' },
  taunt:         { icon: '🐗',    label: 'Провокация',    desc: 'Враги обязаны атаковать эту карту первой в колонке' },
  battlecry:     { icon: '⚡',    label: 'Боевой клич',   desc: 'При выходе наносит 1 урон всем врагам' },
  deathrattle:   { icon: '💀',    label: 'Предсмертный',  desc: 'При смерти призывает 1/1 Скелета в свой слот' },
  freeze:        { icon: '❄️',    label: 'Заморозка',     desc: 'Замораживает цель — пропускает следующую атаку' },
  pierce:        { icon: '🗡️',    label: 'Пробитие',      desc: 'Атака игнорирует щит' },
  heal_aura:     { icon: '✨',    label: 'Аура лечения',  desc: '+1 HP всем союзникам в начале хода' },
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
// КОНСТАНТЫ
// ============================================================

export const SHIELD_ON_SPAWN = 2;
export const REGEN_AMOUNT = 1;
export const SPLASH_DIVISOR = 2;
export const WITCH_POISON_CHANCE = 0.25;
export const HEAL_AURA_AMOUNT = 1;
export const BATTLECRY_DAMAGE = 1;

export const FIELD_COLS = 4;
export const FIELD_ROWS = 2;
export const FIELD_SLOTS = FIELD_COLS * FIELD_ROWS;

export const MIN_DECK_SIZE = 1;
export const MAX_DECK_SIZE = 12;

export const PACK_PRICE = 12;
export const REWARD_WIN = 1;
export const REWARD_FLAWLESS = 3;