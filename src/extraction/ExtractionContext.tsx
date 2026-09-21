import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ExtractionResult, ExtractionError } from '../../core/types.js';

type ExtractionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExtractionState {
  status: ExtractionStatus;
  result: ExtractionResult | null;
  error: ExtractionError | null;
}

interface ExtractionContextValue extends ExtractionState {
  extractFromFilePath: (filePath: string) => Promise<void>;
  extractFromFile: (file: File) => Promise<void>;
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

  const extractFromFilePath = useCallback(
    (filePath: string) => {
      if (window.promptHound?.extraction) {
        return runExtraction(() => window.promptHound!.extraction.fromFilePath(filePath));
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
      // If running inside Electron, get real file path from webUtils
      if (window.promptHound?.extraction) {
        const filePath = window.promptHound.extraction.getPathForFile(file);
        if (filePath) {
          return runExtraction(() => window.promptHound!.extraction.fromFilePath(filePath));
        }
      }

      // Universal client-side extraction with full fallback pipeline
      return runExtraction(async () => {
        try {
          const { extractFromImageBuffer } = await import('../../core/link-fetch.js');
          const previewUrl = URL.createObjectURL(file);
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
      });
    },
    [runExtraction]
  );

  const extractFromClipboard = useCallback(() => {
    if (window.promptHound?.extraction) {
      return runExtraction(() => window.promptHound!.extraction.fromClipboard());
    }
    return runExtraction(async () => ({
      code: 'no-metadata-found',
      message: 'Clipboard image reading is supported in the PromptHound desktop app.',
    }));
  }, [runExtraction]);

  const extractFromUrl = useCallback(
    (url: string) => {
      if (window.promptHound?.extraction) {
        return runExtraction(() => window.promptHound!.extraction.fromUrl(url));
      }

      // Browser fallback
      return runExtraction(async () => {
        const { extractFromUrl: coreExtractFromUrl } = await import('../../core/link-fetch.js');
        return coreExtractFromUrl(url);
      });
    },
    [runExtraction]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null });
  }, []);

  const value = useMemo<ExtractionContextValue>(
    () => ({
      ...state,
      extractFromFilePath,
      extractFromFile,
      extractFromClipboard,
      extractFromUrl,
      reset,
    }),
    [state, extractFromFilePath, extractFromFile, extractFromClipboard, extractFromUrl, reset]
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
