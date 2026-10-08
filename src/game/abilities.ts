import { shuffled } from './random';
import type { AbilityId, Mode } from './types';
import { MIGHT_SPEED_MULTIPLIER } from './hauling';
import { bilingual, DEFAULT_LANGUAGE } from './i18n';
import type { Language, LocalizedText } from './i18n';

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
  detail: string;
}

interface AbilityDefinition {
  id: AbilityId;
  name: LocalizedText;
  description: LocalizedText;
  detail: LocalizedText;
}

export const MAX_ABILITIES = 4;
export const ABILITY_LEVELS: readonly number[] = [1, 4, 7, 10];
export const BASE_HOOK_RADIUS = 7;
export const WIDE_CLAW_MULTIPLIER = 2;
export const GOLD_COLLECTOR_BONUS_PERCENT = 30;
export const DIAMOND_COLLECTOR_BONUS_PERCENT = 15;
export const ALCHEMY_CHANCE = 0.4;
export const DIAMOND_VEIN_CHANCE = 0.2;
export const RISK_VALUE_MULTIPLIER = 1.5;
export const RISK_RADIUS_MULTIPLIER = 0.5;
export const TIME_BANK_COINS_PER_SECOND = 50;
export const ARCHAEOLOGIST_VALUE_MULTIPLIER = 20;
export const RUSH_DURATION_MULTIPLIER = 0.8;
export const RUSH_VALUE_MULTIPLIER = 1.4;
export const CLONE_REWARD_MULTIPLIER = 2;
export const FOSSIL_PUZZLE_BONUS = 500;
export const GOLD_GROWTH_INTERVAL = 5;
export const TRAVEL_LIGHT_BONUS_SECONDS = 10;
export const BAG_COUNTS = [0.15, 0.45, 0.25, 0.12, 0.03] as const;
export const MONEYBAGS_COUNTS = [0.05, 0.32, 0.4, 0.18, 0.05] as const;

