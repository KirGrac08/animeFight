export type CardId = string;
export type Rarity = 'common' | 'rare' | 'epic';
export type AttackType = 'melee' | 'ranged';

export type AbilityId =
  | 'first_strike'
  | 'double_strike'
  | 'lifesteal'
  | 'poison'
  | 'regen'
  | 'shield'
  | 'splash'
  | 'witch';

export interface CardDef {
  id: CardId;
  name: string;
  art: string;
  attack: number;
  health: number;
  rarity: Rarity;
  attackType: AttackType;
  abilities: AbilityId[];
}

export interface CardInstance {
  instanceId: string;
  defId: CardId;
  currentHp: number;
  shield: number;
  poison: number;
}

export interface Side {
  hand: CardInstance[];
  field: (CardInstance | null)[];
  lost: CardInstance[];
}

export type BattleEvent =
  | { type: 'attack';     attackerId: string; defenderId: string; damage: number }
  | { type: 'splash';     targetId: string; damage: number }
  | { type: 'shield';     targetId: string; absorbed: number }
  | { type: 'heal';       targetId: string; amount: number }
  | { type: 'poison';     targetId: string; stacks: number }
  | { type: 'poisonTick'; targetId: string; damage: number }
  | { type: 'witchAura';  targetId: string; damage: number }
  | { type: 'death';      cardId: string; side: 'player' | 'enemy' };

export type Phase = 'placing' | 'battle' | 'pack' | 'spoils';
export type Screen = 'menu' | 'battle';
export type MenuTab = 'battle' | 'rating' | 'inventory' | 'packs';