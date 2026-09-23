import React, { ReactNode } from 'react';
import styles from './GlassCard.module.css';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  dragActive?: boolean;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  interactive = false,
  dragActive = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`${styles.card} ${interactive ? styles.interactive : ''} ${
        dragActive ? styles.dragActive : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
