import { shuffled } from './random';
import type { AbilityId, Mode } from './types';
import { MIGHT_SPEED_MULTIPLIER } from './hauling';

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
  detail: string;
}

export const MAX_ABILITIES = 4;
export const ABILITY_LEVELS: readonly number[] = [1, 4, 7, 10];
export const BASE_HOOK_RADIUS = 7;
export const WIDE_CLAW_MULTIPLIER = 2;
export const GOLD_COLLECTOR_BONUS_PERCENT = 15;
export const DIAMOND_COLLECTOR_BONUS_PERCENT = 15;
export const DIAMOND_VEIN_CHANCE = 0.1;
export const RISK_VALUE_MULTIPLIER = 1.5;
export const RISK_RADIUS_MULTIPLIER = 0.75;
export const TIME_BANK_COINS_PER_SECOND = 20;
export const ARCHAEOLOGIST_VALUE_MULTIPLIER = 20;
export const RUSH_DURATION_MULTIPLIER = 0.8;
export const RUSH_VALUE_MULTIPLIER = 1.3;
export const SLOW_FUSE_SECONDS = 3;
export const CLONE_REWARD_MULTIPLIER = 2;
export const FOSSIL_PUZZLE_BONUS = 500;
export const GOLD_GROWTH_INTERVAL = 10;
export const BAG_COUNTS = [0.15, 0.45, 0.25, 0.12, 0.03] as const;
export const MONEYBAGS_COUNTS = [0.05, 0.32, 0.4, 0.18, 0.05] as const;

export const ABILITIES: readonly Ability[] = [
  { id: 'might', name: '大力', description: '载物回拉速度增加35%', detail: '在原版回拉效果上额外加速35%，不改变力量值；钱袋使用普通奖池，仍可抽到本关生力。' },
  { id: 'gold-collector', name: '金块收藏家', description: `所有金块的结算价值增加${GOLD_COLLECTOR_BONUS_PERCENT}%`, detail: '包括点石成金产生的黄金；不影响钻石、钱袋现金或TNT。' },
  { id: 'diamond-collector', name: '钻石收藏家', description: `钻石的结算价值增加${DIAMOND_COLLECTOR_BONUS_PERCENT}%`, detail: '与钻石抛光剂乘算至1035元；携钻鼹鼠的钻石部分同样生效。' },
  { id: 'alchemy', name: '点石成金', description: '抓到石头时，20%概率变成大金块', detail: '每块石头只判定一次；成功后价值500、重量按大金块计算，可叠加金块收藏家。' },
  { id: 'aim-line', name: '射线', description: '显示钩子朝向的辅助瞄准线', detail: '停在当前第一个可碰到的目标；移动目标仍需把握出钩时机。' },
  { id: 'wide-claw', name: '深渊巨口', description: `钩子宽度增加${(WIDE_CLAW_MULTIPLIER - 1) * 100}%，更容易命中`, detail: '钩本身的判定范围同步扩大；仍只抓最先碰到的一个目标，也更容易碰到附近的石头。' },
  { id: 'diamond-vein', name: '璀璨胜金', description: '每块黄金有10%概率变成钻石', detail: '在每关生成矿场时生效；不再次转换采集中点石成金的产物。' },
  { id: 'bomb-expert', name: '拆弹专家', description: 'TNT不再爆炸，可以挖出换取50元', detail: 'TNT重量与50元金块相同；不影响主动使用炸药，TNT仍不属于黄金；与慢燃引信互斥。' },
  { id: 'diamond-moles', name: '谁动了我的钻石', description: '每关额外出现1只携钻鼹鼠', detail: '双人全队合计增加1只；与钻石收藏家和抛光剂兼容。' },
  { id: 'moneybags', name: '钱袋子', description: '更多钱袋、必装现金，按钻石重量', detail: '平均钱袋数量增加约30%，固定为钻石重量2；三叶草仍会提高现金奖励。' },
  { id: 'thief', name: '窃贼', description: '每次商店可免费偷取2件商品', detail: '只能选择本店已上架且未售出的商品；全队共用2次，正常扣库存，次数不跨店累积。' },
  { id: 'risk-reward', name: '富贵险中求', description: `TNT附近的黄金、钻石价值增加${Math.round((RISK_VALUE_MULTIPLIER - 1) * 100)}%`, detail: `仅TNT爆炸半径${RISK_RADIUS_MULTIPLIER * 100}%范围内生效；抓住时锁定加成，可与收藏家和抛光剂乘算；仍在矿场的安全TNT同样有效，鼹鼠本身的2元不加成。` },
  { id: 'time-bank', name: '时间银行', description: `提前过关时，每剩余1秒获得${TIME_BANK_COINS_PER_SECOND}元`, detail: '按界面剩余整秒结算；主动收工或清空矿场提前过关均生效，不再延长下一关。' },
  { id: 'airy-moles', name: '透气的鼹鼠', description: '携钻鼹鼠更容易出现在矿场中上层', detail: '将携钻鼹鼠的出生位置偏向中层和上层，也影响额外生成的鼹鼠；不再改变移动速度或回拉重量。' },
  { id: 'slow-fuse', name: '慢燃引信', description: '触碰TNT后继续出钩，TNT延迟3秒爆炸', detail: '点燃后不会再次挡钩，暂停时引信也暂停；连锁爆炸不延迟，可配合富贵险中求，与拆弹专家互斥。' },
  { id: 'time-rush', name: '争分夺秒', description: '每关基础时间缩短20%，黄金和钻石价值增加30%', detail: '不改变目标金币；收益可与收藏家、抛光剂及富贵险中求乘算，不加成鼹鼠本身的2元。' },
  { id: 'regular-customer', name: '老主顾', description: '每次商店必有大力水、三叶草和钻石抛光剂', detail: '价格与每店限购1件保持不变；可正常购买或用窃贼偷取，选到后立即影响本次商店。' },
  { id: 'archaeologist', name: '考古学家', description: '长骨价值变为140元，头骨价值变为400元', detail: '重量保持不变；骨头仍不属于石头、黄金或钻石，不受石头书、收藏家或富贵险中求加成。' },
  { id: 'clone', name: '克隆', description: '每关首次抓住的物品，最终收益翻倍', detail: '全队共享1次，抓住即锁定，需成功带回；现金与炸药翻倍，生力不叠加，炸毁也消耗本关机会。' },
  { id: 'fossil-puzzle', name: '化石拼图', description: '每关集齐长骨和头骨，额外获得500元', detail: '两种骨头各收回1件即可，顺序不限，全队共享每关1次；骨头本身正常结算，拼图奖金不受克隆等售价加成。' },
  { id: 'gold-growth', name: '黄金生长', description: '每10秒，随机一颗黄金长大一档', detail: '每次仅1颗：50→100→250→500元；从地下未抓住且未满档的黄金中等概率抽选，同一颗可多次长大，体积和重量同步增长；暂停不计时。' },
  { id: 'buzzer-delivery', name: '压哨交货', description: '时间归零时，钩上已抓住的物品照常结算', detail: '无需先拉回地面，双人两只钩均有效；保留全部收益加成和钱袋奖励，空钩或已炸毁的货物不算，结算后再判断过关。' },
];

