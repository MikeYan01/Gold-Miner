import { HEIGHT, makeEntity, REST_LENGTH, SURFACE, WIDTH } from './levels';
import { canEarnRiskReward, findHookHit, hookTip, maxHookLength, reelDistanceScale } from './engine';
import type { AbilityId, Entity, GameState, Player, ShopItemId } from './types';
import { createViewport, DEFAULT_VIEWPORT, projectPoint } from './viewport';
import type { Viewport } from './viewport';
import { createRandom } from './random';
import { CLONE_REWARD_MULTIPLIER, GOLD_GROWTH_INTERVAL, SLOW_FUSE_SECONDS, WIDE_CLAW_MULTIPLIER } from './abilities';
import { interpolatedReelDistance } from './hauling';
import { DEFAULT_LANGUAGE, localize } from './i18n';
import type { Language } from './i18n';

type Context = CanvasRenderingContext2D;

function path(c: Context, points: readonly (readonly [number, number])[], fill: string, stroke?: string, lineWidth = 2): void {
  c.beginPath();
  points.forEach(([x, y], index) => index === 0 ? c.moveTo(x, y) : c.lineTo(x, y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lineWidth;
    c.lineJoin = 'round';
    c.stroke();
  }
}

function ellipse(c: Context, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lineWidth = 2): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lineWidth;
    c.stroke();
  }
}

function rounded(c: Context, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lineWidth = 2): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lineWidth;
    c.stroke();
  }
}

function star(c: Context, x: number, y: number, size: number, fill: string): void {
  path(c, [[x, y - size], [x + size * 0.24, y - size * 0.24], [x + size, y], [x + size * 0.24, y + size * 0.24],
    [x, y + size], [x - size * 0.24, y + size * 0.24], [x - size, y], [x - size * 0.24, y - size * 0.24]], fill);
}

function gold(c: Context, radius: number): void {
  const r = radius;
  ellipse(c, 3, r * 0.78, r * 0.91, r * 0.2, '#78512138');
  const fill = c.createLinearGradient(-r * 0.3, -r, r * 0.45, r);
  fill.addColorStop(0, '#ffff56');
  fill.addColorStop(0.3, '#ffe600');
  fill.addColorStop(0.7, '#f5c400');
  fill.addColorStop(1, '#c59000');
  c.beginPath();
  c.moveTo(-r * 0.91, r * 0.03);
  c.bezierCurveTo(-r * 1.08, -r * 0.34, -r * 0.69, -r * 0.38, -r * 0.7, -r * 0.64);
  c.bezierCurveTo(-r * 0.73, -r * 0.93, -r * 0.36, -r * 0.8, -r * 0.18, -r * 0.96);
  c.bezierCurveTo(r * 0.04, -r * 1.1, r * 0.26, -r * 0.71, r * 0.42, -r * 0.79);
  c.bezierCurveTo(r * 0.72, -r * 0.94, r * 0.96, -r * 0.56, r * 0.85, -r * 0.34);
  c.bezierCurveTo(r * 0.79, -r * 0.16, r * 1.15, r * 0.02, r * 0.91, r * 0.31);
  c.bezierCurveTo(r * 0.82, r * 0.43, r * 1.01, r * 0.7, r * 0.63, r * 0.74);
  c.bezierCurveTo(r * 0.37, r * 0.74, r * 0.36, r * 1.01, r * 0.08, r * 0.9);
  c.bezierCurveTo(-r * 0.16, r * 0.77, -r * 0.37, r * 1.0, -r * 0.56, r * 0.75);
  c.bezierCurveTo(-r * 0.71, r * 0.51, -r * 1.08, r * 0.49, -r * 0.91, r * 0.03);
  c.closePath();
  c.fillStyle = fill;
  c.strokeStyle = '#795306';
  c.lineWidth = Math.max(1.6, r * 0.046);
  c.fill();
  c.stroke();
  c.save();
  c.clip();
  const gleam = c.createRadialGradient(-r * 0.33, -r * 0.52, 0, -r * 0.33, -r * 0.52, r * 0.53);
  gleam.addColorStop(0, '#fffeb3');
  gleam.addColorStop(0.3, '#fffd708e');
  gleam.addColorStop(1, '#ffff0000');
  c.fillStyle = gleam;
  c.fillRect(-r, -r, r * 2, r * 2);
  c.beginPath();
  c.moveTo(-r * 0.84, r * 0.24);
  c.quadraticCurveTo(-r * 0.49, r * 0.36, -r * 0.34, r * 0.57);
  c.quadraticCurveTo(r * 0.16, r * 0.57, r * 0.72, r * 0.28);
  c.quadraticCurveTo(r * 0.42, r * 0.76, r * 0.12, r * 0.84);
  c.lineTo(-r * 0.68, r * 0.79);
  c.closePath();
  c.fillStyle = '#b391002a';
  c.fill();
  c.restore();
}

function rock(c: Context, radius: number, large = false): void {
  const r = radius;
  ellipse(c, 3, r * 0.7, r * 0.94, r * 0.22, '#62482236');
  path(c, [[-r * 0.95, -r * 0.08], [-r * 0.7, -r * 0.57], [-r * 0.34, -r * 0.78],
    [r * 0.29, -r * 0.74], [r * 0.69, -r * 0.37], [r * 0.92, r * 0.22],
    [r * 0.6, r * 0.72], [-r * 0.31, r * 0.79], [-r * 0.78, r * 0.48]], '#93938d', '#46443b', 2);
  path(c, [[-r * 0.86, -r * 0.08], [-r * 0.64, -r * 0.53], [-r * 0.31, -r * 0.72],
    [r * 0.23, -r * 0.68], [r * 0.53, -r * 0.34], [r * 0.05, -r * 0.21], [-r * 0.32, r * 0.11]], '#b7b7ae');
  path(c, [[r * 0.58, -r * 0.3], [r * 0.84, r * 0.21], [r * 0.55, r * 0.65],
    [-r * 0.25, r * 0.72], [-r * 0.65, r * 0.47], [r * 0.24, r * 0.28]], '#72756e');
  c.strokeStyle = '#686960';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-r * 0.3, -r * 0.51);
  c.lineTo(-r * 0.08, -r * 0.13);
  c.lineTo(-r * 0.32, r * 0.17);
  c.moveTo(-r * 0.08, -r * 0.13);
  c.lineTo(r * 0.2, -r * 0.17);
  c.stroke();
  ellipse(c, -r * 0.55, -r * 0.12, 2, 2, '#d4d1bb');
  if (large) {
    c.strokeStyle = '#4d5147';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(r * 0.17, -r * 0.7);
    c.lineTo(r * 0.05, -r * 0.4);
    c.lineTo(r * 0.3, -r * 0.18);
    c.lineTo(r * 0.16, r * 0.11);
    c.lineTo(r * 0.42, r * 0.33);
    c.moveTo(r * 0.3, -r * 0.18);
    c.lineTo(r * 0.59, -r * 0.27);
    c.moveTo(r * 0.16, r * 0.11);
    c.lineTo(-r * 0.1, r * 0.26);
    c.lineTo(-r * 0.03, r * 0.65);
    c.stroke();
    ellipse(c, -r * 0.56, r * 0.32, 3.2, 2.4, '#76776b');
    ellipse(c, r * 0.54, r * 0.13, 2.5, 2, '#bab9a8');
  }
}

