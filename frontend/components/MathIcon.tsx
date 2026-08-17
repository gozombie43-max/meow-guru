import React from 'react';

export interface MathIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export default function MathIcon({ size = 24, ...props }: MathIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      xmlnsXlink="http://www.w3.org/1999/xlink" 
      viewBox="0 0 256 256" 
      width={size} 
      height={size} 
      fillRule="nonzero"
      {...props}
    >
      <g fill="#007aff" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10" strokeDasharray="" strokeDashoffset="0" style={{mixBlendMode: "normal"}}>
        <g transform="scale(4,4)">
          <path d="M40,46h10v2h-10z" />
          <path d="M27,30h-16c-1.654,0 -3,-1.346 -3,-3v-16c0,-1.654 1.346,-3 3,-3h16c1.654,0 3,1.346 3,3v16c0,1.654 -1.346,3 -3,3zM11,10c-0.552,0 -1,0.448 -1,1v16c0,0.552 0.448,1 1,1h16c0.552,0 1,-0.448 1,-1v-16c0,-0.552 -0.448,-1 -1,-1z" />
          <path d="M53,30h-16c-1.654,0 -3,-1.346 -3,-3v-16c0,-1.654 1.346,-3 3,-3h16c1.654,0 3,1.346 3,3v16c0,1.654 -1.346,3 -3,3zM37,10c-0.552,0 -1,0.448 -1,1v16c0,0.552 0.448,1 1,1h16c0.552,0 1,-0.448 1,-1v-16c0,-0.552 -0.448,-1 -1,-1z" />
          <path d="M40,18h10v2h-10z" />
          <path d="M24,18h-4v-4h-2v4h-4v2h4v4h2v-4h4z" />
          <path d="M27,56h-16c-1.654,0 -3,-1.346 -3,-3v-16c0,-1.654 1.346,-3 3,-3h16c1.654,0 3,1.346 3,3v16c0,1.654 -1.346,3 -3,3zM11,36c-0.552,0 -1,0.448 -1,1v16c0,0.552 0.448,1 1,1h16c0.552,0 1,-0.448 1,-1v-16c0,-0.552 -0.448,-1 -1,-1z" />
          <path d="M53,56h-16c-1.654,0 -3,-1.346 -3,-3v-16c0,-1.654 1.346,-3 3,-3h16c1.654,0 3,1.346 3,3v16c0,1.654 -1.346,3 -3,3zM37,36c-0.552,0 -1,0.448 -1,1v16c0,0.552 0.448,1 1,1h16c0.552,0 1,-0.448 1,-1v-16c0,-0.552 -0.448,-1 -1,-1z" />
          <path d="M23.242,42.172l-1.414,-1.414l-2.828,2.828l-2.828,-2.828l-1.414,1.414l2.828,2.828l-2.828,2.829l1.414,1.414l2.828,-2.828l2.828,2.828l1.414,-1.414l-2.828,-2.829z" />
          <path d="M40,42h10v2h-10z" />
        </g>
      </g>
    </svg>
  );
}
