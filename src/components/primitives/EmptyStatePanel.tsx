import React, { ReactNode } from 'react';
import { GlassPanel } from './GlassPanel.js';
import styles from './EmptyStatePanel.module.css';

interface EmptyStatePanelProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyStatePanel: React.FC<EmptyStatePanelProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className={styles.wrap}>
      <GlassPanel className={styles.panel} padding="lg">
        <div className={styles.iconWrap}>{icon}</div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        {action && <div>{action}</div>}
      </GlassPanel>
    </div>
  );
};
