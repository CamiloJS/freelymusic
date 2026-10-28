import React from 'react';

interface SavedCheckIconProps {
  size?: number;
  className?: string;
  title?: string;
  filled?: boolean;
}

/**
 * Spotify heart favorite icon:
 * When filled=true: solid green heart (#1ed760 / var(--brand-color)).
 * When filled=false: outlined neutral heart with hover states.
 */
export const SavedCheckIcon: React.FC<SavedCheckIconProps> = ({
  size = 16,
  className = '',
  title = 'Guardada en tus me gusta',
  filled = true,
}) => {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="var(--brand-color, #1ed760)"
        stroke="var(--brand-color, #1ed760)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        role="img"
        aria-label={title}
        focusable="false"
      >
        <title>{title}</title>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
};

export default SavedCheckIcon;
