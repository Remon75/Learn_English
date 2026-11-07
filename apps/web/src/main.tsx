import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { loadMediaManifest } from './lib/audio';
import './styles/global.css';

// Warm the media manifest before the first lesson starts, so the opening
// word is spoken with the device voice instead of playing a placeholder tone.
void loadMediaManifest();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
