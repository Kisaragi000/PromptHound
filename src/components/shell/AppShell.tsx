import React, { ReactNode } from 'react';
import { TitleBar } from './TitleBar.js';
import { Sidebar } from './Sidebar.js';
import { useExtraction } from '../../extraction/ExtractionContext.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { extractFromFile } = useExtraction();
  const { navigate } = useNavigation();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      navigate('extraction');
      await extractFromFile(file);
    }
  };

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