function diamond(c: Context, radius: number, time = 0): void {
  const r = radius;
  c.save();
  c.shadowColor = '#b7f7ff';
  c.shadowBlur = 4;
  path(c, [[-r, -r * 0.22], [-r * 0.54, -r * 0.77], [r * 0.54, -r * 0.77], [r, -r * 0.22], [0, r]], '#73ddf4', '#246c85', 2);
  c.shadowBlur = 0;
  path(c, [[-r, -r * 0.22], [0, -r * 0.22], [0, r]], '#379fc8');
  path(c, [[r, -r * 0.22], [0, -r * 0.22], [0, r]], '#9cecff');
  path(c, [[-r * 0.54, -r * 0.75], [0, -r * 0.75], [-r * 0.35, -r * 0.22], [-r * 0.96, -r * 0.22]], '#e5fff0');
  path(c, [[0, -r * 0.75], [r * 0.54, -r * 0.75], [r * 0.96, -r * 0.22], [r * 0.35, -r * 0.22]], '#83d5ce');
  path(c, [[-r * 0.35, -r * 0.22], [r * 0.35, -r * 0.22], [0, r * 0.93]], '#e2fff0');
  star(c, r * 0.55, -r * 0.8, 4 + Math.sin(time * 3) * 1.5, '#fffef1');
  c.restore();
}

