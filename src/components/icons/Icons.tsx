import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

/**
 * Official PromptHound pointer hound dog mark
 */
export const PromptHoundLogo: React.FC<IconProps> = ({ size = 32, color = '#F59A22', className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="none"
    className={className}
    {...props}
  >
    <g id="VECTOR">
      <path
        fill={color}
        d="M100.42,139.04l-.89-3.42-1.22-3.99c-.41-1.35-.51-2.89-.81-4.3l-.47-2.25c-.28-1.34.1-2.65-.48-3.93-.77,1.64-1.34,3.19-1.51,4.93l-.54,1.73.05,8.53c0,.94.48,1.72.42,2.78-.09,1.58.78,3.73.11,5.84-1.06,3.31-4.33,5.68-7.63,4.92l-15.54-3.6-12.28-2.71c-.96-.21-2.47-.33-2.85.8s.74,2.24,1.24,3.05c1.91,3.05,4.04,2.98,5.8,4.68,3.28,3.18,4.29,9.16,1.12,12.14-4.08.53-9.31-4.09-11.93-7.49l-2.35-3.93-1.04-1.92-3.91-7.12c-1.56-2.84,1.49-8.65,6.55-10.22.48-.15,1.22-.3,1.73-.29l7.53.1,5.65.22,4.46.11c1.16.03,2.34.51,3.53.02l-7.27-7.39c-1.78-1.81-3.01-3.82-4.15-6.07-1.38-2.72-1.82-5.65-2.17-8.68-.08-.66-.42-1.33-.46-2.02-.09-1.61-.65-3.03-1.07-4.52-.37-1.31-.63-2.53-1.34-3.7-.34-.55.09-1.24.41-1.66,1.02-1.34,1.48-2.9,2.24-4.34.39-.74.54-1.55.88-2.3.81-1.75,1-3.52,1.46-5.33.79-3.12.64-6.19-.46-9.34.2-.49-.59-.5-.48,0,.3,1.05-.17,1.81-.31,2.6-.43,2.53-1.15,3.98-2.37,6.06-2,3.41-6.18,9.22-9.55,10.3-1.4.45-3.03.21-3.88-.82-1.41-1.7-2.22-4.64-2.45-6.93l-.34-3.39c-.12-1.2-.36-2.12-.42-3.22l-.24-4.27-.22-3.18-.25-3.38c-.07-.97-.05-1.66-.44-2.59-.25-.59-.32-5.14-1.09-5.09-.12,0-.33.26-.36.46l-.64,5.83c-.1.89-.33,1.53-.37,2.39l-.24,4.96-.23,5.18c-.07,1.52-.04,2.88-.13,4.63-3.17-1.8-6.61-2.49-10.16-2.04l-5.04.64c-4.29.54-9.34-.31-12.59-3.33-2.98-2.77-3.2-6.38-5.18-9.28-.54-.79-1.08-2.25-.43-3.12s2.06-1.24,3.12-1.57l9.81-3.08c1.6-.5,3.26-.77,4.7-1.69,2.08-1.32,3.37-7.45,12.05-9.65,4.66-1.18,9.35-1.19,14.1-.52s8.52,2.48,11.32,6.15l6.46,8.46c3.42,4,7.26,7.36,11.52,10.42,3.71,2.67,7.75,4.36,11.91,6.21l7.2,3.19,8.86,3.83c9.06,3.91,18.66,5.92,28.49,6.61l2.75.19c1.54.11,2.98.13,4.52.24l3.18.23,2.46.24c1.25.12,2.38.09,3.64.2l2.71.23,6.33.66,5.6.94c3.37.56,6.56,1.58,9.65,3.01,1.14.53,2.08.48,3.32.6l5.29.52,3.97.06,1.81.24h9.02s2.05-.23,2.05-.23c1.61.21,3.15-.02,4.73-.17l4.81-.48c13.5-1.35,26.27-5.02,39.22-9.81-7.81,5.91-16.49,9.93-25.53,13.13-10.24,3.63-20.74,5.83-31.48,6.93l-2.4.17-3.39.23c-.99.07-1.88.37-2.98.14.22,1.11.75,1.83,1.21,2.7,1.34,2.54,2.12,5.08,2.86,7.81.66,2.43.96,4.84,1.29,7.34l.35,1.44.75,6.52.72,2.84c.23.91.51,1.72.83,2.53l1.28,3.25,1.09,1.88c1.89,3.25,6.28,8.28,9.16,10.03l3.55,2.16,3.23,1.92c.95.56,1.07,1.33,1.46,2.24l1.28,3,4.62,11.44,1.1,2.52,1.37,3.4,1.06,2.55,1.25,3.3,1.08,3.24c.37,1.11.92,2.3.69,3.65h-17.55c.12-3.27,1.67-6.28,4.74-7.4.45-.17.72-.63.89-.9.28-.47-.2-1.12-.28-1.48-.35-1.54-.83-2.81-1.49-4.2l-1.3-2.75-1.95-3.55c-2.85-5.19-6.18-8.55-11.51-11.09l-5.37-2.55-11.75-5.23c-5.98-2.66-11.03-6.42-15.24-11.45l-3.21-4.48-1.54-2.55-.9-1.59-1.84-3.57c-1.14-2.21-2.2-4.32-3.53-6.4-5.75-9.02-15.78-7.33-24.57-3.05l-9.14,4.44c-5.66,2.75-12.45,5.12-18.95,4.69Z"
      />
      <path
        fill={color}
        d="M83.22,202.14c.44-3.2,2.63-6.12,5.67-7.04,1.8-.54,3.41-1.13,4.3-2.81.67-1.27,1.1-2.44,1.42-3.84.82-3.54.05-5.44-.04-7.1l-.26-4.71-.2-2.52c-.15-1.88-.23-3.71-.67-5.47-.2-.79-.16-1.77-.26-2.63l-.65-5.58c-.08-.66-.48-1.11-.31-1.95l-.22-1.75c3.06-1.43,6.32-3.05,7.96-6.04l1.13-2.06c.27-.5.34-1.17,1.13-1.16l3,.07c.24,1.51-.06,2.93-.1,4.41l-.16,5.97-.13,5.13c-.03,1.12-.35,2.22-.2,3.38.17,1.35-.23,4.64-.38,7.02l-.23,3.61-.17,6.87c-.03,1.26-.27,2.71-.05,3.93.38,2.05.2,3.75-1.04,5.44l-1.07,2.01-1.15,2.27c-.53,1.04-.8,2.11-1.46,3.09l-.63,1.48-15.22-.03Z"
      />
      <path
        fill={color}
        d="M174.06,202.15l-13.26.03c-.29-1.16.4-2,.83-2.94,1.05-2.31,2.87-3.9,5.37-4.36,2.31-.42,3.12-3.43,3.71-5.87.73-3.05,1.1-6.17.27-9.22-1.02-3.72-2.06-4.7-5.07-7.17-1.93-1.59-3.56-3.3-5.35-5.06-3.41-3.34-5.58-7.41-7.42-11.77l-.95-2.71c-.28-.8-.82-1.52-.64-2.49l2.25,2.96c3.38,4.45,7.62,8.03,12.24,11.25l8.61,5.44c1.76,1.11,3.94,1.61,5.38,3.25,1.14,1.3,1.5,3.64,1.46,5.34-.04,1.46-.59,2.74-.89,4.07l-1.28,5.5-.86,4.52c-.14.76-.09,1.2-.41,1.88l-1.14,2.46c-.8,1.72-1.28,3.43-2.82,4.89Z"
      />
    </g>
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const LibraryIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M6 6h10" />
    <path d="M6 10h10" />
  </svg>
);

export const ArchiveIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export const StarIcon: React.FC<IconProps & { filled?: boolean }> = ({ size = 20, filled, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#F59A22' : 'none'} stroke={filled ? '#F59A22' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const AboutIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export const LightningIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export const LinkIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const CloudUploadIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const MinimizeIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

export const MaximizeIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

export const ExpandIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m15 3 6 6m0-6h-6m6 0v6" />
    <path d="m9 21-6-6m0 6h6m-6 0v-6" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export const ExportIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

export const ImportIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const GlobeIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const CpuIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M15 2v2" />
    <path d="M15 20v2" />
    <path d="M2 15h2" />
    <path d="M2 9h2" />
    <path d="M20 15h2" />
    <path d="M20 9h2" />
    <path d="M9 2v2" />
    <path d="M9 20v2" />
  </svg>
);

export const BookmarkIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const LayersIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);



