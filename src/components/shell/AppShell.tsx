import React, { ReactNode, useEffect, useRef } from 'react';
import { TitleBar } from './TitleBar.js';
import { Sidebar } from './Sidebar.js';
import { UpdateBanner } from './UpdateBanner.js';
import { useExtraction } from '../../extraction/ExtractionContext.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { copiedImagePath, copiedImageUrl, isHttpUrl } from '../../utils/pasteSources.js';
import styles from './AppShell.module.css';

function mimeForName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif') return 'image/jpeg';
  return ext ? `image/${ext}` : '';
}

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { extractFromFile, extractMultipleFiles, addSessionImages, extractFromUrl, extractFromFilePath } = useExtraction();
  const { navigate, currentRoute } = useNavigation();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Dialogs (e.g. New Prompt) handle their own drops and pastes
  const dialogOpen = () => Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));

  /** Shows dropped, pasted or Explorer-opened images; adds them to a batch already on screen */
  const openImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (currentRoute === 'result' || currentRoute === 'extraction') {
      await addSessionImages(files);
    } else {
      navigate('result');
      if (files.length === 1) {
        await extractFromFile(files[0]);
      } else {
        await extractMultipleFiles(files);
      }
    }
  };
  const openImageFilesRef = useRef(openImageFiles);
  openImageFilesRef.current = openImageFiles;

  /**
   * Pastes that carry more than pixels. "Copy image" in a browser puts a re-encoded
   * bitmap on the clipboard (the prompt is gone) next to the image's address, so the
   * original file is fetched from that address instead. A copied link or an Explorer
   * "Copy as path" opens the same way. Returns false when the paste is none of these.
   */
  const openPastedSource = (html: string, text: string): boolean => {
    const source = copiedImageUrl(html) ?? (isHttpUrl(text) ? text : null);
    if (source) {
      navigate('result');
      void extractFromUrl(source);
      return true;
    }
    const filePath = copiedImagePath(text);
    if (filePath && window.promptHound?.extraction) {
      navigate('result');
      void extractFromFilePath(filePath);
      return true;
    }
    return false;
  };
  const openPastedSourceRef = useRef(openPastedSource);
  openPastedSourceRef.current = openPastedSource;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (dialogOpen()) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/')
      );
      await openImageFiles(files);
    }
  };

  // "Extract with PromptHound" from the Explorer right-click menu: files that started
  // the app, and files opened later while it runs
  useEffect(() => {
    const integration = window.promptHound?.shellIntegration;
    if (!integration) return;
    const takeFiles = async () => {
      const opened = await integration.takeOpenedFiles();
      const files = opened.map((f) => new File([f.bytes as BlobPart], f.name, { type: mimeForName(f.name) }));
      await openImageFilesRef.current(files);
    };
    void takeFiles();
    return integration.onFilesOpened(() => void takeFiles());
  }, []);

  // Global clipboard paste support (Ctrl+V with multiple images)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (dialogOpen()) return;
      // Don't intercept if typing in text inputs or textareas
      const target = document.activeElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        if (openPastedSourceRef.current(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain').trim())) {
          e.preventDefault();
          return;
        }

        const imageFiles: File[] = [];

        // Check clipboard items
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              imageFiles.push(blob);
            }
          }
        }

        // Check clipboard files
        if (imageFiles.length === 0 && e.clipboardData.files.length > 0) {
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const file = e.clipboardData.files[i];
            if (file.type.startsWith('image/') || /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(file.name)) {
              imageFiles.push(file);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          await openImageFilesRef.current(imageFiles);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className={styles.body}>
        <Sidebar />
        <main
          className={styles.content}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {children}
        </main>
      </div>
      <UpdateBanner />
    </div>
  );
};


