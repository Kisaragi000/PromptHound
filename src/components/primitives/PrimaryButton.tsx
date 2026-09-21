import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './PrimaryButton.module.css';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
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
