import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import App from './App';import'./styles.css';import'./diagnostics.css';import'./theme/themes.css';import{initializeTheme}from'./theme';
import{AuthProvider}from'./auth';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:1,staleTime:15_000}}});
initializeTheme();
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></AuthProvider></React.StrictMode>);