export const ABILITIES: readonly AbilityDefinition[] = [
  {
    id: 'might', name: bilingual('大力', 'Might'),
    description: bilingual(`载物回拉速度增加${Math.round((MIGHT_SPEED_MULTIPLIER - 1) * 100)}%`, `Loaded hauling speed +${Math.round((MIGHT_SPEED_MULTIPLIER - 1) * 100)}%`),
    detail: bilingual('在原版回拉效果上额外加速65%，不改变力量值；钱袋使用普通奖池，仍可抽到本关生力。', 'Adds 65% speed after the original hauling mode is chosen, without changing strength. Bags keep their normal prizes, including stage-long fast hauling.'),
  },
  {
    id: 'gold-collector', name: bilingual('金块收藏家', 'Gold Collector'),
    description: bilingual(`所有金块的结算价值增加${GOLD_COLLECTOR_BONUS_PERCENT}%`, `All gold is worth ${GOLD_COLLECTOR_BONUS_PERCENT}% more`),
    detail: bilingual('包括点石成金产生的黄金；不影响钻石、钱袋现金或TNT。', 'Includes gold made by Alchemy. Does not affect diamonds, cash bags, or TNT.'),
  },
  {
    id: 'diamond-collector', name: bilingual('钻石收藏家', 'Diamond Collector'),
    description: bilingual(`钻石的结算价值增加${DIAMOND_COLLECTOR_BONUS_PERCENT}%`, `Diamonds are worth ${DIAMOND_COLLECTOR_BONUS_PERCENT}% more`),
    detail: bilingual('与钻石抛光剂乘算至1035元；携钻鼹鼠的钻石部分同样生效。', 'Combines with diamond polish for $1,035 diamonds. Also boosts the diamond portion of diamond moles.'),
  },
  {
    id: 'alchemy', name: bilingual('点石成金', 'Alchemy'),
    description: bilingual(`抓到石头时，${ALCHEMY_CHANCE * 100}%概率变成大金块`, `Caught rocks have a ${ALCHEMY_CHANCE * 100}% chance to become large gold`),
    detail: bilingual('每块石头只判定一次；成功后价值500、重量按大金块计算，可叠加金块收藏家，也可继续触发璀璨胜金；与碎石机互斥。', 'One roll per rock. Success gives a $500 nugget with large-gold weight. Stacks with Gold Collector and can then trigger Diamond Vein. Cannot be combined with Rock Crusher.'),
  },
  {
    id: 'aim-line', name: bilingual('射线', 'Aim Line'),
    description: bilingual('显示钩子朝向的辅助瞄准线', 'Shows a guide along the claw direction'),
    detail: bilingual('出钩前显示直线；搭配直角转弯时，出钩后实时预览转向路线，转弯后显示前进路线。停在第一个会挡钩的目标，碎石机可透过石头；不预测移动目标。', 'Shows a straight guide before launch. With Right-Angle Turn, previews the turn while extending, then follows the new heading. Stops at the first blocking target, looking through rocks with Rock Crusher. Moving targets are not predicted.'),
  },
  {
    id: 'wide-claw', name: bilingual('深渊巨口', 'Wide Claw'),
    description: bilingual(`钩子宽度增加${(WIDE_CLAW_MULTIPLIER - 1) * 100}%，更容易命中`, `Claw width +${(WIDE_CLAW_MULTIPLIER - 1) * 100}% for easier catches`),
    detail: bilingual('钩本身的判定范围同步扩大；仍只抓最先碰到的一个目标，也更容易碰到附近的石头。', 'Doubles the claw hit area too. Still catches only the first object, so nearby rocks are also easier to hit.'),
  },
  {
    id: 'diamond-vein', name: bilingual('璀璨胜金', 'Diamond Vein'),
    description: bilingual(`抓到任意黄金时，${DIAMOND_VEIN_CHANCE * 100}%概率变成钻石`, `Caught gold has a ${DIAMOND_VEIN_CHANCE * 100}% chance to become a diamond`),
    detail: bilingual('抓取时只判定一次，包括点石成金和黄金生长的产物；外观、价值和重量同步变为钻石，可叠加抛光剂与钻石收藏家，不再在矿场生成时转换。', 'One roll at capture, including gold from Alchemy and Gold Growth. Appearance, value, and weight become a diamond, with polish and Diamond Collector support. No conversion at mine generation.'),
  },
  {
    id: 'bomb-expert', name: bilingual('拆弹专家', 'Bomb Expert'),
    description: bilingual('TNT不再爆炸，可以挖出换取50元', 'TNT is safe to haul and worth $50'),
    detail: bilingual('TNT重量与50元金块相同；不影响主动使用炸药，TNT仍不属于黄金；与富贵险中求互斥。', 'TNT weighs the same as $50 gold, but is not gold. Your dynamite still works. Cannot be combined with Risk Reward.'),
  },
  {
    id: 'diamond-moles', name: bilingual('谁动了我的钻石', 'Diamond Moles'),
    description: bilingual('每关额外出现1只携钻鼹鼠', 'Adds one diamond mole per stage'),
    detail: bilingual('双人全队合计增加1只；与钻石收藏家和抛光剂兼容。', 'One extra mole per shared mine in co-op. Works with Diamond Collector and diamond polish.'),
  },
  {
    id: 'moneybags', name: bilingual('钱袋子', 'Moneybags'),
    description: bilingual('更多钱袋、必装现金，按钻石重量', 'More bags, always cash, at diamond weight'),
    detail: bilingual('平均钱袋数量增加约30%，固定为钻石重量2；三叶草仍会提高现金奖励。', 'About 30% more bags on average, each fixed at diamond weight 2. Clover still improves the cash reward.'),
  },
  {
    id: 'thief', name: bilingual('窃贼', 'Thief'),
    description: bilingual('每次商店可免费偷取2件商品', 'Take two shop items for free each visit'),
    detail: bilingual('只能选择本店已上架且未售出的商品；全队共用2次，正常扣库存，次数不跨店累积。', 'Choose stocked, unsold items only. The team shares two thefts per visit. Stock is consumed and unused thefts do not carry over.'),
  },
  {
    id: 'risk-reward', name: bilingual('富贵险中求', 'Risk Reward'),
    description: bilingual(`TNT附近的黄金、钻石价值增加${Math.round((RISK_VALUE_MULTIPLIER - 1) * 100)}%`, `Gold and diamonds near TNT are worth ${Math.round((RISK_VALUE_MULTIPLIER - 1) * 100)}% more`),
    detail: bilingual(`仅TNT爆炸半径${RISK_RADIUS_MULTIPLIER * 100}%范围内生效；抓住时锁定加成，可与收藏家和抛光剂乘算；鼹鼠本身的2元不加成；与拆弹专家互斥。`, `Only within ${RISK_RADIUS_MULTIPLIER * 100}% of the TNT blast radius. Locks at capture and multiplies with collectors and polish. The mole's $2 body value is not boosted. Cannot be combined with Bomb Expert.`),
  },
  {
    id: 'time-bank', name: bilingual('时间银行', 'Time Bank'),
    description: bilingual(`提前过关时，每剩余1秒获得${TIME_BANK_COINS_PER_SECOND}元`, `Finish early for $${TIME_BANK_COINS_PER_SECOND} per second left`),
    detail: bilingual('按界面剩余整秒结算；主动收工或清空矿场提前过关均生效，不再延长下一关。轻装上阵的额外时间也可兑现。', 'Uses the whole seconds shown on the timer. Applies when finishing early or clearing the mine after reaching the goal. Never extends the next stage. Extra time from Travel Light also counts.'),
  },
  {
    id: 'airy-moles', name: bilingual('透气的鼹鼠', 'Airy Moles'),
    description: bilingual('携钻鼹鼠更容易出现在矿场中上层', 'Diamond moles favor the upper and middle mine'),
    detail: bilingual('将携钻鼹鼠的出生位置偏向中层和上层，也影响额外生成的鼹鼠；不再改变移动速度或回拉重量。', 'Shifts diamond mole spawns toward the middle and upper thirds, including extra moles. Speed and hauling weight stay unchanged.'),
  },
  {
    id: 'time-rush', name: bilingual('争分夺秒', 'Time Rush'),
    description: bilingual(`每关基础时间缩短20%，黄金和钻石价值增加${Math.round((RUSH_VALUE_MULTIPLIER - 1) * 100)}%`, `20% less base time; gold and diamonds worth ${Math.round((RUSH_VALUE_MULTIPLIER - 1) * 100)}% more`),
    detail: bilingual('不改变目标金币；收益可与收藏家、抛光剂及富贵险中求乘算，不加成鼹鼠本身的2元。', 'Goals stay unchanged. Multiplies with collectors, polish, and Risk Reward, but not the mole body value of $2.'),
  },
  {
    id: 'regular-customer', name: bilingual('老主顾', 'Regular Customer'),
    description: bilingual('每次商店必有大力水、三叶草和钻石抛光剂', 'Every shop stocks strength, clover, and diamond polish'),
    detail: bilingual('价格与每店限购1件保持不变；可正常购买或用窃贼偷取，选到后立即影响本次商店。', 'Normal prices and one-unit limits still apply. Buy or steal the items as usual. Takes effect in the shop immediately after selection.'),
  },
  {
    id: 'archaeologist', name: bilingual('考古学家', 'Archaeologist'),
    description: bilingual('长骨140元、头骨400元，每关额外出现各1件', 'Long bones pay $140; skulls $400; one extra of each per stage'),
    detail: bilingual('每关全队额外生成1根长骨和1颗头骨，可与化石拼图叠加。重量保持不变；骨头不受石头书、收藏家或富贵险中求加成。', 'Adds one long bone and one skull per shared mine, stacking with Fossil Puzzle. Weights stay unchanged. The rock book, collectors, and Risk Reward do not boost bones.'),
  },
  {
    id: 'clone', name: bilingual('克隆', 'Clone'),
    description: bilingual('每关首次抓住的物品，最终收益翻倍', 'The first item caught each stage pays double'),
    detail: bilingual('全队共享1次，抓住即锁定，需成功带回；现金与炸药翻倍，生力不叠加，炸毁也消耗本关机会。', 'One shared capture per stage, locked when caught and paid on collection. Cash and dynamite double; fast hauling does not stack. Destroying the cargo still spends the chance.'),
  },
  {
    id: 'fossil-puzzle', name: bilingual('化石拼图', 'Fossil Puzzle'),
    description: bilingual('每关集齐长骨和头骨，额外获得500元', 'Collect a long bone and a skull for an extra $500'),
    detail: bilingual('每关全队额外生成1根长骨和1颗头骨，可与考古学家叠加。两种各收回1件即可，顺序不限，全队共享每关1次；骨头正常结算，拼图奖金不受克隆等售价加成。', 'Adds one long bone and one skull per shared mine, stacking with Archaeologist. Collect both types in either order, once per shared stage. Bones pay normally; Clone and other value bonuses do not multiply the $500 reward.'),
  },
  {
    id: 'gold-growth', name: bilingual('黄金生长', 'Gold Growth'),
    description: bilingual(`每${GOLD_GROWTH_INTERVAL}秒，随机一颗黄金长大一档`, `One random nugget grows a tier every ${GOLD_GROWTH_INTERVAL} seconds`),
    detail: bilingual('每次仅1颗：50→100→250→500元；从地下未抓住且未满档的黄金中等概率抽选，同一颗可多次长大，体积和重量同步增长；暂停不计时。', 'One nugget at a time: $50 to $100 to $250 to $500. Uniformly picks unclaimed, underground gold below the top tier. The same nugget can grow again, including size and weight. Paused time does not count.'),
  },
  {
    id: 'travel-light', name: bilingual('轻装上阵', 'Travel Light'),
    description: bilingual(`商店不买也不偷，下一关额外增加${TRAVEL_LIGHT_BONUS_SECONDS}秒`, `Skip buying and stealing for ${TRAVEL_LIGHT_BONUS_SECONDS} extra seconds next stage`),
    detail: bilingual(`只看本店成功购买或偷取记录，空店也可触发；在所有时长倍率之后加时，不受争分夺秒影响。首关不加时，不跨关累积，双人共享${TRAVEL_LIGHT_BONUS_SECONDS}秒。`, `Applies if nothing was bought or stolen this visit, including empty shops. Adds time after all duration multipliers, so Time Rush never reduces it. No first-stage bonus or carryover; co-op shares the extra ${TRAVEL_LIGHT_BONUS_SECONDS} seconds.`),
  },
  {
    id: 'rock-crusher', name: bilingual('碎石机', 'Rock Crusher'),
    description: bilingual('钩子粉碎沿途所有石头，不再抓起石头', 'Crushes all rocks along the claw path instead of hauling them'),
    detail: bilingual('大小石头立即碎裂，碎屑仅为动画、无收益，不消耗克隆；钩子继续前进，其他物品及TNT仍按原规则处理。双人均生效，与点石成金互斥。', 'Small and large rocks shatter into decorative debris, with no payout or Clone use. The claw continues through them; other items and TNT keep their normal behavior. Works for both miners. Cannot be combined with Alchemy.'),
  },
  {
    id: 'right-angle-turn', name: bilingual('直角转弯', 'Right-Angle Turn'),
    description: bilingual('出钩后再按一次下钩键，钩子转弯90°', 'Press launch again mid-shot to turn the claw 90°'),
    detail: bilingual('每钩限1次，抓住物品或开始回收后不可转弯。偏左向右转，偏右向左转，完全竖直时随机左右；沿原路径收回，搭配射线可实时预览。', 'Once per shot, before capture or retraction. Left-leaning shots turn right; right-leaning shots turn left. Exactly vertical shots randomly turn left or right. Returns along the same path. Aim Line previews the turn live.'),
  },
];

