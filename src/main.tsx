import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/globals.css';
import { AuthSessionBootstrap } from './lib/auth';
import { AnalyticsProvider } from './components/analytics/AnalyticsProvider';
import { SeoHead } from './components/seo/SeoHead';
import './styles/seo-prerender.css';
import { installPreloadErrorHandler } from './lib/versionSkew';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import { NavigationGuard } from './components/NavigationGuard';

installPreloadErrorHandler();

const queryClient = new QueryClient();

const Root = () => (
  <>
    <EnvironmentBanner />
    <AuthSessionBootstrap />
    <SeoHead />
    <NavigationGuard />
    <AnalyticsProvider>
      <App />
    </AnalyticsProvider>
  </>
);

// A data router is required for useBlocker (NavigationGuard). App keeps its
// descendant <Routes>, mounted under a single splat route.
const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  </React.StrictMode>
);
