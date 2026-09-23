import React from 'react';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  label: string;
  status?: 'success' | 'neutral' | 'error';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'neutral',
  className = '',
}) => {
  const statusClass =
    status === 'success'
      ? styles.success
      : status === 'error'
      ? styles.error
      : styles.neutral;

  return (
    <div className={`${styles.badge} ${statusClass} ${className}`}>
      <span className={styles.dot} />
      <span>{label}</span>
    </div>
  );
};
