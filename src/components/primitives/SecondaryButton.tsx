import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SecondaryButton.module.css';

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`${styles.button} ${fullWidth ? styles.fullWidth : ''} ${className}`}
      {...props}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
