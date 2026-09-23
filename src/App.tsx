import React from 'react';
import { NavigationProvider } from './navigation/NavigationContext.js';
import { ExtractionProvider } from './extraction/ExtractionContext.js';
import { AppShell } from './components/shell/AppShell.js';
import { RouteView } from './navigation/RouteView.js';

export default function App(): React.ReactElement {
  return (
    <NavigationProvider>
      <ExtractionProvider>
        <AppShell>
          <RouteView />
        </AppShell>
      </ExtractionProvider>
    </NavigationProvider>
  );
}
