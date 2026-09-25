import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar, Icon, ItemArt, Merchant } from './components/Art';
import type { IconName } from './components/Art';
import { MineCanvas } from './components/MineCanvas';
import { AbilityDraft } from './components/AbilityDraft';
import { AbilityRack } from './components/AbilityRack';
import { LanguageContext, LanguageSwitch, useLanguage } from './components/Language';
import { GameAudio } from './game/audio';
import { GameEngine, keyboardAction } from './game/engine';
import { getAbility } from './game/abilities';
import { getTranslator, localize } from './game/i18n';
import type { LocalizedText } from './game/i18n';
import { getLevelInfo } from './game/levels';
import { loadPreferences, savePreferences } from './game/storage';
import type { GameState, Mode, PlayerId } from './game/types';

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
const compactAmount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const hudMoney = (amount: number) => amount >= 100_000 ? `$${compactAmount.format(amount)}` : money(amount);
const padded = (amount: number) => amount.toString().padStart(2, '0');

function ActionButton({ icon, label, onClick, className = '' }: {
  icon: IconName;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return <button className={`game-button ${className}`} aria-label={label} title={label} onClick={onClick}><Icon name={icon} size={28} /></button>;
}

function Hud({ state }: { state: GameState }) {
  const { t } = useLanguage();
  const level = state.draftLevel ?? state.level + (state.phase === 'shop' ? 1 : 0);
  const { target } = getLevelInfo(level, state.mode);
  return (
    <header className="hud">
      <div className="hud-stat wallet-stat"><Icon name="coin" size={32} /><div><span className="stat-label">{t('我的金币', 'Gold')}</span><strong data-testid="score" title={money(state.score)} aria-label={money(state.score)}>{hudMoney(state.score)}</strong></div></div>
      <div className={`hud-stat target-stat ${state.score >= target ? 'target-reached' : ''}`}>
        <Icon name="target" size={31} />
        <div><span className="stat-label">{t('本关目标', 'Target')}</span><strong title={money(target)} aria-label={money(target)}>{hudMoney(target)}</strong><div className="goal-track" role="progressbar" aria-label={t('目标完成度', 'Goal progress')} aria-valuenow={Math.min(state.score, target)} aria-valuemin={0} aria-valuemax={target}><span style={{ width: `${Math.min(state.score / target, 1) * 100}%` }} /></div></div>
      </div>
      <div className={`hud-stat timer-stat ${state.timeLeft <= 10 && state.phase === 'playing' ? 'time-low' : ''}`}><Icon name="clock" size={31} /><div><span className="stat-label">{t('剩余时间', 'Time left')}</span><strong data-testid="timer">{state.phase === 'shop' || state.phase === 'draft' ? '—' : padded(Math.ceil(state.timeLeft))}</strong></div></div>
      <div className="hud-stat level-stat" aria-label={t(`当前第${level}关`, `Stage ${level}`)}><Icon name="pickaxe" size={31} /><div><strong className={level >= 10_000 ? 'large-level-number' : undefined}>{padded(level)}</strong></div></div>
    </header>
  );
}

function StartMenu({ onStart }: { onStart: (mode: Mode) => void }) {
  const { t } = useLanguage();
  return (
    <div className="stage-overlay start-overlay">
      <div className="mode-buttons" role="group" aria-label={t('选择游戏模式', 'Choose game mode')}>
        <button className="mode-button" aria-label={t('开始单人游戏', 'Start solo game')} title={t('单人', 'Solo')} onClick={() => onStart('solo')}><Avatar /><Icon name="play" size={35} /></button>
        <button className="mode-button coop-button" aria-label={t('开始双人游戏', 'Start co-op game')} title={t('双人', 'Co-op')} onClick={() => onStart('coop')}><span className="avatar-pair"><Avatar /><Avatar player={2} /></span><Icon name="play" size={35} /></button>
      </div>
    </div>
  );
}

function Pause({ engine }: { engine: GameEngine }) {
  const { t } = useLanguage();
  return (
    <div className="stage-overlay dimmed-overlay">
      <div className="pause-controls" role="group" aria-label={t('游戏已暂停', 'Game paused')}>
        <ActionButton icon="refresh" label={t('重新开始', 'Restart')} onClick={() => engine.start(engine.state.mode)} />
        <ActionButton icon="play" label={t('继续挖矿', 'Resume mining')} className="large-button" onClick={() => engine.resume()} />
        <ActionButton icon="home" label={t('返回营地', 'Back to camp')} onClick={() => engine.menu()} />
      </div>
    </div>
  );
}

function Results({ engine, onStart }: { engine: GameEngine; onStart: (mode: Mode) => void }) {
  const { language, t } = useLanguage();
  const state = engine.state;
  const passed = state.result?.passed ?? false;
  return (
    <div className="stage-overlay dimmed-overlay">
      <section className={`result-panel ${passed ? 'result-success' : 'result-failure'}`} aria-label={passed ? t('过关', 'Stage cleared') : t('挑战结束', 'Run over')}>
        <Icon name={passed ? 'trophy' : 'close'} size={78} />
        <strong className="result-earnings">+{money(state.result?.earned ?? 0)}</strong>
        {state.result && (state.result.timeBankBonus > 0 || state.result.fossilBonus > 0) && (
          <div className="result-bonuses">
            {state.result.timeBankBonus > 0 && <span className="result-bonus" data-testid="time-bank-bonus">{getAbility('time-bank', state.mode, language).name} +{money(state.result.timeBankBonus)}</span>}
            {state.result.fossilBonus > 0 && <span className="result-bonus" data-testid="fossil-bonus">{getAbility('fossil-puzzle', state.mode, language).name} +{money(state.result.fossilBonus)}</span>}
          </div>
        )}
        {state.mode === 'coop' && <div className="player-earnings">{state.players.map((player) => <span key={player.id} aria-label={t(`玩家${player.id}本关所得`, `Player ${player.id} earnings this stage`)}><Avatar player={player.id} />{money(player.roundEarned)}</span>)}</div>}
        <div className="result-actions">
          <ActionButton icon="home" label={t('返回营地', 'Back to camp')} className="large-button" onClick={() => engine.menu()} />
          <ActionButton icon={passed ? 'cart' : 'refresh'} label={passed ? t('去补给商店', 'Visit the shop') : t('重新挑战', 'Try again')} className="large-button" onClick={passed ? () => engine.openShop() : () => onStart(state.mode)} />
        </div>
      </section>
    </div>
  );
}

function Shop({ engine }: { engine: GameEngine }) {
  const { language, t } = useLanguage();
  return (
    <section className="shop-scene" aria-label={t('补给商店', 'Supply shop')}>
      <div className="shop-awning" aria-hidden="true">{Array.from({ length: 13 }, (_, index) => <span key={index} />)}</div>
      <Merchant />
      {engine.state.abilities.includes('thief') && <div className="shop-theft-count" aria-label={t('本店剩余偷取次数', 'Thefts remaining this visit')}><Icon name="hand" size={21} /><strong data-testid="steals">{engine.state.shopStealsRemaining}</strong></div>}
      <div className="shop-shelf">
        {engine.state.shop.length === 0 && <span className="empty-shop" role="status">{t('本次暂无补给', 'No supplies this visit')}</span>}
        {engine.state.shop.map((item) => {
          const soldOut = item.bought >= item.stock;
          const affordable = item.price !== null && engine.state.score >= item.price;
          const name = item.name[language];
          const description = item.description[language];
          return (
            <article
              className={`shop-item ${soldOut ? 'item-purchased' : ''} ${!affordable ? 'item-unaffordable' : ''}`}
              key={item.id}
              title={`${name} · ${description}`}
            >
              <ItemArt item={item.id} />
              <span className="item-description">{description}</span>
              <button
                className={`item-price ${item.price === null ? 'unpayable-price' : ''}`}
                disabled={soldOut || !affordable}
                aria-label={soldOut ? t(`${name}已购买`, `${name} purchased`) : t(`购买${name} ${item.priceText}`, `Buy ${name} ${item.priceText}`)}
                title={item.price === null ? t(`${item.priceText}，超出钱包可支付范围`, `${item.priceText}, exceeds the wallet limit`) : item.priceText}
                onClick={() => engine.buy(item.id)}
              >{soldOut ? <Icon name="check" size={29} /> : item.priceText}</button>
              {engine.state.abilities.includes('thief') && <button
                className="steal-button"
                disabled={soldOut || engine.state.shopStealsRemaining === 0}
                aria-label={t(`免费偷取${name}`, `Steal ${name} for free`)}
                onClick={() => engine.steal(item.id)}
              ><Icon name="hand" size={15} />{t('偷取', 'Steal')}</button>}
            </article>
          );
        })}
      </div>
      <ActionButton icon="arrow" label={t('下一关', 'Next stage')} className="next-level large-button" onClick={() => engine.nextLevel()} />
    </section>
  );
}

function TouchControls({ state, onAction }: { state: GameState; onAction: (player: PlayerId, action: 'launch' | 'bomb') => void }) {
  const { t } = useLanguage();
  return (
    <div className="touch-controls">
      {state.players.map((player) => (
        <div className={`player-controls player-${player.id}`} key={player.id} data-player={player.id} data-hook-phase={player.phase} data-angle={Math.round(player.angle * 180 / Math.PI)} data-cargo={player.cargoId ?? ''}>
          <button className="game-button touch-button" onClick={() => onAction(player.id, 'launch')} disabled={state.phase !== 'playing'} aria-label={t(`玩家${player.id}下钩`, `Player ${player.id}: launch claw`)} aria-keyshortcuts={state.mode === 'coop' && player.id === 1 ? 'S' : 'ArrowDown'}><Icon name="arrow" size={26} /></button>
          <button className="game-button touch-button" onClick={() => onAction(player.id, 'bomb')} disabled={state.phase !== 'playing'} aria-label={t(`玩家${player.id}使用炸药`, `Player ${player.id}: use dynamite`)} aria-keyshortcuts={state.mode === 'coop' && player.id === 1 ? 'W' : 'ArrowUp'}><Icon name="bomb" size={24} /></button>
        </div>
      ))}
    </div>
  );
}

export default function App({ engine }: { engine: GameEngine }) {
  useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const state = engine.state;
  const [saved] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(saved.preferences);
  const [storageWarning, setStorageWarning] = useState(saved.warning);
  const [audioWarning, setAudioWarning] = useState<LocalizedText | null>(null);
  const [audio] = useState(() => new GameAudio(saved.preferences.sound, setAudioWarning));
  const [pageHidden, setPageHidden] = useState(document.hidden);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const language = preferences.language;
  const t = getTranslator(language);

  useEffect(() => {
    const text = getTranslator(language);
    document.documentElement.lang = language;
    document.title = text('黄金矿工', 'Gold Miner');
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      text('黄金矿工，支持单人和双人本地同屏合作。', 'Gold Miner: solo or local two-player co-op mining.'));
  }, [language]);
  useEffect(() => engine.onSound((sound) => audio.play(sound)), [engine, audio]);
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    audio.setScene(pageHidden || state.phase === 'paused' ? 'silent' : state.phase === 'playing' ? 'game' : state.phase === 'shop' ? 'shop' : 'menu');
  }, [audio, state.phase, pageHidden]);
  useEffect(() => {
    const warning = savePreferences(preferences);
    if (warning) setStorageWarning(warning);
  }, [preferences]);
  useEffect(() => {
    if (!['results', 'gameover'].includes(state.phase)) return;
    const { mode, score } = state;
    setPreferences((previous) => previous.records[mode] >= score ? previous : {
      ...previous, records: { ...previous.records, [mode]: score },
    });
  }, [state, state.phase, state.mode, state.score]);

  const start = useCallback((mode: Mode) => {
    void audio.unlock();
    engine.start(mode);
    canvasRef.current?.focus({ preventScroll: true });
  }, [audio, engine]);

  const onAction = useCallback((player: PlayerId, action: 'launch' | 'bomb') => {
    void audio.unlock();
    engine.action(player, action);
  }, [engine, audio]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (engine.state.phase === 'menu' && event.code === 'ArrowDown' && !event.repeat) {
        event.preventDefault();
        start('solo');
        return;
      }
      const action = keyboardAction(event.code, engine.state.mode);
      if (action && (engine.state.phase === 'playing' || engine.state.phase === 'paused')) {
        event.preventDefault();
        if (!event.repeat) onAction(action.player, action.action);
      } else if (event.code === 'Escape' || (event.code === 'Space' && !(target instanceof HTMLButtonElement))) {
        if (engine.state.phase === 'playing' || engine.state.phase === 'paused') {
          event.preventDefault();
          if (event.repeat) return;
          if (engine.state.phase === 'playing') engine.pause();
          else engine.resume();
        }
      }
    };
    const onVisibility = () => {
      setPageHidden(document.hidden);
      if (document.hidden) engine.pause();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [engine, onAction, start]);

  const toggleSound = () => {
    const enabled = !preferences.sound;
    audio.setEnabled(enabled);
    setPreferences((previous) => ({ ...previous, sound: enabled }));
  };
  const warningText = audioWarning || storageWarning || (state.notice?.tone === 'warning' ? state.notice.text : null);
  const warning = warningText ? localize(warningText, language) : null;

  return (
    <LanguageContext.Provider value={{ language, onChange: (next) => setPreferences((previous) => ({ ...previous, language: next })) }}>
      <main className={`game-frame phase-${state.phase}`}>
        <Hud state={state} />
        <div className="game-stage">
          {state.phase === 'shop' ? <Shop engine={engine} /> : <MineCanvas engine={engine} canvasRef={canvasRef} />}
          <div className="game-toolbar">
            <LanguageSwitch />
            <button className="game-button small-button" onClick={toggleSound} aria-label={preferences.sound ? t('关闭声音', 'Mute sound') : t('开启声音', 'Enable sound')} aria-pressed={preferences.sound} title={preferences.sound ? t('关闭声音', 'Mute sound') : t('开启声音', 'Enable sound')}><Icon name={preferences.sound ? 'sound' : 'muted'} size={23} /></button>
            {(state.phase === 'playing' || state.phase === 'paused') && <ActionButton icon={state.phase === 'playing' ? 'pause' : 'play'} label={state.phase === 'playing' ? t('暂停游戏', 'Pause game') : t('继续游戏', 'Resume game')} className="small-button" onClick={() => state.phase === 'playing' ? engine.pause() : engine.resume()} />}
            {state.phase === 'playing' && state.score >= state.target && <ActionButton icon="check" label={t('提前收工', 'Finish early')} className="small-button finish-button" onClick={() => engine.finishEarly()} />}
          </div>
          <div className="inventory" aria-label={t('共享背包', 'Shared inventory')}>
            <span className="dynamite-counter" title={t('炸药', 'Dynamite')}><Icon name="bomb" size={24} /><b data-testid="dynamite">{state.dynamite}</b></span>
            {(state.phase === 'shop' ? state.pendingUpgrades : state.activeUpgrades).map((upgrade) => <span className="active-upgrade" data-upgrade={upgrade} key={upgrade}><ItemArt item={upgrade} /></span>)}
            {state.bagStrength && <span className="active-upgrade" data-testid="bag-strength" title={t('本关生力：极速回收', 'Stage strength: fast hauling')}><ItemArt item="strength" /><small>{t('快', 'Fast')}</small></span>}
          </div>
          {state.abilities.length > 0 && <AbilityRack abilities={state.abilities} mode={state.mode} />}
          {state.phase === 'menu' && <StartMenu onStart={start} />}
          {state.phase === 'draft' && <AbilityDraft engine={engine} />}
          {state.phase === 'paused' && <Pause engine={engine} />}
          {['results', 'gameover'].includes(state.phase) && <Results engine={engine} onStart={start} />}
          <TouchControls state={state} onAction={onAction} />
          {warning && <span className="warning-icon" role="status" aria-label={warning} title={warning}>!</span>}
          {state.notice && <span className="sr-only" role="status">{localize(state.notice.text, language)}</span>}
        </div>
      </main>
    </LanguageContext.Provider>
  );
}
