import React from 'react';

interface WolfIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  fillColor?: string;
}

const CAT_HEAD_PATH =
  'M15 7 L23 17 Q32 14.5 41 17 L49 7 C51.2 14 51.8 20.5 51.2 25 C53.5 29 53.5 35.5 50.5 40.5 C46.5 46 39.5 48 32 48 C24.5 48 17.5 46 13.5 40.5 C10.5 35.5 10.5 29 12.8 25 C12.2 20.5 12.8 14 15 7 Z M17.2 13 L16 21.5 L21.5 19 Z M46.8 13 L42.5 19 L48 21.5 Z M23.5 27.4 A2.6 3.6 0 1 0 23.5 34.6 A2.6 3.6 0 1 0 23.5 27.4 Z M40.5 27.4 A2.6 3.6 0 1 0 40.5 34.6 A2.6 3.6 0 1 0 40.5 27.4 Z M30.5 33.8 L33.5 33.8 L32 35.8 Z M27.6 37.5 Q29.8 39.8 32 37.4 Q34.2 39.8 36.4 37.5 L37.3 38.6 Q34.6 41.4 32 39.1 Q29.4 41.4 26.7 38.6 Z';

const CAT_PAWS_PATH =
  'M14.5 53.5 C14.5 50 16.8 48.5 19.5 48.5 C22.2 48.5 24.5 50 24.5 53.5 C24.5 55.8 22.8 57 19.5 57 C16.2 57 14.5 55.8 14.5 53.5 Z M17.4 53.2 L17.4 56.5 L18.7 56.5 L18.7 53.2 Z M20.3 53.2 L20.3 56.5 L21.6 56.5 L21.6 53.2 Z M39.5 53.5 C39.5 50 41.8 48.5 44.5 48.5 C47.2 48.5 49.5 50 49.5 53.5 C49.5 55.8 47.8 57 44.5 57 C41.2 57 39.5 55.8 39.5 53.5 Z M42.4 53.2 L42.4 56.5 L43.7 56.5 L43.7 53.2 Z M45.3 53.2 L45.3 56.5 L46.6 56.5 L46.6 53.2 Z';

export default function WolfIcon({
  size = 28,
  fillColor = 'currentColor',
  className,
  style,
  ...props
}: WolfIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      <g fill={fillColor}>
        <path fillRule="evenodd" d={CAT_HEAD_PATH} />
        <path fillRule="evenodd" d={CAT_PAWS_PATH} />
        <rect x="2" y="29" width="9.5" height="2.2" rx="1.1" transform="rotate(6 6.75 30.1)" />
        <rect x="2" y="34" width="9.5" height="2.2" rx="1.1" transform="rotate(-7 6.75 35.1)" />
        <rect x="52.5" y="29" width="9.5" height="2.2" rx="1.1" transform="rotate(-6 57.25 30.1)" />
        <rect x="52.5" y="34" width="9.5" height="2.2" rx="1.1" transform="rotate(7 57.25 35.1)" />
      </g>
    </svg>
  );
}
