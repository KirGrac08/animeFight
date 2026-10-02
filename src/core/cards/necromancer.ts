import type { CardDef } from '../types';

const necromancer: CardDef = {
  id: 'necromancer',
  name: 'Некромант',
  art: '💀',
  attack: 3,
  health: 3,
  rarity: 'rare',
  attackType: 'ranged',
  abilities: ['deathrattle'],
};

export default necromancer;