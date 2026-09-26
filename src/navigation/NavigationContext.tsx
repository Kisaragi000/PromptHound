import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import type { ExtractedMetadata, ExtractionResult, SavedPromptItem } from '../../core/types.js';
import { INITIAL_SAMPLE_PROMPTS, isLegacyPlaceholderSample } from './samplePrompts.js';

export type RouteKey =
  | 'home'
  | 'result'
  | 'extraction'
  | 'library'
  | 'favorites'
  | 'settings'
  | 'about';

const STORAGE_KEY_PROMPTS = 'prompthound_library_items_v9';
const STORAGE_KEY_FOLDERS = 'prompthound_folders_v2';
const STORAGE_KEY_FAVORITES = 'prompthound_favorites_v2';

/**
 * Replaces the placeholder samples shipped before v1.0.8 (stock photos with made-up
 * metadata) with the real example images. The user's own items are never touched.
 */
function upgradeLegacySamples(items: SavedPromptItem[]): { items: SavedPromptItem[]; changed: boolean } {
  if (!items.some(isLegacyPlaceholderSample)) return { items, changed: false };
  const kept = items.filter((i) => !isLegacyPlaceholderSample(i) && !i.id.startsWith('sample-'));
  return { items: [...INITIAL_SAMPLE_PROMPTS, ...kept], changed: true };
}

const INITIAL_FOLDERS = ['All Prompts', 'Portraits', 'Landscapes', 'Architecture', 'Illustrations', 'Anime', 'My Creations'];

interface NavigationContextType {
  currentRoute: RouteKey;
  previousRoute: RouteKey | null;
  navigate: (route: RouteKey) => void;
  goBack: () => void;
  activeMetadata: ExtractedMetadata | null;
  setActiveMetadata: (metadata: ExtractedMetadata | null) => void;
  activePreviewUrl: string | null;
  setActivePreviewUrl: (url: string | null) => void;
  selectedLibraryItem: SavedPromptItem | null;
  setSelectedLibraryItem: (item: SavedPromptItem | null) => void;
  
  // Library & Favorites Engine
  libraryItems: SavedPromptItem[];
  folders: string[];
  favorites: string[];
  saveToLibrary: (item: Omit<SavedPromptItem, 'id' | 'date'> & { id?: string }) => SavedPromptItem;
  deleteFromLibrary: (id: string) => void;
  updateLibraryItem: (id: string, updates: Partial<SavedPromptItem>) => void;
  addFolder: (folderName: string) => void;
  toggleFavorite: (id: string) => void;
  openRecipeInResult: (item: SavedPromptItem) => void;
  /** Leaves any library / batch recipe view so the next extraction result is shown */
  clearRecipeView: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<RouteKey>('home');
  const [previousRoute, setPreviousRoute] = useState<RouteKey | null>(null);
  const [activeMetadata, setActiveMetadata] = useState<ExtractedMetadata | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<SavedPromptItem | null>(null);

