import type { CardDef } from '../types';

const priest: CardDef = {
  id: 'priest',
  name: 'Жрец',
  art: '🧝',
  attack: 2,
  health: 4,
  rarity: 'rare',
  attackType: 'ranged',
  abilities: ['heal_aura'],
};

export default priest;