export function getAbility(id: AbilityId, mode: Mode): Ability {
  const ability = ABILITIES.find((entry) => entry.id === id);
  if (!ability) throw new Error(`Unknown ability: ${id}`);
  return id === 'time-bank'
    ? { ...ability, detail: `${ability.detail}${mode === 'coop' ? '双人共享奖励，' : ''}基础时限最多${(mode === 'coop' ? 40 : 60) * TIME_BANK_COINS_PER_SECOND}元。` }
    : ability;
}

export function needsAbilityChoice(level: number, count: number): boolean {
  const index = ABILITY_LEVELS.indexOf(level);
  return index !== -1 && count <= index && count < MAX_ABILITIES;
}

export function canAcquireAbility(id: AbilityId, owned: readonly AbilityId[]): boolean {
  return owned.length < MAX_ABILITIES && !owned.includes(id)
    && !(id === 'slow-fuse' && owned.includes('bomb-expert'))
    && !(id === 'bomb-expert' && owned.includes('slow-fuse'));
}

export function drawAbilityOffers(
  owned: readonly AbilityId[],
  random: () => number,
  previouslyOffered: readonly AbilityId[] = [],
): AbilityId[] {
  if (owned.length >= MAX_ABILITIES) return [];
  return shuffled(ABILITIES.filter((ability) =>
    !previouslyOffered.includes(ability.id) && canAcquireAbility(ability.id, owned),
  ), random)
    .slice(0, 3)
    .map((ability) => ability.id);
}

export function rollBagCount(abilities: readonly AbilityId[], random: () => number): number {
  const weights = abilities.includes('moneybags') ? MONEYBAGS_COUNTS : BAG_COUNTS;
  const roll = random();
  if (roll < 0 || roll >= 1 || !Number.isFinite(roll)) throw new RangeError('Random values must be in [0, 1).');
  let cumulative = 0;
  for (let count = 0; count < weights.length; count++) {
    cumulative += weights[count];
    if (roll < cumulative) return count;
  }
  return weights.length - 1;
}

export function hookRadius(abilities: readonly AbilityId[]): number {
  return BASE_HOOK_RADIUS * (abilities.includes('wide-claw') ? WIDE_CLAW_MULTIPLIER : 1);
}

export function haulingMultiplier(abilities: readonly AbilityId[]): number {
  return abilities.includes('might') ? MIGHT_SPEED_MULTIPLIER : 1;
}
