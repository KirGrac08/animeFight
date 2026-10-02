import type { CardDef } from '../types';

const knight: CardDef = {
  id: 'knight',
  name: 'Рыцарь',
  art: '⚔️',
  attack: 3,
  health: 6,
  rarity: 'rare',
  attackType: 'melee',
  abilities: ['shield'],
};

export default knight;