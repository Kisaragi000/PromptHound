import React, { InputHTMLAttributes, ReactNode } from 'react';
import styles from './GlassInput.module.css';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const GlassInput: React.FC<GlassInputProps> = ({ icon, className = '', ...props }) => {
  return (
    <div className={styles.wrap}>
      {icon && <div className={styles.iconSlot}>{icon}</div>}
      <input
        className={`${styles.input} ${icon ? styles.withIcon : ''} ${className}`}
        {...props}
      />
    </div>
  );
};
