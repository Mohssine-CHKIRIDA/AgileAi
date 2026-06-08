import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
      className={className}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      
      {/* Head profile silhouette outline facing left */}
      <path
        d="M 58,82
           C 54,82 50,81 48,77
           C 46,73 47,68 44,67
           C 39,66 34,60 34,54
           C 34,50 36,48 34,46
           C 32,44 28,42 28,38
           C 28,34 32,33 34,29
           C 36,25 33,23 35,19
           C 37,15 41,13 45,12
           C 52,9 61,9 70,12
           C 85,17 89,29 89,45
           C 89,61 82,75 66,80
           C 63,81 61,82 58,82 Z"
        stroke="url(#logo-gradient)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Chat Speech Bubble inside the head */}
      <path
        d="M 46,32
           H 68
           C 72,32 75,35 75,39
           V 49
           C 75,53 72,56 68,56
           H 60
           L 53,62
           V 56
           H 46
           C 42,56 39,53 39,49
           V 39
           C 39,35 42,32 46,32 Z"
        stroke="url(#logo-gradient)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* 3 dots inside the chat bubble */}
      <circle cx="49" cy="44" r="2.5" fill="url(#logo-gradient)" />
      <circle cx="57" cy="44" r="2.5" fill="url(#logo-gradient)" />
      <circle cx="65" cy="44" r="2.5" fill="url(#logo-gradient)" />
    </svg>
  );
};
