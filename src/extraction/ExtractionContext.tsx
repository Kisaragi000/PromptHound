import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ExtractionResult, ExtractionError, ExtractedMetadata } from '../../core/types.js';
import { useNavigation } from '../navigation/NavigationContext.js';

export type ExtractionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SessionImageItem {
  id: string;
  previewUrl: string;
  label: string;
  status: 'pending' | 'parsing' | 'success' | 'error';
  result?: ExtractionResult | null;
  error?: ExtractionError | null;
  file?: File;
}

interface ExtractionState {
  status: ExtractionStatus;
  result: ExtractionResult | null;
  error: ExtractionError | null;
}

export interface ExtractionContextValue extends ExtractionState {
  sessionImages: SessionImageItem[];
  activeImageIndex: number;
  setActiveImageIndex: (index: number) => void;
  extractFromFilePath: (filePath: string) => Promise<void>;
  extractFromFile: (file: File) => Promise<void>;
  extractMultipleFiles: (files: File[]) => Promise<void>;
  addSessionImages: (files: File[]) => Promise<void>;
  removeSessionImage: (id: string) => void;
  extractFromClipboard: () => Promise<void>;
  extractFromUrl: (url: string) => Promise<void>;
  reset: () => void;
}

const ExtractionContext = createContext<ExtractionContextValue | null>(null);

function isError(value: ExtractionResult | ExtractionError): value is ExtractionError {
  return 'code' in value;
}

