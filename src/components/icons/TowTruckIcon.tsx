import * as React from 'react';

interface TowTruckIconProps extends React.SVGProps<SVGSVGElement> {}

export const TowTruckIcon = ({ className, ...props }: TowTruckIconProps) => (
  <svg
    viewBox="0 0 64 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path
      d="M4 20.5C4 16.1 7.57 12.5 11.98 12.5H18.8L21.4 7.8C21.94 6.82 22.97 6.2 24.09 6.2H33V20H58.5C59.88 20 61 21.12 61 22.5C61 23.05 60.55 23.5 60 23.5H51.8V26.2C51.8 27.19 51 28 50 28H47.9C47.3 25.14 44.76 23 41.73 23C38.7 23 36.16 25.14 35.56 28H17.44C16.84 25.14 14.3 23 11.27 23C8.24 23 5.7 25.14 5.1 28H4.8C4.36 28 4 27.64 4 27.2V20.5Z"
      fill="currentColor"
    />
    <path
      d="M22.75 9.3C22.97 8.9 23.39 8.65 23.85 8.65H30.2V15.8H19.2L22.75 9.3Z"
      fill="white"
      fillOpacity="0.9"
    />
    <path
      d="M33 6.2H35.8V20H33V6.2Z"
      fill="currentColor"
    />
    <path
      d="M36 18.4H57.8L62 17.5L57.8 16.6H36V18.4Z"
      fill="currentColor"
    />
    <rect x="22" y="20.8" width="13.4" height="2.8" rx="1.4" fill="white" fillOpacity="0.92" />
    <circle cx="11.25" cy="28" r="4.3" fill="currentColor" />
    <circle cx="11.25" cy="28" r="2.2" fill="white" />
    <circle cx="41.75" cy="28" r="4.3" fill="currentColor" />
    <circle cx="41.75" cy="28" r="2.2" fill="white" />
  </svg>
);
