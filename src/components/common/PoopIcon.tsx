import React from 'react';

interface PoopIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const PoopIcon: React.FC<PoopIconProps> = ({ className = 'w-4 h-4', size, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Swirl top */}
    <path d="M12 3c.8 1.2 1.8 1.8 1.8 3 0 1.2-1.2 1.8-1.8 1.8s-2-.6-1.5-2.2C10.8 4.2 11.5 3.5 12 3Z" />
    {/* Middle swirl */}
    <path d="M6.5 11.5c-1.4 0-2.5.9-2.5 2 0 1 .7 1.8 1.8 2 2 .3 4.2.5 6.2.5s4.2-.2 6.2-.5c1.1-.2 1.8-1 1.8-2 0-1.1-1.1-2-2.5-2-1.3 0-2.3-.7-5.5-.7s-4.2.7-5.5.7Z" />
    {/* Base tier */}
    <path d="M4 17.5c-1.1 0-2 .8-2 1.8C2 21 4.2 22 7.5 22h9c3.3 0 5.5-1 5.5-2.7 0-1-.9-1.8-2-1.8-1.5 0-3.5-.5-8-.5s-6.5.5-8 .5Z" />
  </svg>
);
