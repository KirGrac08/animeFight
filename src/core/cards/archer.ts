import type { CardDef } from '../types';

const archer: CardDef = {
  id: 'archer',
  name: 'Лучник',
  art: '🏹',
  attack: 3,
  health: 1,
  rarity: 'common',
  attackType: 'ranged',
  abilities: ['first_strike'],
};

export default archer;