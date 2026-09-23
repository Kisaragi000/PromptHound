import React, { ReactNode, useEffect } from 'react';
import { TitleBar } from './TitleBar.js';
import { Sidebar } from './Sidebar.js';
import { useExtraction } from '../../extraction/ExtractionContext.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { extractFromFile, extractMultipleFiles, addSessionImages, sessionImages } = useExtraction();
  const { navigate, currentRoute } = useNavigation();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/')
      );
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
    }
  };

  // Global clipboard paste support (Ctrl+V with multiple images)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
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
          if (currentRoute === 'result' || currentRoute === 'extraction') {
            await addSessionImages(imageFiles);
          } else {
            navigate('result');
            if (imageFiles.length === 1) {
              await extractFromFile(imageFiles[0]);
            } else {
              await extractMultipleFiles(imageFiles);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [navigate, currentRoute, extractFromFile, extractMultipleFiles, addSessionImages]);

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
    </div>
  );
};


