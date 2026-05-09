import React from 'react';
import { AppShell } from './app/AppShell';
import { ErrorBoundary } from './app/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
};
