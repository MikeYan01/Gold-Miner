import type { ReelMotion } from './hauling';
import type { DisplayText, LocalizedText } from './i18n';

export type Mode = 'solo' | 'coop';
export type Phase = 'menu' | 'draft' | 'playing' | 'paused' | 'results' | 'shop' | 'gameover';
export type AbilityId =
  | 'might'
  | 'gold-collector'
  | 'diamond-collector'
  | 'alchemy'
  | 'aim-line'
  | 'wide-claw'
  | 'diamond-vein'
  | 'bomb-expert'
  | 'diamond-moles'
  | 'moneybags'
  | 'thief'
  | 'risk-reward'
  | 'time-bank'
  | 'airy-moles'
  | 'slow-fuse'
  | 'time-rush'
  | 'regular-customer'
  | 'archaeologist'
  | 'clone'
  | 'fossil-puzzle'
  | 'gold-growth'
  | 'buzzer-delivery';
export type PlayerId = 1 | 2;
export type HookPhase = 'swinging' | 'extending' | 'retracting';
export type EntityKind =
  | 'gold-tiny'
  | 'gold-small'
  | 'gold-medium'
  | 'gold-large'
  | 'rock-small'
  | 'rock-large'
  | 'diamond'
  | 'bag'
  | 'bone-small'
  | 'bone-large'
  | 'mole'
  | 'mole-diamond'
  | 'tnt'
  | 'tnt-fragment';
export type Upgrade = 'strength' | 'luck' | 'polish' | 'rockbook';
export type ShopItemId = 'dynamite' | Upgrade;
export type Sound =
  | 'launch'
  | 'reel'
  | 'grab'
  | 'gold'
  | 'gem'
  | 'rock'
  | 'bag'
  | 'explosion'
  | 'tick'
  | 'win'
  | 'lose'
  | 'buy'
  | 'denied';

export interface Point {
  x: number;
  y: number;
}

export type BagReward =
  | { kind: 'cash'; value: number }
  | { kind: 'dynamite'; amount: number }
  | { kind: 'strength' };

export interface Entity extends Point {
  id: number;
  kind: EntityKind;
  radius: number;
  weight: number;
  baseValue: number;
  value: number;
  active: boolean;
  claimedBy: PlayerId | null;
  riskBonus: boolean;
  fuseRemaining: number | null;
  bagReward: BagReward | null;
  rotation: number;
  direction: number;
  speed: number;
}

export interface Player {
  id: PlayerId;
  origin: Point;
  angle: number;
  swingTime: number;
  length: number;
  phase: HookPhase;
  cargoId: number | null;
  reel: ReelMotion | null;
  earned: number;
  roundEarned: number;
}

export interface Particle extends Point {
  kind: 'spark' | 'blast';
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatingText extends Point {
  text: DisplayText;
  color: string;
  life: number;
}

export interface Notice {
  id: number;
  text: LocalizedText;
  tone: 'normal' | 'good' | 'warning';
}

export interface ShopItem {
  id: ShopItemId;
  name: LocalizedText;
  description: LocalizedText;
  price: number | null;
  priceText: string;
  stock: number;
  bought: number;
  tag: LocalizedText;
}

export interface RoundResult {
  earned: number;
  timeBankBonus: number;
  fossilBonus: number;
  collected: number;
  gold: number;
  diamonds: number;
  timeUsed: number;
  passed: boolean;
}

export interface GameState {
  phase: Phase;
  mode: Mode;
  level: number;
  levelName: LocalizedText;
  score: number;
  target: number;
  timeLeft: number;
  duration: number;
  clonedEntityId: number | null;
  elapsed: number;
  dynamite: number;
  abilities: AbilityId[];
  abilityOffers: AbilityId[];
  offeredAbilities: AbilityId[];
  draftLevel: number | null;
  shopStealsRemaining: number;
  activeUpgrades: Upgrade[];
  pendingUpgrades: Upgrade[];
  bagStrength: boolean;
  players: Player[];
  entities: Entity[];
  particles: Particle[];
  texts: FloatingText[];
  shop: ShopItem[];
  result: RoundResult | null;
  notice: Notice | null;
  roundStartScore: number;
  collected: number;
  goldCollected: number;
  diamondsCollected: number;
  fossilPieces: ('bone-small' | 'bone-large')[];
  goalAnnounced: boolean;
}
