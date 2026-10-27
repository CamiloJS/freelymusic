import React from 'react';

interface DownloadedIconProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Spotify-style downloaded indicator: a solid green circle with a dark
 * downward arrow and underline bar. Replaces the checkmark used previously.
 */
export const DownloadedIcon: React.FC<DownloadedIconProps> = ({
  size = 14,
  className = '',
  title = 'Descargado',
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
    <circle cx="12" cy="12" r="12" fill="#1ed760" />
    <path
      d="M12 5.5v8M8.5 10l3.5 3.5 3.5-3.5M8 17h8"
      fill="none"
      stroke="#000000"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default DownloadedIcon;