  // Persistent library items state
  const [libraryItems, setLibraryItems] = useState<SavedPromptItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return upgradeLegacySamples(parsed).items;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_SAMPLE_PROMPTS;
  });

  // Persistent folders
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FOLDERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_FOLDERS;
  });

  // Persistent favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FAVORITES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return ['sample-1', 'sample-3'];
  });

  // Sync with native SQLite library in Electron environment
  useEffect(() => {
    if (window.promptHound?.library?.getAll) {
      window.promptHound.library.getAll().then((items) => {
        if (Array.isArray(items) && items.length > 0) {
          const upgraded = upgradeLegacySamples(items);
          if (upgraded.changed) {
            for (const legacy of items.filter(isLegacyPlaceholderSample)) {
              window.promptHound?.library?.deletePrompt(legacy.id);
            }
            for (const sample of INITIAL_SAMPLE_PROMPTS) {
              window.promptHound?.library?.savePrompt(sample);
            }
          }
          setLibraryItems(upgraded.items);
          const favs = upgraded.items.filter((i) => i.isFavorite).map((i) => i.id);
          setFavorites(favs);
        } else {
          // Initialize native DB with initial sample prompts
          for (const sample of INITIAL_SAMPLE_PROMPTS) {
            window.promptHound?.library?.savePrompt(sample);
          }
        }
      });
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(libraryItems));
    } catch {
      // storage quota or error
    }
  }, [libraryItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const navigate = (route: RouteKey) => {
    setPreviousRoute(currentRoute);
    setCurrentRoute(route);
  };

  const goBack = () => {
    if (previousRoute) {
      setCurrentRoute(previousRoute);
    } else {
      setCurrentRoute('home');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const isFav = !prev.includes(id);
      const next = isFav ? [...prev, id] : prev.filter((item) => item !== id);
      // Sync flag on library item if exists
      setLibraryItems((curr) =>
        curr.map((item) => (item.id === id ? { ...item, isFavorite: isFav } : item))
      );
      if (window.promptHound?.library?.toggleFavorite) {
        window.promptHound.library.toggleFavorite(id, isFav);
      }
      return next;
    });
  };

  const saveToLibrary = (itemData: Omit<SavedPromptItem, 'id' | 'date'> & { id?: string }): SavedPromptItem => {
    const id = itemData.id || `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newItem: SavedPromptItem = {
      ...itemData,
      id,
      date,
      isFavorite: favorites.includes(id) || !!itemData.isFavorite,
    };

    setLibraryItems((prev) => {
      const existingIdx = prev.findIndex((p) => p.id === id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newItem;
        return updated;
      }
      return [newItem, ...prev];
    });

    if (newItem.isFavorite && !favorites.includes(id)) {
      setFavorites((prev) => [...prev, id]);
    }

    if (window.promptHound?.library?.savePrompt) {
      window.promptHound.library.savePrompt(newItem);
    }

    return newItem;
  };

  const deleteFromLibrary = (id: string) => {
    setLibraryItems((prev) => prev.filter((item) => item.id !== id));
    setFavorites((prev) => prev.filter((item) => item !== id));
    if (selectedLibraryItem?.id === id) {
      setSelectedLibraryItem(null);
    }
    if (window.promptHound?.library?.deletePrompt) {
      window.promptHound.library.deletePrompt(id);
    }
  };

  const updateLibraryItem = (id: string, updates: Partial<SavedPromptItem>) => {
    setLibraryItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      const updated = next.find((item) => item.id === id);
      if (updated && window.promptHound?.library?.savePrompt) {
        window.promptHound.library.savePrompt(updated);
      }
      return next;
    });
    if (selectedLibraryItem?.id === id) {
      setSelectedLibraryItem((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const addFolder = (folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    setFolders((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const clearRecipeView = useCallback(() => {
    setSelectedLibraryItem(null);
    setActiveMetadata(null);
    setActivePreviewUrl(null);
  }, []);

  const openRecipeInResult = (item: SavedPromptItem) => {
    let width = item.metadata?.width || (item.metadata as any)?.image?.width;
    let height = item.metadata?.height || (item.metadata as any)?.image?.height;
    if ((!width || !height) && item.dimensions) {
      const parts = item.dimensions.split(/[\s×xX]+/);
      if (parts.length >= 2) {
        width = parseInt(parts[0], 10) || 1024;
        height = parseInt(parts[1], 10) || 1024;
      }
    }

    const meta: ExtractedMetadata = {
      prompt: item.metadata?.prompt || '',
      negativePrompt: item.metadata?.negativePrompt,
      sampler: item.metadata?.sampler || (item.metadata as any)?.generation?.sampler || 'Euler a',
      steps: item.metadata?.steps || (item.metadata as any)?.generation?.steps || 30,
      cfgScale: item.metadata?.cfgScale || (item.metadata as any)?.generation?.cfgScale || 7.0,
      seed: item.metadata?.seed || (item.metadata as any)?.generation?.seed,
      model: item.metadata?.model || (item.metadata as any)?.generation?.model || item.model || 'SDXL Base 1.0',
      modelHash: item.metadata?.modelHash,
      modelVersionId: item.metadata?.modelVersionId,
      modelResolved: item.metadata?.modelResolved,
      width: width || 1024,
      height: height || 1024,
      loras: item.metadata?.loras || [],
      detectedFormat: item.metadata?.detectedFormat || 'a1111',
      extraFields: item.metadata?.extraFields || (item.metadata as any)?.generation,
    };

    setSelectedLibraryItem(item);
    setActiveMetadata(meta);
    setActivePreviewUrl(item.thumbnailUrl || (item.metadata as any)?.image?.url || null);
    setPreviousRoute(currentRoute);
    setCurrentRoute('result');
  };

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        previousRoute,
        navigate,
        goBack,
        activeMetadata,
        setActiveMetadata,
        activePreviewUrl,
        setActivePreviewUrl,
        selectedLibraryItem,
        setSelectedLibraryItem,
        libraryItems,
        folders,
        favorites,
        saveToLibrary,
        deleteFromLibrary,
        updateLibraryItem,
        addFolder,
        toggleFavorite,
        openRecipeInResult,
        clearRecipeView,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
