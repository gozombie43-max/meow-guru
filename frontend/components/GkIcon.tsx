import React from 'react';

export interface GkIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export default function GkIcon({ size = 24, ...props }: GkIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 256 256" 
      width={size} 
      height={size} 
      fill="none"
      {...props}
    >
      <g stroke="#007aff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="128" cy="128" r="92" />
        <line x1="36" y1="128" x2="220" y2="128" />
        <path d="M52 82c23 10 50 16 76 16s53-6 76-16" />
        <path d="M52 174c23-10 50-16 76-16s53 6 76 16" />
        <ellipse cx="128" cy="128" rx="46" ry="92" fill="none" />
        <line x1="128" y1="36" x2="128" y2="220" />
      </g>
    </svg>
  );
}