function bag(c: Context, radius: number): void {
  const r = radius;
  ellipse(c, 1, r * 0.86, r * 0.9, r * 0.21, '#8a5f382b');
  c.beginPath();
  c.moveTo(-r * 0.38, -r * 0.55);
  c.bezierCurveTo(-r * 1.08, -r * 0.06, -r * 1.05, r * 0.86, -r * 0.3, r * 0.95);
  c.bezierCurveTo(r * 0.71, r * 1.09, r * 1.16, r * 0.56, r * 0.59, -r * 0.28);
  c.lineTo(r * 0.31, -r * 0.58);
  c.closePath();
  c.fillStyle = '#bb873e';
  c.strokeStyle = '#593e1c';
  c.lineWidth = 2.5;
  c.fill();
  c.stroke();
  path(c, [[-r * 0.31, -r * 0.55], [-r * 0.55, -r], [-r * 0.04, -r * 0.87], [r * 0.49, -r], [r * 0.25, -r * 0.55]], '#e0b373', '#805733');
  rounded(c, -r * 0.4, -r * 0.6, r * 0.75, 5, 2, '#775334');
  c.fillStyle = '#f5dbaa';
  c.font = `bold ${r * 1.5}px Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('?', 0, r * 0.24);
  c.strokeStyle = '#ddb476';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-r * 0.48, -r * 0.11);
  c.quadraticCurveTo(-r * 0.75, r * 0.43, -r * 0.45, r * 0.64);
  c.stroke();
}

function bone(c: Context, radius: number): void {
  c.save();
  c.rotate(-0.35);
  c.strokeStyle = '#8b7954';
  c.fillStyle = '#ecdbac';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-radius * 0.56, -6);
  c.bezierCurveTo(-radius, -19, -radius * 1.12, -3, -radius * 0.79, 0);
  c.bezierCurveTo(-radius * 1.12, 12, -radius * 0.6, 17, -radius * 0.5, 6);
  c.lineTo(radius * 0.5, 6);
  c.bezierCurveTo(radius * 0.6, 17, radius * 1.12, 12, radius * 0.79, 0);
  c.bezierCurveTo(radius * 1.12, -13, radius * 0.6, -17, radius * 0.5, -6);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = '#fff1cc';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-radius * 0.46, -3);
  c.lineTo(radius * 0.45, -3);
  c.stroke();
  c.restore();
}

function skull(c: Context, radius: number): void {
  const r = radius;
  ellipse(c, 2, r * 0.88, r * 0.69, r * 0.17, '#68523236');
  c.beginPath();
  c.moveTo(-r * 0.7, r * 0.21);
  c.bezierCurveTo(-r * 1.08, -r * 0.42, -r * 0.74, -r * 1.03, -r * 0.05, -r * 0.96);
  c.bezierCurveTo(r * 0.68, -r * 1.07, r * 1.03, -r * 0.42, r * 0.74, r * 0.22);
  c.lineTo(r * 0.49, r * 0.41);
  c.lineTo(r * 0.46, r * 0.85);
  c.quadraticCurveTo(0, r * 0.99, -r * 0.47, r * 0.83);
  c.lineTo(-r * 0.5, r * 0.41);
  c.closePath();
  c.fillStyle = '#eadcba';
  c.strokeStyle = '#77674b';
  c.lineWidth = 2.3;
  c.fill();
  c.stroke();
  c.strokeStyle = '#fff3d5';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-r * 0.65, -r * 0.34);
  c.bezierCurveTo(-r * 0.67, -r * 0.77, -r * 0.11, -r * 0.9, r * 0.3, -r * 0.74);
  c.stroke();
  ellipse(c, -r * 0.32, -r * 0.12, r * 0.22, r * 0.27, '#5e5748', '#a8946c', 1.4);
  ellipse(c, r * 0.31, -r * 0.11, r * 0.22, r * 0.27, '#5e5748', '#a8946c', 1.4);
  path(c, [[0, r * 0.12], [-r * 0.12, r * 0.35], [r * 0.12, r * 0.35]], '#6a604a');
  c.strokeStyle = '#9a8866';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-r * 0.43, r * 0.5);
  c.lineTo(r * 0.43, r * 0.5);
  for (const x of [-0.23, 0, 0.23]) {
    c.moveTo(r * x, r * 0.5);
    c.lineTo(r * x, r * 0.86);
  }
  c.moveTo(r * 0.06, -r * 0.9);
  c.lineTo(-r * 0.03, -r * 0.64);
  c.lineTo(r * 0.1, -r * 0.54);
  c.stroke();
}

function tnt(c: Context, radius: number, disarmed = false): void {
  const r = radius;
  rounded(c, -r, -r * 0.76, r * 2, r * 1.5, 3, '#b77543', '#73472f', 2.5);
  for (let i = 0; i < 4; i++) {
    rounded(c, -r * 0.8 + i * r * 0.42, -r * 0.68, r * 0.33, r * 1.25, 3, '#c74e39', '#943d2d', 1);
  }
  rounded(c, -r - 2, -r * 0.23, r * 2 + 4, r * 0.62, 2, '#ead0a0', '#815338', 1.5);
  c.fillStyle = '#9f3f2e';
  c.font = 'bold 17px Georgia, serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('TNT', 0, r * 0.11);
  c.strokeStyle = '#705134';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, -r * 0.73);
  c.quadraticCurveTo(-6, -r * 1.23, 8, -r * 1.1);
  c.stroke();
  if (!disarmed) star(c, 9, -r * 1.1, 5, '#ffd363');
}

function tntFragment(c: Context, radius: number): void {
  const r = radius;
  path(c, [[-r, -r * 0.5], [-r * 0.1, -r], [r * 0.8, -r * 0.2], [r, r * 0.6], [-r * 0.6, r]],
    '#776451', '#453d35', 2);
  path(c, [[-r * 0.7, -r * 0.2], [r * 0.5, -r * 0.1], [r * 0.3, r * 0.45], [-r * 0.8, r * 0.4]],
    '#ae6750', '#634735', 1);
  c.strokeStyle = '#d0b998'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-r * 0.3, -r * 0.4); c.lineTo(r * 0.3, r * 0.2); c.stroke();
}

function mole(c: Context, entity: Entity, time: number): void {
  c.save();
  c.scale(entity.direction, 1);
  const walk = entity.claimedBy === null ? Math.sin(time * 16) * 2 : 0;
  ellipse(c, 0, 13, 26, 7, '#80644122');
  ellipse(c, -12, 10 + walk, 8, 5, '#b58a68', '#715440', 1.5);
  ellipse(c, 11, 10 - walk, 8, 5, '#b58a68', '#715440', 1.5);
  ellipse(c, -1, -1, 25, 17, '#987758', '#654d3b', 2);
  ellipse(c, 7, -5, 16, 13, '#b4936e');
  ellipse(c, 24, 0, 8, 5, '#d79a84', '#876149', 1.5);
  ellipse(c, 4, -15, 6, 7, '#b39473', '#795b43', 1.5);
  ellipse(c, 15, -6, 3, 4, '#fff2d5');
  ellipse(c, 16, -5, 1.7, 2.7, '#42372a');
  c.strokeStyle = '#745b42';
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-20, -6);
  c.lineTo(-14, -9);
  c.moveTo(-19, 0);
  c.lineTo(-12, -3);
  c.stroke();
  if (entity.kind === 'mole-diamond') {
    c.translate(-7, -24);
    diamond(c, 13, time);
  }
  c.restore();
}

function cloud(c: Context, x: number, y: number, scale: number, viewport: Viewport): void {
  c.save();
  c.translate(x, y);
  c.scale(scale / viewport.stretchX, scale / viewport.stretchY);
  c.beginPath();
  c.moveTo(-45, 12);
  c.bezierCurveTo(-62, -6, -37, -21, -20, -15);
  c.bezierCurveTo(-20, -46, 22, -47, 32, -23);
  c.bezierCurveTo(58, -32, 70, -8, 62, 4);
  c.bezierCurveTo(84, 4, 85, 22, 66, 25);
  c.lineTo(-41, 25);
  c.bezierCurveTo(-62, 25, -60, 12, -45, 12);
  c.fillStyle = '#fff2cf';
  c.fill();
  c.restore();
}

function cactus(c: Context, x: number, y: number, scale: number, viewport: Viewport): void {
  c.save();
  c.translate(x, SURFACE - (SURFACE - y) / viewport.stretchY);
  c.scale(scale / viewport.stretchX, scale / viewport.stretchY);
  c.lineWidth = 12;
  c.lineCap = 'round';
  c.strokeStyle = '#8f9b69';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -50);
  c.moveTo(0, -22);
  c.lineTo(-17, -22);
  c.lineTo(-17, -39);
  c.moveTo(0, -12);
  c.lineTo(18, -12);
  c.lineTo(18, -31);
  c.stroke();
  c.strokeStyle = '#b1b886';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-2, -3);
  c.lineTo(-2, -46);
  c.stroke();
  c.restore();
}

function terrain(c: Context, level: number, viewport: Viewport): void {
  const random = createRandom(512 + level * 73);
  const sky = c.createLinearGradient(0, 0, 0, SURFACE);
  sky.addColorStop(0, '#ffeaa0');
  sky.addColorStop(1, '#e8c576');
  c.fillStyle = sky;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  ellipse(c, 1023, 51, 34 / viewport.stretchX, 34 / viewport.stretchY, '#fff2a1');
  cloud(c, 186, 42, 0.55, viewport);
  cloud(c, 792, 29, 0.41, viewport);
  path(c, [[0, 139], [55, 111], [118, 96], [141, 114], [223, 137], [331, 163], [0, 178]], '#cda557');
  path(c, [[0, 148], [103, 111], [162, 139], [290, 168], [0, 178]], '#deba70');
  path(c, [[833, 170], [942, 124], [981, 115], [1049, 134], [1140, 109], [1200, 132], [1200, 179]], '#d0a85c');
  path(c, [[0, 159], [117, 153], [240, 162], [361, 151], [542, 164], [715, 153], [898, 162], [1060, 156], [1200, 163], [1200, 190], [0, 190]], '#b98d41');
  cactus(c, 254, 163, 0.45, viewport);
  cactus(c, 1113, 165, 0.38, viewport);
  const earth = c.createLinearGradient(0, SURFACE, 0, HEIGHT);
  earth.addColorStop(0, '#dcb986');
  earth.addColorStop(0.48, '#d7b27c');
  earth.addColorStop(1, '#cda573');
  c.fillStyle = earth;
  c.fillRect(0, SURFACE, WIDTH, HEIGHT - SURFACE);
  const edge: [number, number][] = [[0, SURFACE]];
  for (let x = 0; x <= WIDTH; x += 20) edge.push([x, SURFACE - 3 + random() * 6]);
  edge.push([WIDTH, SURFACE + 11], [0, SURFACE + 11]);
  path(c, edge, '#a87334');
  c.strokeStyle = '#705025';
  c.lineWidth = 1.5;
  c.beginPath();
  edge.slice(0, -2).forEach(([x, y], i) => i === 0 ? c.moveTo(x, y) : c.lineTo(x, y));
  c.stroke();
  for (let i = 0; i < 2700; i++) {
    const x = random() * WIDTH;
    const y = SURFACE + random() * (HEIGHT - SURFACE);
    const r = 0.5 + random() * 0.8;
    c.fillStyle = i % 3 === 0 ? '#ffe1a137' : '#89623521';
    c.fillRect(x, y, r * 1.4, r);
  }
  for (let i = 0; i < 48; i++) {
    const x = random() * WIDTH;
    const y = SURFACE + 45 + random() * (HEIGHT - SURFACE - 45);
    const size = 2 + random() * 6;
    ellipse(c, x, y, size, size * 0.49, '#ac895327');
  }
  for (let i = 0; i < 17; i++) {
    const x = random() * WIDTH;
    c.strokeStyle = '#80782c';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, SURFACE - 4);
    c.lineTo(x - 5, SURFACE - 8 - random() * 6);
    c.moveTo(x, SURFACE - 4);
    c.lineTo(x + 3, SURFACE - 13);
    c.stroke();
  }
}

function miner(c: Context, player: Player, time: number, showBadge: boolean, viewport: Viewport): void {
  c.save();
  c.translate(player.origin.x, player.origin.y);
  c.scale(1 / viewport.stretchX, 1 / viewport.stretchY);
  const blue = player.id === 2;
  const moving = player.phase === 'retracting';
  const turn = moving ? time * 8 : -1;
  const bob = moving ? Math.sin(turn * 2) * 1.2 : 0;
  ellipse(c, -10, 23, 66, 6, '#6c482442');
  rounded(c, -69, 15, 138, 9, 2, '#a3692f', '#593c1d', 2);
  rounded(c, -61, 23, 11, 6, 1, '#714820');
  rounded(c, 48, 23, 11, 6, 1, '#714820');
  c.save();
  c.translate(-32, bob);
  rounded(c, -18, -9, 17, 24, 4, '#344d69', '#283340', 2);
  rounded(c, 5, -9, 16, 24, 4, '#436183', '#283340', 2);
  rounded(c, -25, 9, 25, 10, 4, '#634221', '#362b1c', 2);
  rounded(c, 3, 9, 29, 10, 4, '#694826', '#362b1c', 2);
  rounded(c, -29, -53, 59, 49, 13, blue ? '#497ca1' : '#ae6e30', '#5b3c20', 2.4);
  path(c, [[-17, -51], [-4, -38], [4, -48], [15, -24], [11, -7], [-16, -8]], blue ? '#315779' : '#845125');
  c.strokeStyle = blue ? '#224963' : '#6e431f';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -24);
  c.lineTo(0, -7);
  c.moveTo(-17, -16);
  c.lineTo(-7, -16);
  c.stroke();
  ellipse(c, 5, -14, 2, 2, '#e1c16b', '#68481e', 1);
  rounded(c, -34, -43, 15, 31, 7, blue ? '#648eac' : '#bd7e3d', '#60401f', 2);
  ellipse(c, -24, -11, 8, 8, '#f1b470', '#925d30', 1.8);
  ellipse(c, -21, -76, 11, 13, '#eba568', '#895a35', 2);
  ellipse(c, 4, -80, 27, 30, '#ffd198', '#91643a', 2.2);
  path(c, [[-25, -85], [-30, -99], [-21, -108], [-30, -111], [-7, -115], [3, -111],
    [1, -120], [19, -110], [31, -94], [26, -82], [17, -96], [-2, -101], [-15, -96]], '#bcbeb9', '#565a53', 2);
  path(c, [[-23, -107], [-8, -111], [4, -108], [5, -114], [18, -105], [24, -98],
    [6, -104], [-12, -101]], '#e1e2d7');
  c.beginPath();
  c.moveTo(-21, -81);
  c.bezierCurveTo(-27, -62, -28, -41, -15, -30);
  c.lineTo(-10, -22);
  c.lineTo(-2, -27);
  c.quadraticCurveTo(12, -25, 23, -42);
  c.quadraticCurveTo(33, -57, 28, -75);
  c.quadraticCurveTo(8, -60, -5, -73);
  c.closePath();
  c.fillStyle = '#b6b9b3';
  c.strokeStyle = '#5c6057';
  c.lineWidth = 2;
  c.fill();
  c.stroke();
  path(c, [[-21, -71], [-16, -58], [-18, -41], [-8, -31], [-10, -47], [-7, -59]], '#e7e6d8');
  path(c, [[22, -57], [18, -39], [6, -30], [10, -44]], '#8b918a');
  ellipse(c, -3, -85, 4, 6, '#fff9e9', '#a07a4d', 1);
  ellipse(c, 16, -83, 4.5, 6, '#fff9e9', '#a07a4d', 1);
  ellipse(c, -1, -84, 1.8, 3, '#3c648a');
  ellipse(c, 18, -82, 1.8, 3, '#3c648a');
  c.strokeStyle = '#51442e';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-9, -92);
  c.lineTo(-2, -95);
  c.moveTo(13, -94);
  c.quadraticCurveTo(20, -98, 24, -90);
  c.stroke();
  ellipse(c, 13, -72, 15, 10, '#ffc487', '#b67f49', 1.8);
  ellipse(c, 9, -74, 9, 4, '#ffd8a1');
  c.strokeStyle = '#6b7067';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(7, -55);
  c.quadraticCurveTo(15, -52, 19, -61);
  c.stroke();
  const handX = 56 + Math.cos(turn) * 13;
  const handY = -15 + Math.sin(turn) * 13;
  c.strokeStyle = '#60401f';
  c.lineWidth = 16;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(24, -40);
  c.lineTo(37, -21);
  c.lineTo(handX, handY);
  c.stroke();
  c.strokeStyle = blue ? '#5687ad' : '#bd7d39';
  c.lineWidth = 12;
  c.stroke();
  ellipse(c, handX, handY, 8, 7, '#f4bc7e', '#916030', 1.7);
  c.restore();
  rounded(c, -3, -5, 54, 21, 2, '#b47d39', '#503718', 2);
  for (const x of [1, 43]) rounded(c, x, -29, 6, 45, 1, '#8a5d2c', '#4c331b', 1.5);
  c.save();
  c.translate(24, -15);
  c.rotate(turn);
  ellipse(c, 0, 0, 23, 23, '#ab7639', '#49351e', 2.5);
  ellipse(c, 0, 0, 18, 18, '#d5a353', '#63451f', 1.5);
  c.strokeStyle = '#745026';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-18, 0);
  c.lineTo(18, 0);
  c.moveTo(0, -18);
  c.lineTo(0, 18);
  c.stroke();
  ellipse(c, 0, 0, 5, 5, '#b3b3a2', '#424539', 1.5);
  ellipse(c, 13, 0, 4, 4, '#e4c084', '#765025', 1);
  c.restore();
  if (showBadge) {
    ellipse(c, -80, -65, 13, 13, blue ? '#4c83ac' : '#ba7730', '#514326', 1.5);
    c.fillStyle = '#fff0b8';
    c.font = 'bold 17px Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(player.id), -80, -64);
  }
  c.restore();
}

function rope(c: Context, player: Player, viewport: Viewport): void {
  const tip = projectPoint(hookTip(player), viewport);
  const origin = projectPoint(player.origin, viewport);
  c.save();
  c.scale(1 / viewport.stretchX, 1 / viewport.stretchY);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(origin.x, origin.y - 4);
  c.lineTo(tip.x, tip.y - 3);
  c.strokeStyle = '#34382f';
  c.lineWidth = 2.7;
  c.stroke();
  c.strokeStyle = '#a6a08a';
  c.lineWidth = 0.8;
  c.stroke();
  c.restore();
}

function aimLine(c: Context, player: Player, state: GameState, viewport: Viewport): void {
  if (player.phase !== 'swinging') return;
  const from = hookTip(player);
  const reach = maxHookLength(player);
  const end = {
    x: player.origin.x + Math.sin(player.angle) * reach,
    y: player.origin.y + Math.cos(player.angle) * reach,
  };
  const hit = findHookHit(from, end, state.entities, viewport, state.abilities);
  const to = hit ? { x: from.x + (end.x - from.x) * hit.t, y: from.y + (end.y - from.y) * hit.t } : end;
  const a = projectPoint(from, viewport);
  const b = projectPoint(to, viewport);
  c.save();
  c.scale(1 / viewport.stretchX, 1 / viewport.stretchY);
  c.strokeStyle = player.id === 1 ? '#866018b3' : '#376c9ecc';
  c.lineWidth = 1.8;
  c.setLineDash([7, 6]);
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
  c.setLineDash([]);
  ellipse(c, b.x, b.y, 4, 4, player.id === 1 ? '#ecc252' : '#8ac9de', '#725c36', 1);
  c.restore();
}

function claw(c: Context, player: Player, radius: number, viewport: Viewport, wide = false): void {
  const tip = hookTip(player);
  const spread = (radius > 0 ? Math.max(12, radius * 0.77) : 16) * (wide ? WIDE_CLAW_MULTIPLIER : 1);
  const depth = radius > 0 ? radius * 0.79 : 20;
  c.save();
  c.translate(tip.x, tip.y);
  c.scale(1 / viewport.stretchX, 1 / viewport.stretchY);
  c.rotate(-Math.atan2(Math.sin(player.angle) * viewport.stretchX, Math.cos(player.angle) * viewport.stretchY));
  ellipse(c, 0, -5, 5, 6, '#a1a8a2', '#343b37', 2);
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 3, -3);
    c.bezierCurveTo(side * spread, 1, side * (spread + 3), depth * 0.65, side * (spread * 0.48), depth);
    c.strokeStyle = '#303a36';
    c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = '#aebcb3';
    c.lineWidth = 3;
    c.stroke();
  }
  c.restore();
}

export function drawItemIcon(c: Context, id: ShopItemId, size: number): void {
  c.save();
  c.translate(size / 2, size / 2);
  c.scale(size / 100, size / 100);
  if (id === 'dynamite') {
    tnt(c, 27);
  } else if (id === 'strength') {
    rounded(c, -12, -38, 24, 14, 3, '#ad8245', '#785737', 2);
    c.beginPath();
    c.moveTo(-11, -25);
    c.lineTo(-11, -14);
    c.bezierCurveTo(-35, -6, -31, 29, -19, 33);
    c.quadraticCurveTo(0, 41, 20, 33);
    c.bezierCurveTo(33, 21, 31, -5, 11, -14);
    c.lineTo(11, -25);
    c.closePath();
    c.fillStyle = '#c85b35';
    c.strokeStyle = '#7f5436';
    c.lineWidth = 3;
    c.fill();
    c.stroke();
    rounded(c, -23, 0, 46, 23, 4, '#f6deb0');
    path(c, [[3, -1], [-10, 13], [-1, 13], [-5, 24], [12, 8], [3, 8]], '#c88b33');
    c.strokeStyle = '#ea9a62';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-17, -7);
    c.quadraticCurveTo(-25, 4, -22, 14);
    c.stroke();
  } else if (id === 'luck') {
    c.strokeStyle = '#547448';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(-2, 1);
    c.quadraticCurveTo(7, 22, -9, 37);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate(i * Math.PI / 2 + 0.3);
      c.beginPath();
      c.moveTo(0, 3);
      c.bezierCurveTo(-42, -8, -24, -41, -3, -24);
      c.bezierCurveTo(12, -42, 34, -13, 0, 3);
      c.fillStyle = i % 2 === 0 ? '#91ae62' : '#749553';
      c.strokeStyle = '#4d7448';
      c.lineWidth = 2;
      c.fill();
      c.stroke();
      c.restore();
    }
    ellipse(c, 0, 0, 4, 4, '#d5d989');
  } else if (id === 'rockbook') {
    rounded(c, -29, -34, 56, 70, 4, '#ebd9a9', '#704e36', 2);
    rounded(c, -30, -37, 55, 67, 4, '#93794e', '#704e36', 3);
    rounded(c, -30, -37, 8, 67, 2, '#795f3f');
    c.save();
    c.translate(1, -2);
    rock(c, 17);
    c.restore();
    c.strokeStyle = '#d6c395';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-13, 21);
    c.lineTo(15, 21);
    c.stroke();
  } else {
    rounded(c, -15, -39, 30, 11, 3, '#798f85', '#4c6c67', 2);
    rounded(c, -22, -26, 44, 63, 8, '#92c4b2', '#527f75', 3);
    rounded(c, -24, -4, 48, 32, 3, '#f3e9c4', '#8ba596', 1);
    c.save();
    c.translate(0, 11);
    diamond(c, 14);
    c.restore();
    c.strokeStyle = '#d4edcd';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-13, -18);
    c.lineTo(-13, -9);
    c.stroke();
    star(c, 33, -18, 8, '#d2a345');
  }
  c.restore();
}

export function drawAbilityIcon(c: Context, id: AbilityId, size: number): void {
  c.save();
  c.translate(size / 2, size / 2);
  c.scale(size / 100, size / 100);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (id === 'might') {
    path(c, [[-27, 30], [-34, 8], [-22, -7], [-19, -28], [-7, -29], [-3, -13],
      [0, -34], [12, -33], [15, -14], [21, -27], [32, -22], [33, 0], [22, 19], [19, 34]],
    '#e2a45e', '#805027', 3);
    path(c, [[-28, 8], [-13, 0], [-4, 10], [10, 5]], 'transparent', '#a96b34', 3);
    rounded(c, -24, 25, 48, 13, 3, '#76928a', '#4f6659', 2);
    star(c, -34, -28, 7, '#e3b548');
  } else if (id === 'gold-collector') {
    c.save(); c.translate(-21, 12); gold(c, 20); c.restore();
    c.save(); c.translate(18, 13); gold(c, 22); c.restore();
    c.save(); c.translate(0, -17); gold(c, 23); c.restore();
  } else if (id === 'diamond-collector') {
    diamond(c, 31);
    star(c, -33, -23, 8, '#e8c55c');
    star(c, 32, 22, 6, '#e8c55c');
  } else if (id === 'alchemy' || id === 'diamond-vein') {
    c.save(); c.translate(-22, 14);
    if (id === 'alchemy') rock(c, 21); else gold(c, 21);
    c.restore();
    c.save(); c.translate(24, -18);
    if (id === 'alchemy') gold(c, 23); else diamond(c, 24);
    c.restore();
    path(c, [[-7, -13], [8, -25], [8, -15], [18, -14], [2, -2], [1, -11]], '#e8bc50', '#9c7436', 1.5);
  } else if (id === 'aim-line') {
    ellipse(c, 12, -11, 23, 23, '#efdba4', '#8a6d37', 2);
    ellipse(c, 12, -11, 12, 12, '#f9ebc5', '#b18239', 2);
    c.strokeStyle = '#bd7931';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(12, -43); c.lineTo(12, 21); c.moveTo(-20, -11); c.lineTo(44, -11); c.stroke();
    c.setLineDash([4, 5]);
    c.strokeStyle = '#668d80';
    c.beginPath(); c.moveTo(-37, 36); c.lineTo(12, -11); c.stroke();
    c.setLineDash([]);
  } else if (id === 'wide-claw') {
    c.strokeStyle = '#4b6258';
    c.lineWidth = 8;
    for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(0, -22); c.bezierCurveTo(side * 41, -16, side * 46, 24, side * 17, 31); c.stroke();
      c.strokeStyle = '#adc1ae'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = '#4b6258'; c.lineWidth = 8;
    }
    ellipse(c, 0, -27, 8, 9, '#c4c5a7', '#586756', 2);
    path(c, [[-30, 4], [-43, -5], [-43, 12]], '#cda045');
    path(c, [[30, 4], [43, -5], [43, 12]], '#cda045');
  } else if (id === 'bomb-expert') {
    tnt(c, 29, true);
  } else if (id === 'diamond-moles') {
    c.save(); c.translate(0, 11); c.scale(1.2, 1.2);
    mole(c, makeEntity('mole-diamond', 0, 0, 0), 0);
    c.restore();
    star(c, -34, -24, 6, '#e2b349');
  } else if (id === 'airy-moles') {
    c.save(); c.translate(0, 15); c.scale(1.1, 1.1);
    mole(c, makeEntity('mole-diamond', 0, 0, 0), 0);
    c.restore();
    path(c, [[-6, -13], [-6, -29], [-17, -29], [0, -44], [17, -29], [6, -29], [6, -13]],
      '#9bbac1', '#5a8188', 2);
  } else if (id === 'slow-fuse') {
    c.save(); c.translate(-7, 14); tnt(c, 25); c.restore();
    c.strokeStyle = '#705134'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-7, -7); c.bezierCurveTo(25, -2, 11, -39, 34, -35); c.stroke();
    star(c, 35, -35, 8, '#e9b342');
    ellipse(c, -27, -28, 13, 13, '#f9ebc5', '#9c7436', 2);
    c.fillStyle = '#9f3f2e'; c.font = 'bold 19px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(SLOW_FUSE_SECONDS), -27, -27);
  } else if (id === 'moneybags') {
    c.save(); c.translate(-3, -3); bag(c, 29); c.restore();
    for (let index = 0; index < 3; index++) {
      ellipse(c, 22, 33 - index * 5, 14, 5, '#f7d15c', '#a8792d', 1.5);
    }
  } else if (id === 'risk-reward') {
    c.save(); c.translate(-20, 15); tnt(c, 19); c.restore();
    c.save(); c.translate(16, -9); gold(c, 27); c.restore();
    star(c, 34, 24, 11, '#e8912e');
    star(c, -29, -30, 7, '#e4b743');
  } else if (id === 'time-bank' || id === 'time-rush') {
    rounded(c, -13, -43, 16, 10, 3, '#d6ad5a', '#8a6534', 2);
    ellipse(c, -5, -4, 30, 30, '#e4bc60', '#8a6534', 3);
    ellipse(c, -5, -4, 24, 24, '#f9ebc5', '#b18239', 1.5);
    c.strokeStyle = '#8a6d37';
    c.lineWidth = 2;
    c.beginPath();
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2;
      c.moveTo(-5 + Math.sin(angle) * 18, -4 + Math.cos(angle) * 18);
      c.lineTo(-5 + Math.sin(angle) * 21, -4 + Math.cos(angle) * 21);
    }
    c.stroke();
    c.strokeStyle = '#536b64';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(-5, -20); c.lineTo(-5, -4); c.lineTo(8, 3); c.stroke();
    ellipse(c, -5, -4, 3, 3, '#536b64');
    if (id === 'time-bank') {
      for (let index = 0; index < 3; index++) {
        ellipse(c, 22, 34 - index * 6, 16, 5, '#f7d15c', '#a8792d', 1.5);
      }
      c.beginPath(); c.moveTo(-35, 24); c.quadraticCurveTo(-24, 40, -4, 35); c.stroke();
      path(c, [[-10, 29], [-3, 35], [-11, 41]], '#536b64');
    } else {
      c.save(); c.translate(23, 25); gold(c, 18); c.restore();
      path(c, [[-40, 4], [-17, -12], [-21, 3], [-5, -2], [-31, 33], [-25, 12]],
        '#e9a343', '#9a6633', 2);
    }
  } else if (id === 'regular-customer') {
    rounded(c, -40, -29, 80, 65, 5, '#ecd399', '#8a6534', 2);
    for (let index = 0; index < 5; index++) {
      rounded(c, -40 + index * 16, -34, 16, 19, 4, index % 2 === 0 ? '#ba6841' : '#f6deb0', '#9b703a', 1);
    }
    c.save(); c.translate(-41, -6); drawItemIcon(c, 'strength', 32); c.restore();
    c.save(); c.translate(-16, -6); drawItemIcon(c, 'luck', 32); c.restore();
    c.save(); c.translate(9, -6); drawItemIcon(c, 'polish', 32); c.restore();
    star(c, 0, -37, 8, '#e9bb4b');
  } else if (id === 'archaeologist') {
    c.save(); c.translate(-11, -6); skull(c, 25); c.restore();
    c.save(); c.translate(24, 14); c.rotate(-0.55);
    rounded(c, -5, -33, 10, 40, 3, '#9d724c', '#624b35', 2);
    rounded(c, -10, 4, 20, 8, 2, '#d5b56b', '#9b783e', 1.5);
    path(c, [[-10, 12], [-12, 29], [12, 29], [10, 12]], '#d8c294', '#9b8357', 1.5);
    c.strokeStyle = '#ad9667'; c.lineWidth = 1;
    for (const x of [-6, 0, 6]) {
      c.beginPath(); c.moveTo(x, 15); c.lineTo(x, 27); c.stroke();
    }
    c.restore();
    star(c, -32, 29, 7, '#d8ad49');
  } else if (id === 'clone') {
    c.save(); c.translate(-16, -13); diamond(c, 24); c.restore();
    c.save(); c.translate(17, 12); diamond(c, 24); c.restore();
    rounded(c, -41, 22, 31, 18, 5, '#607c95', '#3d576d', 1.5);
    c.fillStyle = '#fff0c7'; c.font = 'bold 15px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`×${CLONE_REWARD_MULTIPLIER}`, -25.5, 31);
  } else if (id === 'fossil-puzzle') {
    rounded(c, -40, -36, 49, 49, 6, '#e8d8ab', '#9b8357', 2);
    c.save(); c.translate(-15, -12); c.rotate(-0.5); bone(c, 20); c.restore();
    rounded(c, -9, -9, 49, 49, 6, '#d6b877', '#8a6534', 2);
    c.save(); c.translate(15, 15); skull(c, 19); c.restore();
    star(c, 31, -28, 9, '#e5af38');
  } else if (id === 'gold-growth') {
    c.save(); c.translate(-30, 23); gold(c, 12); c.restore();
    c.save(); c.translate(-4, 5); gold(c, 18); c.restore();
    c.save(); c.translate(24, -21); gold(c, 23); c.restore();
    path(c, [[-38, -8], [-38, -27], [-45, -27], [-32, -41], [-19, -27], [-26, -27], [-26, -8]],
      '#90ac69', '#547348', 2);
    rounded(c, 12, 24, 32, 17, 5, '#8b733f', '#69562e', 1.5);
    c.fillStyle = '#fff0c7'; c.font = 'bold 12px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${GOLD_GROWTH_INTERVAL}s`, 28, 32.5);
  } else if (id === 'buzzer-delivery') {
    rounded(c, -24, -42, 18, 9, 3, '#d6ad5a', '#8a6534', 2);
    ellipse(c, -15, -10, 26, 26, '#e4bc60', '#8a6534', 3);
    ellipse(c, -15, -10, 20, 20, '#f9ebc5', '#b18239', 1.5);
    c.strokeStyle = '#a94529'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-15, -26); c.lineTo(-15, -10); c.lineTo(-25, -17); c.stroke();
    c.save(); c.translate(19, 21); gold(c, 22); c.restore();
    c.strokeStyle = '#5a7a51'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(13, -20); c.lineTo(22, -11); c.lineTo(38, -30); c.stroke();
  } else if (id === 'thief') {
    for (let index = 0; index < 3; index++) {
      ellipse(c, 22, 30 - index * 7, 18, 6, '#f0c34a', '#987029', 2);
    }
    path(c, [[-39, -15], [-17, -26], [9, -15], [19, -3], [13, 6], [2, 0], [-4, 14],
      [-15, 12], [-24, -1], [-32, 9]], '#835648', '#563c33', 2.5);
    path(c, [[-25, -2], [-14, -8], [0, 1]], 'transparent', '#b08461', 2);
    rounded(c, -43, -17, 14, 30, 3, '#536b64', '#374e45', 2);
  } else {
    const unhandled: never = id;
    throw new Error(`Unknown ability artwork: ${unhandled}`);
  }
  c.restore();
}

