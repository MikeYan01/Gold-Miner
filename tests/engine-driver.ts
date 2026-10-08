import type { GameEngine } from '../src/game/engine';
import type { AbilityId, Mode } from '../src/game/types';

export function startTestRun(engine: GameEngine, mode: Mode, ability: AbilityId = 'aim-line'): void {
  engine.start(mode);
  engine.state.abilityOffers = [ability];
  if (!engine.chooseAbility(ability)) throw new Error(`Unable to start the fixture with ${ability}.`);
}

export function advance(engine: GameEngine, seconds: number, step = 1 / 60): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    engine.tick(Math.min(step, seconds - elapsed));
  }
}
