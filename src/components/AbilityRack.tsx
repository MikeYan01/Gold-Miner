import { useEffect, useId, useRef, useState } from 'react';
import { getAbility } from '../game/abilities';
import type { AbilityId, Mode } from '../game/types';
import { AbilityArt } from './Art';

export function AbilityRack({ abilities, mode }: { abilities: readonly AbilityId[]; mode: Mode }) {
  const [hovered, setHovered] = useState<AbilityId | null>(null);
  const [focused, setFocused] = useState<AbilityId | null>(null);
  const [dismissed, setDismissed] = useState<AbilityId | null>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const activeId = hovered ?? focused;
  const active = activeId && activeId !== dismissed && abilities.includes(activeId) ? getAbility(activeId, mode) : null;
  const tooltipAbilityId = active?.id;

  useEffect(() => {
    if (!tooltipAbilityId) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDismissed(tooltipAbilityId);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rackRef.current?.contains(event.target)) {
        setHovered(null);
        setFocused(null);
      }
    };
    document.addEventListener('keydown', dismiss, true);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      document.removeEventListener('keydown', dismiss, true);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [tooltipAbilityId]);

  return (
    <div ref={rackRef} className="ability-rack" role="group" aria-label="本局共享能力" onPointerLeave={() => setHovered(null)}>
      {abilities.map((id) => {
        const ability = getAbility(id, mode);
        return (
          <button
            key={id}
            type="button"
            className="owned-ability"
            data-owned-ability={id}
            aria-label={`查看能力：${ability.name}`}
            aria-describedby={active?.id === id ? tooltipId : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === 'touch') return;
              setHovered(id);
              setDismissed(null);
            }}
            onFocus={() => { setFocused(id); setDismissed(null); }}
            onBlur={() => setFocused(null)}
            onClick={() => { setFocused(id); setDismissed(null); }}
          ><AbilityArt ability={id} /></button>
        );
      })}
      {active && (
        <div className="ability-tooltip-positioner">
          <div id={tooltipId} className="ability-tooltip" role="tooltip">
            <strong>{active.name}</strong>
            <span className="ability-tooltip-effect">{active.description}</span>
            <span className="ability-tooltip-detail">{active.detail}</span>
          </div>
        </div>
      )}
    </div>
  );
}
