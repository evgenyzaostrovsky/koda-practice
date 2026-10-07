import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import App from './App';import'./styles.css';import'./diagnostics.css';import'./theme/themes.css';import'./koda-icons.css';import'./design-prototype.css';import'./sandbox.css';import'./achievements/achievements.css';import'./achievements/achievement-performance.css';import{initializeTheme}from'./theme';
import{AuthProvider}from'./auth';
import './theme/compact.css';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:1,staleTime:15_000}}});
initializeTheme();
const application=<QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider>;
const isolatedPrototype=['/design-prototype','/design-system'].includes(window.location.pathname.replace(/\/$/,''));
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isolatedPrototype?application:<AuthProvider>{application}</AuthProvider>}</React.StrictMode>);