export function getAbility(id: AbilityId, mode: Mode, language: Language = DEFAULT_LANGUAGE): Ability {
  const definition = ABILITIES.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown ability: ${id}`);
  const ability: Ability = {
    id, name: definition.name[language], description: definition.description[language], detail: definition.detail[language],
  };
  const bankLimit = (mode === 'coop' ? 40 : 60) * TIME_BANK_COINS_PER_SECOND;
  return id === 'time-bank'
    ? { ...ability, detail: ability.detail + bilingual(
      `${mode === 'coop' ? '双人共享奖励，' : ''}基础时限最多${bankLimit}元。`,
      ` ${mode === 'coop' ? 'Shared in co-op. ' : ''}Up to $${bankLimit.toLocaleString('en-US')} at the base time limit.`,
    )[language] }
    : ability;
}

export function needsAbilityChoice(level: number, count: number): boolean {
  const index = ABILITY_LEVELS.indexOf(level);
  return index !== -1 && count <= index && count < MAX_ABILITIES;
}

export function canAcquireAbility(id: AbilityId, owned: readonly AbilityId[]): boolean {
  return owned.length < MAX_ABILITIES && !owned.includes(id)
    && !(id === 'risk-reward' && owned.includes('bomb-expert'))
    && !(id === 'bomb-expert' && owned.includes('risk-reward'))
    && !(id === 'rock-crusher' && owned.includes('alchemy'))
    && !(id === 'alchemy' && owned.includes('rock-crusher'));
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
