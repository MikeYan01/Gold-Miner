import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findHookHit, hookTip, maxHookLength } from '../src/game/engine';
import type { Entity, EntityKind, GameState, PlayerId } from '../src/game/types';
import { createViewport } from '../src/game/viewport';

declare global {
  interface Window {
    getMiningState?: () => GameState;
  }
}

export async function readGame(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    if (!window.getMiningState) throw new Error('The read-only test fixture snapshot is missing.');
    return window.getMiningState();
  });
}

export async function fireAt(page: Page, kinds: readonly EntityKind[], playerId: PlayerId = 1): Promise<Entity> {
  const canvas = await page.locator('.mine-canvas').boundingBox();
  if (!canvas) throw new Error('The mine is not visible.');
  const viewport = createViewport(canvas.width, canvas.height);
  for (let frame = 0; frame < 400; frame++) {
    const state = await readGame(page);
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) throw new Error('The requested fixture player does not exist.');
    if (state.phase !== 'playing') throw new Error(`Mining stopped in phase ${state.phase}.`);
    if (player.phase === 'swinging') {
      const length = maxHookLength(player);
      const to = { x: player.origin.x + Math.sin(player.angle) * length, y: player.origin.y + Math.cos(player.angle) * length };
      const hit = findHookHit(hookTip(player), to, state.entities, viewport, state.abilities);
      if (hit && kinds.includes(hit.entity.kind)) {
        await page.keyboard.press(state.mode === 'coop' && playerId === 1 ? 's' : 'ArrowDown');
        return hit.entity;
      }
    }
    await page.clock.runFor(32);
  }
  throw new Error(`No visible ${kinds.join('/')} target crossed player ${playerId}'s hook path.`);
}

export async function catchAt(page: Page, kinds: readonly EntityKind[], playerId: PlayerId = 1): Promise<Entity> {
  const target = await fireAt(page, kinds, playerId);
  for (let frame = 0; frame < 60; frame++) {
    const player = (await readGame(page)).players.find((entry) => entry.id === playerId);
    if (player?.cargoId === target.id) return target;
    if (!player || player.phase !== 'extending') {
      throw new Error(`Player ${playerId} did not catch the aimed target ${target.id}.`);
    }
    await page.clock.runFor(50);
  }
  throw new Error(`Player ${playerId} did not reach the aimed target ${target.id} within the maximum shot time.`);
}

export async function settleHooks(page: Page): Promise<void> {
  for (let frame = 0; frame < 80; frame++) {
    const state = await readGame(page);
    if (state.players.every((player) => player.phase === 'swinging')) return;
    if (state.phase !== 'playing') throw new Error(`Mining ended before the requested haul: ${state.phase}.`);
    await page.clock.runFor(200);
  }
  throw new Error('The hook did not return within the expected maximum reel time.');
}

export async function collectGoal(page: Page, minimum = 1000): Promise<number> {
  for (let shot = 0; shot < 20; shot++) {
    const state = await readGame(page);
    if (state.score >= Math.max(state.target, minimum)) {
      await expect(page.getByTestId('score')).toHaveAttribute('title', coins(state.score));
      return state.score;
    }
    await fireAt(page, ['gold-tiny', 'gold-small', 'gold-medium', 'gold-large']);
    await settleHooks(page);
  }
  throw new Error('The real generated opening mine did not provide the requested income.');
}

export const coins = (value: number) => `$${value.toLocaleString('en-US')}`;
