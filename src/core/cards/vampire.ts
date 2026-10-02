import type { CardDef } from '../types';

const vampire: CardDef = {
  id: 'vampire',
  name: 'Вампир',
  art: '🧛',
  attack: 3,
  health: 4,
  rarity: 'rare',
  attackType: 'melee',
  abilities: ['lifesteal'],
};

export default vampire;