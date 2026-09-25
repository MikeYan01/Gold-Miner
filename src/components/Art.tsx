import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { drawAbilityIcon, drawItemIcon } from '../game/render';
import type { AbilityId, PlayerId, ShopItemId } from '../game/types';

export type IconName =
  | 'pickaxe' | 'sound' | 'muted' | 'help' | 'pause' | 'play' | 'arrow' | 'home'
  | 'coin' | 'clock' | 'target' | 'trophy' | 'close' | 'users' | 'user' | 'bomb'
  | 'check' | 'refresh' | 'cart' | 'sparkle' | 'hand';

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    pickaxe: <><path d="m6 21 12-17M3 5c7-3 14 0 18 7l-8-4-5-1Z" /><path d="m7 18 2 2" /></>,
    sound: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m16 9 5 6m0-6-5 6" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2" /><path d="M12 16h.01" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
    play: <path d="m8 4 12 8-12 8z" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10" /><path d="M9 21v-8h6v8" /></>,
    coin: <><ellipse cx="12" cy="12" rx="9" ry="10" /><ellipse cx="12" cy="12" rx="6" ry="7" /><path d="M12 8v8m2-7h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3h-3" /></>,
    clock: <><circle cx="12" cy="13" r="8" /><path d="M12 8v5l3 2M9 2h6m-3 0v3M19 6l2-2" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    trophy: <><path d="M7 3h10v7a5 5 0 0 1-10 0zM12 15v5M8 21h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v1" /></>,
    user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    bomb: <><circle cx="10" cy="14" r="7" /><path d="m14 8 2-3 3 1m0 0 2-3m-1 5h3M17 3V1" /><path d="M6 12a4 4 0 0 1 2-2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.5 6A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.5 6" /></>,
    cart: <><path d="M2 3h3l3 13h11l3-9H6" /><circle cx="9" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
    sparkle: <><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z" /></>,
    hand: <><path d="M6 13V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v5c0 5-3 8-8 8-3 0-5-2-7-4l-4-5a2 2 0 0 1 3-2l3 2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Avatar({ player = 1 }: { player?: PlayerId }) {
  return (
    <svg viewBox="0 0 48 48" className="miner-avatar" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill={player === 1 ? '#e3bd5d' : '#a8c6dc'} stroke="#805e2b" />
      <path d="M7 48V38c3-13 29-16 35 0v10" fill={player === 1 ? '#a1672d' : '#477ca2'} stroke="#5f4326" />
      <ellipse cx="25" cy="23" rx="14" ry="16" fill="#ffce91" stroke="#946334" strokeWidth="1.5" />
      <path d="m11 21-3-9 8-7 7 1-1-5 12 6 6 11-5 5-5-11-13 2Z" fill="#bfc3bc" stroke="#575e55" strokeWidth="1.5" />
      <path d="m11 27 3-8 5 12 10-1 9-7c2 16-7 17-15 23l-8-6Z" fill="#b8bcb5" stroke="#666f62" strokeWidth="1.3" />
      <path d="m15 28 3 10 4 3-1-13" fill="#e8e7d6" />
      <ellipse cx="21" cy="23" rx="2" ry="3" fill="#fff" /><ellipse cx="32" cy="22" rx="2" ry="3" fill="#fff" />
      <circle cx="22" cy="23" r="1.2" fill="#2a5a89" /><circle cx="33" cy="22" r="1.2" fill="#2a5a89" />
      <ellipse cx="29" cy="28" rx="7" ry="5" fill="#ffc07f" stroke="#b67a43" />
    </svg>
  );
}

export function ItemArt({ item }: { item: ShopItemId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to draw the shop illustrations.');
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.clearRect(0, 0, 100, 100);
    drawItemIcon(context, item, 100);
  }, [item]);
  return <canvas ref={ref} width="200" height="200" className="item-art" aria-hidden="true" />;
}

export function AbilityArt({ ability }: { ability: AbilityId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to draw the ability illustrations.');
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.clearRect(0, 0, 100, 100);
    drawAbilityIcon(context, ability, 100);
  }, [ability]);
  return <canvas ref={ref} width="200" height="200" className="ability-art" aria-hidden="true" />;
}

