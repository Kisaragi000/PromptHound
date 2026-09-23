import React, { ReactNode } from 'react';
import styles from './GlassPanel.module.css';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClass =
    padding === 'sm'
      ? styles.paddingSm
      : padding === 'lg'
      ? styles.paddingLg
      : padding === 'none'
      ? ''
      : styles.paddingMd;

  return (
    <div className={`${styles.panel} ${paddingClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
