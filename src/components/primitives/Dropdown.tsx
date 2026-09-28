import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckIcon } from '../icons/Icons.js';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Shown after a divider at the end of the list, e.g. "+ New folder…" */
  isAction?: boolean;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Icon shown before the selected label */
  icon?: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  size?: 'md' | 'sm';
  className?: string;
}

/** Themed replacement for <select>: the native list is drawn by Windows and ignores the theme */
export const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  icon,
  ariaLabel,
  title,
  size = 'md',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value && !o.isAction);
  const regular = options.filter((o) => !o.isAction);
  const actions = options.filter((o) => o.isAction);
  const ordered = [...regular, ...actions];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const openList = () => {
    setHighlight(Math.max(0, ordered.findIndex((o) => o.value === value && !o.isAction)));
    setOpen(true);
  };

  const choose = (option: DropdownOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(ordered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (ordered[highlight]) choose(ordered[highlight]);
    }
  };

  const renderOption = (option: DropdownOption) => {
    const index = ordered.indexOf(option);
    const isSelected = option.value === value && !option.isAction;
    return (
      <li
        key={`${option.isAction ? 'action' : 'opt'}-${option.value}`}
        id={`${listId}-${index}`}
        data-index={index}
        role="option"
        aria-selected={isSelected}
        className={`${styles.option} ${index === highlight ? styles.highlighted : ''} ${isSelected ? styles.selected : ''} ${option.isAction ? styles.action : ''}`}
        onMouseEnter={() => setHighlight(index)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(option)}
      >
        {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
        <span className={styles.optionLabel}>{option.label}</span>
        {isSelected && <CheckIcon size={14} className={styles.check} />}
      </li>
    );
  };

  return (
    <div ref={rootRef} className={`${styles.root} ${size === 'sm' ? styles.small : ''} ${className}`}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        aria-label={ariaLabel}
        title={title}
      >
        {(selected?.icon ?? icon) && <span className={styles.triggerIcon}>{selected?.icon ?? icon}</span>}
        <span className={selected ? styles.triggerLabel : styles.placeholder}>{selected?.label ?? placeholder}</span>
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
          {regular.map(renderOption)}
          {actions.length > 0 && regular.length > 0 && <li role="separator" className={styles.divider} />}
          {actions.map(renderOption)}
        </ul>
      )}
    </div>
  );
};
