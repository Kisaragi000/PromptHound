import React from 'react';
import { useNavigation } from './NavigationContext.js';
import { HomePage } from '../pages/HomePage.js';
import { ExtractionResultPage } from '../pages/ExtractionResultPage.js';
import { PromptLibraryPage } from '../pages/PromptLibraryPage.js';
import { FavoritesPage } from '../pages/FavoritesPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { AboutPage } from '../pages/AboutPage.js';

export const RouteView: React.FC = () => {
  const { currentRoute } = useNavigation();

  switch (currentRoute) {
    case 'home':
      return <HomePage />;
    case 'result':
    case 'extraction':
      return <ExtractionResultPage />;
    case 'library':
      return <PromptLibraryPage />;
    case 'favorites':
      return <FavoritesPage />;
    case 'settings':
      return <SettingsPage />;
    case 'about':
      return <AboutPage />;
    default:
      return <HomePage />;
  }
};
