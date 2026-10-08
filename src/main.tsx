import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GameEngine } from './game/engine';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('The game root element is missing.');
createRoot(root).render(<StrictMode><App engine={new GameEngine()} /></StrictMode>);
