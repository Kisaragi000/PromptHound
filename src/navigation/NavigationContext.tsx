import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { ExtractedMetadata, ExtractionResult, SavedPromptItem } from '../../core/types.js';

export type RouteKey =
  | 'home'
  | 'result'
  | 'extraction'
  | 'library'
  | 'favorites'
  | 'settings'
  | 'about';

const STORAGE_KEY_PROMPTS = 'prompthound_library_items_v2';
const STORAGE_KEY_FOLDERS = 'prompthound_folders_v2';
const STORAGE_KEY_FAVORITES = 'prompthound_favorites_v2';

const INITIAL_SAMPLE_PROMPTS: SavedPromptItem[] = [
  {
    id: 'sample-1',
    title: 'Cyberpunk Girl',
    folder: 'Portraits',
    source: 'Civitai',
    date: 'Apr 28, 2025',
    model: 'SDXL Base 1.0',
    dimensions: '1024 × 1536',
    isFavorite: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    metadata: {
      prompt: 'masterpiece, best quality, ultra detailed, 1girl, cyberpunk style, neon lights, night city, blue hair, looking back, jacket, cinematic lighting, sharp focus, depth of field',
      negativePrompt: 'low quality, bad anatomy, extra fingers, blurry, watermark, text, logo, deformed',
      sampler: 'DPM++ 2M Karras',
      steps: 30,
      cfgScale: 7.5,
      seed: 123456789,
      model: 'Anything v5.0',
      width: 1024,
      height: 1536,
      loras: [
        {
          rawName: 'Cyberpunk_Style',
          strength: 0.8,
          resolved: {
            name: 'Cyberpunk Style (SDXL)',
            source: 'civitai',
            modelUrl: 'https://civitai.com/models/12345',
            coverImageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=150&q=80',
            triggerWords: ['cyberpunk', 'neon lights', 'night city'],
            baseModel: 'SDXL 1.0',
            versionName: 'v1.2',
          },
        },
        {
          rawName: 'Detail_Tweaker',
          strength: 0.4,
          resolved: {
            name: 'Detail Tweaker / Enhancer',
            source: 'civitai',
            modelUrl: 'https://civitai.com/models/67890',
            coverImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
            triggerWords: ['high detail', 'sharp focus'],
            baseModel: 'SDXL 1.0',
            versionName: 'v1.0',
          },
        },
      ],
      detectedFormat: 'a1111',
    },
  },
  {
    id: 'sample-2',
    title: 'Fantasy Landscape',
    folder: 'Landscapes',
    source: 'Civitai',
    date: 'Apr 27, 2025',
    model: 'Juggernaut XL v9',
    dimensions: '1536 × 1024',
    isFavorite: false,
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    metadata: {
      prompt: 'ethereal fantasy valley, ancient stone ruins, cascading waterfalls, emerald river, golden hour sunlight, majestic mountains, hyperdetailed matte painting',
      negativePrompt: 'foggy, lowres, oversaturated, blown out, modern buildings',
      sampler: 'Euler a',
      steps: 35,
      cfgScale: 6.5,
      seed: 884719201,
      model: 'Juggernaut XL v9',
      width: 1536,
      height: 1024,
      loras: [{ rawName: 'Nature_Enhancer', strength: 0.6 }],
      detectedFormat: 'a1111',
    },
  },
  {
    id: 'sample-3',
    title: 'Anime Style Portrait',
    folder: 'Anime Style',
    source: 'Civitai',
    date: 'Apr 25, 2025',
    model: 'Animagine XL v3.1',
    dimensions: '1024 × 1024',
    isFavorite: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    metadata: {
      prompt: 'anime girl with ribbon, soft sakura blossoms falling, expressive eyes, delicate lineart, Makoto Shinkai style, studio lighting',
      negativePrompt: 'worst quality, normal quality, artifacts, 3d render',
      sampler: 'DPM++ SDE Karras',
      steps: 28,
      cfgScale: 8.0,
      seed: 554109823,
      model: 'Animagine XL v3.1',
      width: 1024,
      height: 1024,
      loras: [],
      detectedFormat: 'a1111',
    },
  },
];

const INITIAL_FOLDERS = ['All Prompts', 'Portraits', 'Landscapes', 'Characters', 'Anime Style', 'My Creations'];

interface NavigationContextType {
  currentRoute: RouteKey;
  navigate: (route: RouteKey) => void;
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
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<RouteKey>('home');
  const [activeMetadata, setActiveMetadata] = useState<ExtractedMetadata | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<SavedPromptItem | null>(null);

  // Persistent library items state
  const [libraryItems, setLibraryItems] = useState<SavedPromptItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
          setLibraryItems(items);
          const favs = items.filter((i) => i.isFavorite).map((i) => i.id);
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
    setCurrentRoute(route);
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

  const openRecipeInResult = (item: SavedPromptItem) => {
    const meta: ExtractedMetadata = {
      prompt: item.metadata?.prompt || '',
      negativePrompt: item.metadata?.negativePrompt,
      sampler: item.metadata?.sampler || item.metadata?.generation?.sampler,
      steps: item.metadata?.steps || item.metadata?.generation?.steps,
      cfgScale: item.metadata?.cfgScale || item.metadata?.generation?.cfgScale,
      seed: item.metadata?.seed || item.metadata?.generation?.seed,
      model: item.metadata?.model || item.metadata?.generation?.model || item.model,
      width: item.metadata?.width || item.metadata?.image?.width,
      height: item.metadata?.height || item.metadata?.image?.height,
      loras: item.metadata?.loras || [],
      detectedFormat: item.metadata?.detectedFormat || 'a1111',
      extraFields: item.metadata?.extraFields || item.metadata?.generation,
    };

    setActiveMetadata(meta);
    setActivePreviewUrl(item.thumbnailUrl || item.metadata?.image?.url || null);
    navigate('result');
  };

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        navigate,
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
