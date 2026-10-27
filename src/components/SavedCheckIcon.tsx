import React from 'react';

interface SavedCheckIconProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Spotify official saved checkmark: a solid green circle (#1ed760)
 * with a clean black checkmark, indicating the track is saved in favorites / library.
 */
export const SavedCheckIcon: React.FC<SavedCheckIconProps> = ({
  size = 16,
  className = '',
  title = 'Guardada en tus me gusta',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-label={title}
    focusable="false"
  >
    <title>{title}</title>
    <circle cx="12" cy="12" r="12" fill="var(--brand-color, #1ed760)" />
    <path
      d="M7 12.5l3.5 3.5 6.5-7"
      fill="none"
      stroke="#000000"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default SavedCheckIcon;