export function ExtractionProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [state, setState] = useState<ExtractionState>({
    status: 'idle',
    result: null,
    error: null,
  });

  // Every new extraction leaves any library recipe that was being viewed, from
  // whichever page it starts (Home drop, browse, URL, clipboard, result page)
  const { clearRecipeView } = useNavigation();

  const [sessionImages, setSessionImages] = useState<SessionImageItem[]>([]);
  const [activeImageIndex, setActiveImageIndexState] = useState<number>(0);

  const runExtraction = useCallback(
    async (task: () => Promise<ExtractionResult | ExtractionError>) => {
      clearRecipeView();
      setState({ status: 'loading', result: null, error: null });
      try {
        const outcome = await task();
        if (isError(outcome)) {
          setState({ status: 'error', result: null, error: outcome });
        } else {
          setState({ status: 'success', result: outcome, error: null });
        }
      } catch (error) {
        setState({
          status: 'error',
          result: null,
          error: {
            code: 'fetch-failed',
            message: error instanceof Error ? error.message : 'Something unexpected went wrong.',
          },
        });
      }
    },
    [clearRecipeView]
  );

  // The batch as last rendered and the id of the image on screen. Extractions finish
  // asynchronously; each one updates the screen only if its image is still the active one.
  const sessionRef = useRef<SessionImageItem[]>([]);
  const activeIdRef = useRef<string | null>(null);

  const commitSession = (items: SessionImageItem[]) => {
    sessionRef.current = items;
    setSessionImages(items);
  };

  const updateSessionItem = (id: string, updates: Partial<SessionImageItem>) => {
    commitSession(sessionRef.current.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  const showItem = (item: SessionImageItem | undefined) => {
    if (!item) {
      setState({ status: 'idle', result: null, error: null });
    } else if (item.status === 'success' && item.result) {
      setState({ status: 'success', result: item.result, error: null });
    } else if (item.status === 'error' && item.error) {
      setState({ status: 'error', result: null, error: item.error });
    } else {
      setState({ status: 'loading', result: null, error: null });
    }
  };

  const activate = (index: number) => {
    const item = sessionRef.current[index];
    activeIdRef.current = item?.id ?? null;
    setActiveImageIndexState(Math.max(0, index));
    showItem(item);
  };

  const setActiveImageIndex = useCallback((index: number) => {
    if (index < 0 || index >= sessionRef.current.length) return;
    activate(index);
  }, []);

  const extractSingleBuffer = async (
    file: File,
    previewUrl: string
  ): Promise<ExtractionResult | ExtractionError> => {
    try {
      const { extractFromImageBuffer } = await import('../../core/link-fetch.js');
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      return await extractFromImageBuffer(
        uint8,
        { kind: 'file', label: file.name },
        previewUrl
      );
    } catch (err) {
      return {
        code: 'parse-error',
        message: err instanceof Error ? err.message : 'Failed to parse image file.',
      };
    }
  };

  const toSessionItems = (files: File[]): SessionImageItem[] =>
    files.map((file, idx) => ({
      id: `img_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      previewUrl: URL.createObjectURL(file),
      label: file.name,
      status: 'pending',
      file,
    }));

  const runItem = async (item: SessionImageItem) => {
    updateSessionItem(item.id, { status: 'parsing' });
    const outcome = await extractSingleBuffer(item.file!, item.previewUrl);
    const updates: Partial<SessionImageItem> = isError(outcome)
      ? { status: 'error', error: outcome }
      : { status: 'success', result: outcome };
    updateSessionItem(item.id, updates);
    if (activeIdRef.current === item.id) showItem({ ...item, ...updates });
  };

  const isImageFile = (f: File) =>
    /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/');

  const extractMultipleFiles = useCallback(
    async (rawFiles: File[]) => {
      const files = rawFiles.filter(isImageFile).slice(0, 10);
      if (files.length === 0) return;
      clearRecipeView();

      const items = toSessionItems(files);
      commitSession(items);
      activate(0);
      await Promise.all(items.map(runItem));
    },
    [clearRecipeView]
  );

  /**
   * Adds images to the current batch and shows the first new one, so dropping a working
   * image on top of a failed one shows its result instead of staying on the error.
   */
  const addSessionImages = useCallback(
    async (rawFiles: File[]) => {
      const available = 10 - sessionRef.current.length;
      const files = rawFiles.filter(isImageFile).slice(0, Math.max(0, available));
      if (files.length === 0) return;
      clearRecipeView();

      const firstNewIndex = sessionRef.current.length;
      const items = toSessionItems(files);
      commitSession([...sessionRef.current, ...items]);
      activate(firstNewIndex);
      await Promise.all(items.map(runItem));
    },
    [clearRecipeView]
  );

  const removeSessionImage = useCallback((id: string) => {
    const current = sessionRef.current;
    const removedIndex = current.findIndex((it) => it.id === id);
    if (removedIndex === -1) return;
    const next = current.filter((it) => it.id !== id);
    commitSession(next);
    if (activeIdRef.current === id) {
      activate(Math.min(removedIndex, next.length - 1));
    } else {
      setActiveImageIndexState(Math.max(0, next.findIndex((it) => it.id === activeIdRef.current)));
    }
  }, []);

  const extractFromFilePath = useCallback(
    (filePath: string) => {
      if (window.promptHound?.extraction) {
        return runExtraction(async () => {
          const res = await window.promptHound!.extraction.fromFilePath(filePath);
          if (!isError(res)) {
            commitSession([
              {
                id: `img_${Date.now()}`,
                previewUrl: res.previewUrl || '',
                label: res.source.label || 'Local File',
                status: 'success',
                result: res,
              },
            ]);
            activeIdRef.current = sessionRef.current[0]?.id ?? null;
            setActiveImageIndexState(0);
          }
          return res;
        });
      }
      return runExtraction(async () => ({
        code: 'unsupported-format',
        message: 'Direct file path extraction is only supported in the PromptHound desktop app.',
      }));
    },
    [runExtraction]
  );

  const extractFromFile = useCallback(
    async (file: File) => {
      // Direct multiple files delegate
      return extractMultipleFiles([file]);
    },
    [extractMultipleFiles]
  );

  const extractFromClipboard = useCallback(() => {
    if (window.promptHound?.extraction) {
      return runExtraction(async () => {
        const res = await window.promptHound!.extraction.fromClipboard();
        if (!isError(res)) {
          commitSession([
            {
              id: `img_${Date.now()}`,
              previewUrl: res.previewUrl || '',
              label: 'Clipboard Image',
              status: 'success',
              result: res,
            },
          ]);
          activeIdRef.current = sessionRef.current[0]?.id ?? null;
          setActiveImageIndexState(0);
        }
        return res;
      });
    }
    return runExtraction(async () => ({
      code: 'no-metadata-found',
      message: 'Clipboard image reading is supported in the PromptHound desktop app.',
    }));
  }, [runExtraction]);

  const extractFromUrl = useCallback(
    (url: string) => {
      if (window.promptHound?.extraction) {
        return runExtraction(async () => {
          const res = await window.promptHound!.extraction.fromUrl(url);
          if (!isError(res)) {
            commitSession([
              {
                id: `img_${Date.now()}`,
                previewUrl: res.previewUrl || url,
                label: url,
                status: 'success',
                result: res,
              },
            ]);
            activeIdRef.current = sessionRef.current[0]?.id ?? null;
            setActiveImageIndexState(0);
          }
          return res;
        });
      }

      // Browser fallback
      return runExtraction(async () => {
        const { extractFromUrl: coreExtractFromUrl } = await import('../../core/link-fetch.js');
        const res = await coreExtractFromUrl(url);
        if (!isError(res)) {
          commitSession([
            {
              id: `img_${Date.now()}`,
              previewUrl: res.previewUrl || url,
              label: url,
              status: 'success',
              result: res,
            },
          ]);
          activeIdRef.current = sessionRef.current[0]?.id ?? null;
          setActiveImageIndexState(0);
        }
        return res;
      });
    },
    [runExtraction]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null });
    commitSession([]);
    activeIdRef.current = null;
    setActiveImageIndexState(0);
  }, []);

  const value = useMemo<ExtractionContextValue>(
    () => ({
      ...state,
      sessionImages,
      activeImageIndex,
      setActiveImageIndex,
      extractFromFilePath,
      extractFromFile,
      extractMultipleFiles,
      addSessionImages,
      removeSessionImage,
      extractFromClipboard,
      extractFromUrl,
      reset,
    }),
    [
      state,
      sessionImages,
      activeImageIndex,
      setActiveImageIndex,
      extractFromFilePath,
      extractFromFile,
      extractMultipleFiles,
      addSessionImages,
      removeSessionImage,
      extractFromClipboard,
      extractFromUrl,
      reset,
    ]
  );

  return <ExtractionContext.Provider value={value}>{children}</ExtractionContext.Provider>;
}

export function useExtraction(): ExtractionContextValue {
  const context = useContext(ExtractionContext);
  if (!context) {
    throw new Error('useExtraction must be used within an ExtractionProvider');
  }
  return context;
}

