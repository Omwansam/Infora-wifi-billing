import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WebsiteProvider } from './contexts/WebsiteContext';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <WebsiteProvider>
        <App />
      </WebsiteProvider>
    </BrowserRouter>
  </StrictMode>
);
