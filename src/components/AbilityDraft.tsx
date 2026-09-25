import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { GameEngine } from '../game/engine';
import { getAbility } from '../game/abilities';
import { AbilityArt } from './Art';

export function AbilityDraft({ engine }: { engine: GameEngine }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const offers = engine.state.abilityOffers;
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cards.current[0]?.focus({ preventScroll: true });
    return () => dialog?.close();
  }, []);

  const navigate = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const digit = /^(?:Digit|Numpad)([123])$/.exec(event.code);
    if (digit && !event.repeat) {
      event.preventDefault();
      const ability = offers[Number(digit[1]) - 1];
      if (ability) engine.chooseAbility(ability);
      return;
    }
    const backwards = ['ArrowLeft', 'ArrowUp', 'KeyW'].includes(event.code);
    const forwards = ['ArrowRight', 'ArrowDown', 'KeyS'].includes(event.code);
    if (!backwards && !forwards) return;
    event.preventDefault();
    const index = cards.current.findIndex((card) => card === document.activeElement);
    const next = index < 0
      ? backwards ? offers.length - 1 : 0
      : (index + (backwards ? -1 : 1) + offers.length) % offers.length;
    cards.current[next]?.focus({ preventScroll: true });
  };

  return (
    <dialog
      ref={dialogRef}
      className="ability-dialog"
      aria-labelledby="ability-draft-title"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={navigate}
    >
      <div className="ability-draft-heading">
        <h2 id="ability-draft-title">选择能力</h2>
      </div>
      <div className="ability-cards">
        {offers.map((id, index) => {
          const ability = getAbility(id, engine.state.mode);
          return (
            <button
              key={id}
              ref={(element) => { cards.current[index] = element; }}
              className="ability-card"
              data-ability={id}
              aria-label={`选择能力：${ability.name}`}
              aria-describedby={`ability-description-${id}`}
              onClick={() => engine.chooseAbility(id)}
            >
              <span className="ability-card-number" aria-hidden="true">{index + 1}</span>
              <span className="ability-card-emblem"><AbilityArt ability={id} /></span>
              <strong>{ability.name}</strong>
              <span className="ability-card-description" id={`ability-description-${id}`}>{ability.description}</span>
            </button>
          );
        })}
      </div>
    </dialog>
  );
}
