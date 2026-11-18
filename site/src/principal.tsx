import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Pagina } from './Pagina';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
