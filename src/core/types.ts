export type CardId = string;
export type Rarity = 'common' | 'rare' | 'epic';

export type AbilityId =
  | 'first_strike'
  | 'double_strike'
  | 'lifesteal'
  | 'poison'
  | 'regen'
  | 'shield'
  | 'splash';

export interface CardDef {
  id: CardId;
  name: string;
  art: string;
  attack: number;
  health: number;
  rarity: Rarity;
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
  deck: CardInstance[];
  hand: CardInstance[];
  field: CardInstance[];
  lost: CardInstance[];
}

export type Phase = 'placing' | 'battle' | 'pack' | 'spoils';
export type Screen = 'menu' | 'battle';
export type MenuTab = 'battle' | 'rating' | 'inventory' | 'packs';