export function Merchant() {
  return (
    <svg className="merchant-art" viewBox="0 0 240 215" aria-hidden="true">
      <ellipse cx="120" cy="201" rx="98" ry="9" fill="#88653920" />
      <path d="M58 172c-7-39 21-58 61-59 36 0 59 21 66 61" fill="#9b9d77" stroke="#685b3e" strokeWidth="3" />
      <path d="m79 123 15-8 10 61H79zm65-7 20 10-9 52h-19Z" fill="#ad7850" stroke="#775338" strokeWidth="2" />
      <path d="M52 160c-3-13 6-28 14-22 15 10 18 21 15 32" fill="#d9ab74" stroke="#936941" strokeWidth="2" />
      <path d="M181 157c9-9 5-27-5-25-12 2-16 21-10 31" fill="#d9ab74" stroke="#936941" strokeWidth="2" />
      <ellipse cx="83" cy="90" rx="10" ry="15" fill="#dbae78" stroke="#967348" strokeWidth="2" />
      <ellipse cx="157" cy="90" rx="10" ry="15" fill="#dbae78" stroke="#967348" strokeWidth="2" />
      <path d="M83 71c-4 31 2 67 37 70 31-1 40-43 34-71" fill="#edc793" stroke="#967348" strokeWidth="2.5" />
      <path d="M83 97c-2 34 12 48 21 43 5 15 25 18 33 0 17 1 23-22 19-43-14 16-56 20-73 0Z" fill="#f0e4c9" stroke="#bead8a" strokeWidth="2" />
      <ellipse cx="104" cy="87" rx="3" ry="4" fill="#554634" /><ellipse cx="139" cy="87" rx="3" ry="4" fill="#554634" />
      <path d="m96 79 14-2m22 0 13 3" stroke="#efdfbd" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="122" cy="102" rx="12" ry="9" fill="#dfa773" stroke="#bc895a" strokeWidth="1.5" />
      <path d="M120 111c-9 7-17 7-24 0m28 0c9 8 17 7 23 0" fill="none" stroke="#fff1d6" strokeWidth="8" strokeLinecap="round" />
      <path d="m77 58 15-42 26 7 23-7 24 47" fill="#9c6b39" stroke="#775137" strokeWidth="3" strokeLinejoin="round" />
      <path d="m85 46 69 1 5 16H79Z" fill="#c28e4b" stroke="#775137" strokeWidth="2" />
      <path d="M61 62c31-5 79-5 117 0 3 3 2 12-2 15-38 4-77 5-112-1-6-4-6-10-3-14Z" fill="#be8d4c" stroke="#775137" strokeWidth="3" />
      <path d="m120 49 4 6 7 1-5 5 1 7-7-3-6 3 1-7-5-5 7-1Z" fill="#f0d078" stroke="#997132" />
      <rect x="25" y="171" width="191" height="30" rx="4" fill="#b98a50" stroke="#87633b" strokeWidth="3" />
      <path d="M28 181h185M38 195h72m20 0h73" stroke="#957041" strokeWidth="2" opacity=".65" />
      <path d="M36 171c-11-28-1-45 17-48l-4-13 14 3 13-4-6 14c22 10 28 34 10 48Z" fill="#c9a267" stroke="#8f683b" strokeWidth="2" />
      <path d="M50 123h20" stroke="#785534" strokeWidth="4" />
      <text x="59" y="157" fontSize="25" textAnchor="middle" fill="#f9e0ab" fontFamily="Georgia, serif" fontWeight="bold">$</text>
      <ellipse cx="157" cy="167" rx="15" ry="4" fill="#e9bb48" stroke="#ac7e2d" strokeWidth="2" />
      <ellipse cx="157" cy="162" rx="15" ry="4" fill="#f9d46b" stroke="#ac7e2d" strokeWidth="2" />
      <ellipse cx="174" cy="170" rx="11" ry="3" fill="#f9d46b" stroke="#ac7e2d" strokeWidth="2" />
    </svg>
  );
}
