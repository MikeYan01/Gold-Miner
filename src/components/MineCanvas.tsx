import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { GameEngine } from '../game/engine';
import { GameRenderer } from '../game/render';
import { useLanguage } from './Language';

export function MineCanvas({ engine, canvasRef }: { engine: GameEngine; canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const { language, t } = useLanguage();
  const languageRef = useRef(language);
  useLayoutEffect(() => { languageRef.current = language; }, [language]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new GameRenderer(canvas);
    const resize = () => {
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
      renderer.resize();
      engine.setViewport(canvas.width, canvas.height);
      renderer.draw(engine.state, performance.now() / 1000, languageRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frame = 0;
    let previous = performance.now();
    let previousPhase = engine.state.phase;
    const unsubscribe = engine.subscribe(() => {
      const phase = engine.state.phase;
      if (phase === 'playing' && previousPhase !== 'playing') previous = performance.now();
      previousPhase = phase;
    });
    const animate = (now: number) => {
      let remaining = Math.min(Math.max(0, now - previous) / 1000, engine.state.timeLeft);
      // Substep long frames without making the countdown slower on a busy device.
      while (remaining > 0 && engine.state.phase === 'playing') {
        const step = Math.min(remaining, 1 / 30);
        engine.tick(step);
        remaining -= step;
      }
      previous = now;
      renderer.draw(engine.state, now / 1000, languageRef.current);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
    };
  }, [engine, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      className="mine-canvas"
      tabIndex={-1}
      role="img"
      aria-label={t('黄金矿工矿场：抓钩在地面摆动，下方埋藏黄金、石头和宝藏。', 'Gold Miner mine: the claw swings above gold, rocks, and buried treasure.')}
      aria-keyshortcuts={engine.state.mode === 'coop' ? 'S W ArrowDown ArrowUp' : 'ArrowDown ArrowUp'}
    >
      {t('你的浏览器不支持 Canvas。请使用新版 Chrome、Edge、Firefox 或 Safari。', 'Your browser does not support Canvas. Please use an updated Chrome, Edge, Firefox, or Safari.')}
    </canvas>
  );
}
