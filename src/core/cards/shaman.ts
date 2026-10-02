import type { CardDef } from '../types';

const shaman: CardDef = {
  id: 'shaman',
  name: 'Гоблин-шаман',
  art: '🧌',
  attack: 2,
  health: 2,
  rarity: 'common',
  attackType: 'ranged',
  abilities: ['battlecry'],
};

export default shaman;