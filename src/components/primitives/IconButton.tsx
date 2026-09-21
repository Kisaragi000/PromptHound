import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'danger';
  title?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'default',
  title,
  className = '',
  ...props
}) => {
  return (
    <button
      title={title}
      aria-label={title}
      className={`${styles.button} ${variant === 'danger' ? styles.danger : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