export class GameRenderer {
  private c: Context;
  private terrainCanvas: HTMLCanvasElement;
  private terrainLevel = -1;
  private viewport: Viewport = DEFAULT_VIEWPORT;

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser does not support Canvas 2D.');
    this.c = context;
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = WIDTH * 2;
    this.terrainCanvas.height = HEIGHT * 2;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.canvas.clientWidth * dpr);
    const height = Math.round(this.canvas.clientHeight * dpr);
    if (width > 0 && height > 0 && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (width > 0 && height > 0) {
      const viewport = createViewport(width, height);
      if (viewport.stretchX !== this.viewport.stretchX || viewport.stretchY !== this.viewport.stretchY) {
        this.terrainLevel = -1;
      }
      this.viewport = viewport;
    }
  }

  draw(state: GameState, realTime: number, language: Language = DEFAULT_LANGUAGE): void {
    const c = this.c;
    if (this.terrainLevel !== state.level) {
      const background = this.terrainCanvas.getContext('2d');
      if (!background) throw new Error('Unable to create the mine background.');
      background.setTransform(2, 0, 0, 2, 0, 0);
      terrain(background, state.level, this.viewport);
      this.terrainLevel = state.level;
    }
    c.setTransform(this.canvas.width / WIDTH, 0, 0, this.canvas.height / HEIGHT, 0, 0);
    c.clearRect(0, 0, WIDTH, HEIGHT);
    c.drawImage(this.terrainCanvas, 0, 0, WIDTH, HEIGHT);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const time = state.phase === 'menu' ? realTime : state.elapsed;
    const cargoOffsets = new Map<number, { x: number; y: number }>();
    const players = state.players.map((player) => {
      if (state.phase === 'menu') return { ...player, angle: Math.sin(time * 1.1 + player.id) * 0.9 };
      if (player.phase !== 'retracting' || !player.reel) return player;
      const cargo = state.entities.find((entity) => entity.active && entity.id === player.cargoId);
      const length = REST_LENGTH + interpolatedReelDistance(
        player.reel, cargo?.weight ?? null, state.activeUpgrades.includes('strength'), state.bagStrength,
      ) * reelDistanceScale(player, this.viewport);
      if (cargo) {
        cargoOffsets.set(cargo.id, {
          x: Math.sin(player.angle) * (length - player.length),
          y: Math.cos(player.angle) * (length - player.length),
        });
      }
      return { ...player, length };
    });
    for (const player of players) {
      if (state.abilities.includes('aim-line') && (state.phase === 'playing' || state.phase === 'paused')) {
        aimLine(c, player, state, this.viewport);
      }
      rope(c, player, this.viewport);
    }
    for (const source of state.entities) {
      if (!source.active) continue;
      const offset = cargoOffsets.get(source.id);
      const entity = offset ? { ...source, x: source.x + offset.x, y: source.y + offset.y } : source;
      c.save();
      c.translate(entity.x, entity.y);
      c.scale(1 / this.viewport.stretchX, 1 / this.viewport.stretchY);
      c.rotate(entity.rotation);
      if (entity.riskBonus || canEarnRiskReward(entity, state, this.viewport)) {
        c.save();
        c.shadowColor = '#f4ad43';
        c.shadowBlur = 9;
        ellipse(c, 0, 0, entity.radius + 5, entity.radius + 5, '#f4ab2920', '#c2823aaa', 1.4);
        c.restore();
      }
      if (entity.kind.startsWith('gold')) gold(c, entity.radius);
      else if (entity.kind.startsWith('rock')) rock(c, entity.radius, entity.kind === 'rock-large');
      else if (entity.kind === 'diamond') diamond(c, entity.radius, time + entity.id);
      else if (entity.kind === 'bag') bag(c, entity.radius);
      else if (entity.kind === 'bone-small') bone(c, entity.radius);
      else if (entity.kind === 'bone-large') skull(c, entity.radius);
      else if (entity.kind === 'tnt-fragment') tntFragment(c, entity.radius);
      else if (entity.kind === 'tnt') {
        tnt(c, entity.radius, state.abilities.includes('bomb-expert'));
        if (state.abilities.includes('bomb-expert')) {
          ellipse(c, entity.radius * 0.65, entity.radius * 0.55, 9, 9, '#9dbf65', '#526a35', 1.5);
          c.strokeStyle = '#fff5c9'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(entity.radius * 0.65 - 4, entity.radius * 0.55); c.lineTo(entity.radius * 0.65 - 1, entity.radius * 0.55 + 3); c.lineTo(entity.radius * 0.65 + 5, entity.radius * 0.55 - 4); c.stroke();
        } else if (entity.fuseRemaining !== null) {
          c.save();
          c.rotate(-entity.rotation);
          c.strokeStyle = '#e7a13a'; c.lineWidth = 2.5;
          c.beginPath();
          c.arc(0, 0, entity.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * entity.fuseRemaining / SLOW_FUSE_SECONDS);
          c.stroke();
          rounded(c, -18, -entity.radius - 26, 36, 18, 5, '#a94529', '#743b29', 1.5);
          c.fillStyle = '#fff0c7'; c.font = 'bold 12px Georgia, serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(entity.fuseRemaining.toFixed(1), 0, -entity.radius - 17);
          c.restore();
        }
      }
      else mole(c, entity, time);
      if (entity.id === state.clonedEntityId) {
        c.save();
        c.rotate(-entity.rotation);
        rounded(c, -15, -entity.radius - 23, 30, 17, 5, '#607c95', '#3d576d', 1.5);
        c.fillStyle = '#fff0c7'; c.font = 'bold 12px Georgia, serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(`×${CLONE_REWARD_MULTIPLIER}`, 0, -entity.radius - 14.5);
        c.restore();
      }
      if (entity.kind.startsWith('gold') && Math.sin(time * 2 + entity.id * 3) > 0.97) {
        star(c, entity.radius * 0.6, -entity.radius * 0.7, 6, '#fff3b5');
      }
      c.restore();
    }
    for (const player of players) {
      const cargo = state.entities.find((entity) => entity.active && entity.id === player.cargoId);
      claw(c, player, cargo?.radius ?? 0, this.viewport, state.abilities.includes('wide-claw'));
      miner(c, player, time, state.mode === 'coop', this.viewport);
    }
    for (const particle of state.particles) {
      c.globalAlpha = Math.min(1, particle.life / particle.maxLife);
      if (particle.kind === 'blast') {
        c.save();
        c.translate(particle.x, particle.y);
        c.scale(1 / this.viewport.stretchX, 1 / this.viewport.stretchY);
        const progress = 1 - particle.life / particle.maxLife;
        const radius = particle.size * (0.2 + progress * 0.8);
        ellipse(c, 0, 0, radius, radius, '#ee9b382b', particle.color, 4);
        c.restore();
        continue;
      }
      c.fillStyle = particle.color;
      c.fillRect(particle.x, particle.y, particle.size / this.viewport.stretchX, particle.size / this.viewport.stretchY);
    }
    c.globalAlpha = 1;
    for (const text of state.texts) {
      const label = localize(text.text, language);
      c.save();
      c.translate(text.x, text.y);
      c.scale(1 / this.viewport.stretchX, 1 / this.viewport.stretchY);
      c.globalAlpha = Math.min(1, text.life * 2);
      c.font = 'bold 25px "PingFang SC", "Microsoft YaHei", sans-serif';
      c.textAlign = 'center';
      c.lineJoin = 'round';
      c.strokeStyle = '#fff3d2';
      c.lineWidth = 4;
      c.strokeText(label, 0, 0);
      c.fillStyle = text.color;
      c.fillText(label, 0, 0);
      c.restore();
    }
  }
}
