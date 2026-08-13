import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/globals.css';
import { AuthSessionBootstrap } from './lib/auth';
import { AnalyticsProvider } from './components/analytics/AnalyticsProvider';
import { SeoHead } from './components/seo/SeoHead';
import './styles/seo-prerender.css';
import { installPreloadErrorHandler } from './lib/versionSkew';

installPreloadErrorHandler();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <AuthSessionBootstrap />
        <SeoHead />
        <AnalyticsProvider>
          <App />
        </AnalyticsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
