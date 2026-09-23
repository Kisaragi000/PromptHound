import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ExtractionResult, ExtractionError, ExtractedMetadata } from '../../core/types.js';

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

  const [sessionImages, setSessionImages] = useState<SessionImageItem[]>([]);
  const [activeImageIndex, setActiveImageIndexState] = useState<number>(0);

  const runExtraction = useCallback(
    async (task: () => Promise<ExtractionResult | ExtractionError>) => {
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
    []
  );

  const setActiveImageIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= sessionImages.length) return;
      setActiveImageIndexState(index);
      const target = sessionImages[index];
      if (target) {
        if (target.status === 'success' && target.result) {
          setState({ status: 'success', result: target.result, error: null });
        } else if (target.status === 'error' && target.error) {
          setState({ status: 'error', result: null, error: target.error });
        } else if (target.status === 'parsing' || target.status === 'pending') {
          setState({ status: 'loading', result: null, error: null });
        }
      }
    },
    [sessionImages]
  );

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

  const extractMultipleFiles = useCallback(
    async (rawFiles: File[]) => {
      const files = rawFiles
        .filter((f) => /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/'))
        .slice(0, 10);

      if (files.length === 0) return;

      const items: SessionImageItem[] = files.map((file, idx) => ({
        id: `img_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        previewUrl: URL.createObjectURL(file),
        label: file.name,
        status: idx === 0 ? 'parsing' : 'pending',
        file,
      }));

      setSessionImages(items);
      setActiveImageIndexState(0);
      setState({ status: 'loading', result: null, error: null });

      // Process all files concurrently
      items.forEach(async (item, idx) => {
        setSessionImages((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'parsing' } : it))
        );

        const outcome = await extractSingleBuffer(item.file!, item.previewUrl);

        setSessionImages((prev) =>
          prev.map((it) => {
            if (it.id !== item.id) return it;
            if (isError(outcome)) {
              return { ...it, status: 'error', error: outcome };
            }
            return { ...it, status: 'success', result: outcome };
          })
        );

        // If this is currently the active item, update the main state immediately
        setActiveImageIndexState((currentActive) => {
          if (currentActive === idx) {
            if (isError(outcome)) {
              setState({ status: 'error', result: null, error: outcome });
            } else {
              setState({ status: 'success', result: outcome, error: null });
            }
          }
          return currentActive;
        });
      });
    },
    []
  );

  const addSessionImages = useCallback(
    async (rawFiles: File[]) => {
      const newFiles = rawFiles.filter(
        (f) => /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/')
      );
      if (newFiles.length === 0) return;

      setSessionImages((prev) => {
        const availableSlots = 10 - prev.length;
        if (availableSlots <= 0) return prev;
        const filesToAdd = newFiles.slice(0, availableSlots);

        const newItems: SessionImageItem[] = filesToAdd.map((file, idx) => ({
          id: `img_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          previewUrl: URL.createObjectURL(file),
          label: file.name,
          status: 'pending',
          file,
        }));

        // Fire extraction for new items
        newItems.forEach(async (item) => {
          setSessionImages((p) =>
            p.map((it) => (it.id === item.id ? { ...it, status: 'parsing' } : it))
          );
          const outcome = await extractSingleBuffer(item.file!, item.previewUrl);
          setSessionImages((p) =>
            p.map((it) => {
              if (it.id !== item.id) return it;
              if (isError(outcome)) {
                return { ...it, status: 'error', error: outcome };
              }
              return { ...it, status: 'success', result: outcome };
            })
          );
        });

        return [...prev, ...newItems];
      });
    },
    []
  );

  const removeSessionImage = useCallback(
    (id: string) => {
      setSessionImages((prev) => {
        const idxToRemove = prev.findIndex((it) => it.id === id);
        if (idxToRemove === -1) return prev;
        const nextList = prev.filter((it) => it.id !== id);

        setActiveImageIndexState((currentActive) => {
          let nextActive = currentActive;
          if (nextActive >= nextList.length) {
            nextActive = Math.max(0, nextList.length - 1);
          }
          const nextTarget = nextList[nextActive];
          if (nextTarget) {
            if (nextTarget.status === 'success' && nextTarget.result) {
              setState({ status: 'success', result: nextTarget.result, error: null });
            } else if (nextTarget.status === 'error' && nextTarget.error) {
              setState({ status: 'error', result: null, error: nextTarget.error });
            } else {
              setState({ status: 'loading', result: null, error: null });
            }
          } else {
            setState({ status: 'idle', result: null, error: null });
          }
          return nextActive;
        });

        return nextList;
      });
    },
    []
  );

  const extractFromFilePath = useCallback(
    (filePath: string) => {
      if (window.promptHound?.extraction) {
        return runExtraction(async () => {
          const res = await window.promptHound!.extraction.fromFilePath(filePath);
          if (!isError(res)) {
            setSessionImages([
              {
                id: `img_${Date.now()}`,
                previewUrl: res.previewUrl || '',
                label: res.source.label || 'Local File',
                status: 'success',
                result: res,
              },
            ]);
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
          setSessionImages([
            {
              id: `img_${Date.now()}`,
              previewUrl: res.previewUrl || '',
              label: 'Clipboard Image',
              status: 'success',
              result: res,
            },
          ]);
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
            setSessionImages([
              {
                id: `img_${Date.now()}`,
                previewUrl: res.previewUrl || url,
                label: url,
                status: 'success',
                result: res,
              },
            ]);
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
          setSessionImages([
            {
              id: `img_${Date.now()}`,
              previewUrl: res.previewUrl || url,
              label: url,
              status: 'success',
              result: res,
            },
          ]);
          setActiveImageIndexState(0);
        }
        return res;
      });
    },
    [runExtraction]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null });
    setSessionImages([]);
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

