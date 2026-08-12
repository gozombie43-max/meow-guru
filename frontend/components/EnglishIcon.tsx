import React from 'react';

export interface EnglishIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export default function EnglishIcon({ size = 24, ...props }: EnglishIconProps) {
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
        <g transform="scale(5.12,5.12)">
          <path d="M6,4v35h1c9.73438,0 17.55078,3.89453 17.55078,3.89453l0.44922,0.22266l0.44922,-0.22266c0,0 7.81641,-3.89453 17.55078,-3.89453h1v-35h-1c-9.83984,0 -17.35937,3.62109 -18,3.9375c-0.64062,-0.31641 -8.16016,-3.9375 -18,-3.9375zM8,6.08984c8.24609,0.23438 14.65234,2.95703 16,3.56641v30.84766c-2.12891,-0.91797 -8.11328,-3.20312 -16,-3.41406zM42,6.08984v31c-7.88672,0.21094 -13.87109,2.49609 -16,3.41406v-30.84766c1.34766,-0.60937 7.75391,-3.33203 16,-3.56641zM2,9v34h1c12.79297,0 21.59375,3.91406 21.59375,3.91406l0.40625,0.17969l0.40625,-0.17969c0,0 8.80078,-3.91406 21.59375,-3.91406h1v-34h-2v32.07031c-12.19922,0.20703 -20.44141,3.64063 -21,3.88281c-0.55859,-0.24219 -8.80078,-3.67578 -21,-3.88281v-32.07031z"></path>
        </g>
      </g>
    </svg>
  );
}
