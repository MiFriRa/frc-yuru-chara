import React from 'react';
import type { MascotDomain } from '../types/mascot';
import { DOMAIN_META, formatTraitLabel } from '../utils/theme';

interface TraitIconProps {
  trait: string;
  size?: number;
  className?: string;
  decorative?: boolean;
}

const INK = '#172038';

function renderTraitGlyph(trait: string): React.ReactNode {
  switch (trait.toLowerCase()) {
    case 'bear':
      return (
        <>
          <circle cx="15" cy="16" r="7" fill="#6B4423" stroke={INK} strokeWidth="2.4" />
          <circle cx="49" cy="16" r="7" fill="#6B4423" stroke={INK} strokeWidth="2.4" />
          <circle cx="15" cy="16" r="3.4" fill="#E8B896" />
          <circle cx="49" cy="16" r="3.4" fill="#E8B896" />
          <ellipse cx="32" cy="35" rx="20" ry="18" fill="#7C4F2B" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="32" cy="40" rx="9" ry="7" fill="#F6DFC6" stroke={INK} strokeWidth="2" />
          <ellipse cx="32" cy="37" rx="3.4" ry="2.4" fill={INK} />
          <path d="M29 42 Q32 45 35 42" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx="23.5" cy="31" r="2.7" fill={INK} />
          <circle cx="40.5" cy="31" r="2.7" fill={INK} />
          <circle cx="22.8" cy="30.2" r="0.9" fill="#FFFFFF" />
          <circle cx="39.8" cy="30.2" r="0.9" fill="#FFFFFF" />
          <circle cx="18.5" cy="37" r="3.2" fill="#E3350D" opacity="0.82" />
          <circle cx="45.5" cy="37" r="3.2" fill="#E3350D" opacity="0.82" />
        </>
      );
    case 'cat':
      return (
        <>
          <path d="M14 30 L12 11 L26 20 Z" fill="#FFF7ED" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M50 30 L52 11 L38 20 Z" fill="#FFF7ED" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M16 24 L15.5 15 L23 20 Z" fill="#FDA4AF" />
          <path d="M48 24 L48.5 15 L41 20 Z" fill="#FDA4AF" />
          <ellipse cx="32" cy="36" rx="20" ry="17" fill="#FFFDF7" stroke={INK} strokeWidth="2.5" />
          <circle cx="24" cy="33" r="2.6" fill={INK} />
          <circle cx="40" cy="33" r="2.6" fill={INK} />
          <path d="M29.5 37 L34.5 37 L32 40 Z" fill="#F43F5E" />
          <path d="M27 42 Q30 44.5 32 41 Q34 44.5 37 42" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M8 35 L17 36 M9 40 L17 39 M56 35 L47 36 M55 40 L47 39" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="51" r="4" fill="#FFCB05" stroke={INK} strokeWidth="2" />
        </>
      );
    case 'dog':
      return (
        <>
          <path d="M13 24 C6 28 7 42 14 43 C18 43 19 36 18 28 Z" fill="#D97706" stroke={INK} strokeWidth="2.4" />
          <path d="M51 24 C58 28 57 42 50 43 C46 43 45 36 46 28 Z" fill="#D97706" stroke={INK} strokeWidth="2.4" />
          <ellipse cx="32" cy="34" rx="18.5" ry="18" fill="#F59E0B" stroke={INK} strokeWidth="2.5" />
          <path d="M18 39 C20 31 27 30 32 32 C37 30 44 31 46 39 C46 48 39 51 32 51 C25 51 18 48 18 39 Z" fill="#FFFBEB" />
          <circle cx="24" cy="29" r="2.6" fill={INK} />
          <circle cx="40" cy="29" r="2.6" fill={INK} />
          <ellipse cx="32" cy="36" rx="4" ry="2.8" fill={INK} />
          <path d="M32 39 V43 M28 43 Q32 46.5 36 43" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="32" cy="46.5" rx="3" ry="2.2" fill="#FB7185" />
        </>
      );
    case 'bird':
      return (
        <>
          <path d="M27 14 Q32 6 37 14" fill="#FFCB05" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="32" cy="35" r="18" fill="#FFE047" stroke={INK} strokeWidth="2.5" />
          <path d="M12 34 C9 39 11 45 17 44 C15 39 15 36 12 34 Z" fill="#F59E0B" stroke={INK} strokeWidth="2.2" />
          <path d="M52 34 C55 39 53 45 47 44 C49 39 49 36 52 34 Z" fill="#F59E0B" stroke={INK} strokeWidth="2.2" />
          <circle cx="24.5" cy="31" r="2.7" fill={INK} />
          <circle cx="39.5" cy="31" r="2.7" fill={INK} />
          <path d="M27 36 L37 36 L32 43 Z" fill="#F97316" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="20" cy="37" r="2.8" fill="#FB7185" opacity="0.7" />
          <circle cx="44" cy="37" r="2.8" fill="#FB7185" opacity="0.7" />
        </>
      );
    case 'rabbit':
      return (
        <>
          <ellipse cx="23" cy="18" rx="5.5" ry="13" transform="rotate(-10 23 18)" fill="#FFFFFF" stroke={INK} strokeWidth="2.4" />
          <ellipse cx="41" cy="18" rx="5.5" ry="13" transform="rotate(10 41 18)" fill="#FFFFFF" stroke={INK} strokeWidth="2.4" />
          <ellipse cx="23.5" cy="19" rx="2.5" ry="8" transform="rotate(-10 23.5 19)" fill="#F9A8D4" />
          <ellipse cx="40.5" cy="19" rx="2.5" ry="8" transform="rotate(10 40.5 19)" fill="#F9A8D4" />
          <ellipse cx="32" cy="39" rx="18" ry="15" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <circle cx="25" cy="37" r="2.6" fill="#E11D48" />
          <circle cx="39" cy="37" r="2.6" fill="#E11D48" />
          <ellipse cx="32" cy="41.5" rx="2.6" ry="1.8" fill="#F472B6" />
          <path d="M29 45 Q32 47.5 35 45" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'raccoon':
      return (
        <>
          <circle cx="16" cy="17" r="6" fill="#926239" stroke={INK} strokeWidth="2.3" />
          <circle cx="48" cy="17" r="6" fill="#926239" stroke={INK} strokeWidth="2.3" />
          <ellipse cx="32" cy="36" rx="20" ry="17" fill="#C49A6C" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="23" cy="34" rx="7.5" ry="5.5" fill="#4A3525" />
          <ellipse cx="41" cy="34" rx="7.5" ry="5.5" fill="#4A3525" />
          <circle cx="23.5" cy="34" r="2.3" fill="#FFFFFF" />
          <circle cx="40.5" cy="34" r="2.3" fill="#FFFFFF" />
          <circle cx="23.5" cy="34" r="1.2" fill={INK} />
          <circle cx="40.5" cy="34" r="1.2" fill={INK} />
          <ellipse cx="32" cy="42" rx="7" ry="5.2" fill="#F5E6D3" />
          <ellipse cx="32" cy="40" rx="3" ry="2.2" fill={INK} />
          <path d="M29 14 Q36 8 41 13 Q36 20 29 14 Z" fill="#22C55E" stroke={INK} strokeWidth="2" />
        </>
      );
    case 'fox':
      return (
        <>
          <path d="M12 29 L14 9 L28 21 Z" fill="#F97316" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M52 29 L50 9 L36 21 Z" fill="#F97316" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M15 22 L16.5 13 L23 19 Z" fill="#172038" />
          <path d="M49 22 L47.5 13 L41 19 Z" fill="#172038" />
          <path d="M12 34 C12 22 22 19 32 19 C42 19 52 22 52 34 C52 44 40 53 32 53 C24 53 12 44 12 34 Z" fill="#F97316" stroke={INK} strokeWidth="2.5" />
          <path d="M13 36 C19 36 24 41 32 52 C40 41 45 36 51 36 C49 46 39 53 32 53 C25 53 15 46 13 36 Z" fill="#FFF7ED" />
          <path d="M21 33 Q24 30 27 33" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M37 33 Q40 30 43 33" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="44" r="3" fill={INK} />
        </>
      );
    case 'deer':
      return (
        <>
          <path d="M22 22 L17 9 M19 14 L12 13 M42 22 L47 9 M45 14 L52 13" stroke="#92400E" strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="32" cy="37" rx="17" ry="16" fill="#D98A4E" stroke={INK} strokeWidth="2.5" />
          <circle cx="24" cy="27" r="2" fill="#FEF3C7" />
          <circle cx="40" cy="27" r="2" fill="#FEF3C7" />
          <circle cx="32" cy="25" r="2" fill="#FEF3C7" />
          <circle cx="24.5" cy="36" r="2.6" fill={INK} />
          <circle cx="39.5" cy="36" r="2.6" fill={INK} />
          <ellipse cx="32" cy="45" rx="6.5" ry="5" fill="#FEF3C7" />
          <ellipse cx="32" cy="43" rx="3" ry="2.2" fill={INK} />
        </>
      );
    case 'cow':
      return (
        <>
          <path d="M17 18 Q12 11 19 11" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M47 18 Q52 11 45 11" fill="none" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="13" y="18" width="38" height="34" rx="15" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M16 21 C24 20 26 29 19 32 C15 33 14 26 16 21 Z" fill="#1E293B" />
          <circle cx="24" cy="30" r="2.6" fill={INK} />
          <circle cx="40" cy="30" r="2.6" fill={INK} />
          <rect x="17" y="36" width="30" height="15" rx="7.5" fill="#FBCFE8" stroke={INK} strokeWidth="2.2" />
          <circle cx="26" cy="43" r="2.1" fill={INK} />
          <circle cx="38" cy="43" r="2.1" fill={INK} />
        </>
      );
    case 'horse':
      return (
        <>
          <path d="M26 11 L32 20 L38 11 L35 22 L29 22 Z" fill="#78350F" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M17 26 L16 14 L25 21 Z" fill="#B45309" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M47 26 L48 14 L39 21 Z" fill="#B45309" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M18 26 C18 19 46 19 46 26 L44 46 C44 52 20 52 20 46 Z" fill="#C26D2D" stroke={INK} strokeWidth="2.5" />
          <path d="M29 22 L35 22 L33 35 L31 35 Z" fill="#FFFBEB" />
          <circle cx="24" cy="31" r="2.5" fill={INK} />
          <circle cx="40" cy="31" r="2.5" fill={INK} />
          <rect x="21" y="39" width="22" height="12" rx="6" fill="#F5D0A9" stroke={INK} strokeWidth="2" />
          <circle cx="27" cy="45" r="1.8" fill={INK} />
          <circle cx="37" cy="45" r="1.8" fill={INK} />
        </>
      );
    case 'fish':
      return (
        <>
          <path d="M44 32 L57 20 L54 32 L57 44 Z" fill="#38BDF8" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <ellipse cx="29" cy="32" rx="20" ry="14" fill="#246BCE" stroke={INK} strokeWidth="2.5" />
          <path d="M24 22 Q30 32 24 42" fill="none" stroke="#BAE6FD" strokeWidth="2.2" />
          <path d="M32 22 Q38 32 32 42" fill="none" stroke="#BAE6FD" strokeWidth="2.2" />
          <circle cx="18" cy="29" r="3.2" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
          <circle cx="17.5" cy="29" r="1.5" fill={INK} />
          <path d="M10 34 Q14 36 17 34" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'frog':
      return (
        <>
          <circle cx="21" cy="21" r="8" fill="#22C55E" stroke={INK} strokeWidth="2.4" />
          <circle cx="43" cy="21" r="8" fill="#22C55E" stroke={INK} strokeWidth="2.4" />
          <circle cx="21" cy="21" r="4.5" fill="#FFFFFF" />
          <circle cx="43" cy="21" r="4.5" fill="#FFFFFF" />
          <circle cx="21.5" cy="21" r="2.2" fill={INK} />
          <circle cx="42.5" cy="21" r="2.2" fill={INK} />
          <ellipse cx="32" cy="39" rx="21" ry="14" fill="#22C55E" stroke={INK} strokeWidth="2.5" />
          <path d="M19 39 Q32 48 45 39" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="18" cy="37" r="3" fill="#FDA4AF" />
          <circle cx="46" cy="37" r="3" fill="#FDA4AF" />
        </>
      );
    case 'turtle':
      return (
        <>
          <circle cx="14" cy="34" r="7.5" fill="#4ADE80" stroke={INK} strokeWidth="2.4" />
          <circle cx="12.5" cy="32.5" r="1.8" fill={INK} />
          <path d="M19 42 C19 24 53 24 53 42 Z" fill="#15803D" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M27 32 L36 28 L45 32 L45 40 L27 40 Z" fill="#86EFAC" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <rect x="21" y="42" width="8" height="7" rx="3" fill="#4ADE80" stroke={INK} strokeWidth="2.2" />
          <rect x="43" y="42" width="8" height="7" rx="3" fill="#4ADE80" stroke={INK} strokeWidth="2.2" />
        </>
      );
    case 'dragon':
      return (
        <>
          <path d="M18 20 L13 9 L24 16 Z" fill="#FFCB05" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M46 20 L51 9 L40 16 Z" fill="#FFCB05" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M14 34 C14 21 50 21 50 34 C50 46 40 52 32 52 C24 52 14 46 14 34 Z" fill="#10B981" stroke={INK} strokeWidth="2.5" />
          <path d="M12 43 Q6 40 8 34 M52 43 Q58 40 56 34" fill="none" stroke="#FFCB05" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="32" r="3" fill="#FEF08A" stroke={INK} strokeWidth="1.8" />
          <circle cx="40" cy="32" r="3" fill="#FEF08A" stroke={INK} strokeWidth="1.8" />
          <circle cx="24" cy="32" r="1.2" fill={INK} />
          <circle cx="40" cy="32" r="1.2" fill={INK} />
          <path d="M25 43 L28 40 L32 44 L36 40 L39 43" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'kappa':
      return (
        <>
          <circle cx="32" cy="36" r="18" fill="#22C55E" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="32" cy="20" rx="11" ry="4.5" fill="#93C5FD" stroke={INK} strokeWidth="2.2" />
          <path d="M16 25 Q22 21 26 25 M38 25 Q42 21 48 25" fill="none" stroke="#14532D" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24.5" cy="34" r="2.7" fill={INK} />
          <circle cx="39.5" cy="34" r="2.7" fill={INK} />
          <path d="M25 41 L32 37 L39 41 L32 47 Z" fill="#FACC15" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        </>
      );
    case 'samurai':
      return (
        <>
          <path d="M16 21 C24 10 40 10 48 21 C41 16 23 16 16 21 Z" fill="#FFCB05" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
          <path d="M14 38 C14 23 50 23 50 38 L55 48 L45 48 L43 40 L21 40 L19 48 L9 48 Z" fill="#E3350D" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="32" cy="37" r="10" fill="#FFE4C4" stroke={INK} strokeWidth="2.2" />
          <path d="M26 36 H30 M34 36 H38" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M29 42 Q32 44 35 42" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'ninja':
      return (
        <>
          <circle cx="32" cy="34" r="19" fill="#1E293B" stroke={INK} strokeWidth="2.5" />
          <rect x="17" y="27" width="30" height="12" rx="6" fill="#FFE4C4" stroke={INK} strokeWidth="2.2" />
          <path d="M22 33 L28 34 M42 33 L36 34" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M14 23 H50" stroke="#E3350D" strokeWidth="4" />
          <path d="M32 16 L34.5 20.5 L39 23 L34.5 25.5 L32 30 L29.5 25.5 L25 23 L29.5 20.5 Z" fill="#E2E8F0" stroke={INK} strokeWidth="1.7" />
        </>
      );
    case 'oni':
      return (
        <>
          <path d="M23 19 L20 8 L28 16 Z" fill="#FFCB05" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M41 19 L44 8 L36 16 Z" fill="#FFCB05" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="32" cy="36" r="18" fill="#EF4444" stroke={INK} strokeWidth="2.5" />
          <path d="M21 29 L28 32 M43 29 L36 32" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24.5" cy="35" r="2.6" fill="#FEF08A" stroke={INK} strokeWidth="1.6" />
          <circle cx="39.5" cy="35" r="2.6" fill="#FEF08A" stroke={INK} strokeWidth="1.6" />
          <path d="M23 44 Q32 48 41 44" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M26 45 L28 41 L30 45 M34 45 L36 41 L38 45" fill="#FFFFFF" stroke={INK} strokeWidth="1.4" />
        </>
      );
    case 'fairy':
      return (
        <>
          <ellipse cx="16" cy="30" rx="10" ry="7" transform="rotate(-24 16 30)" fill="#DDD6FE" stroke={INK} strokeWidth="2.2" />
          <ellipse cx="48" cy="30" rx="10" ry="7" transform="rotate(24 48 30)" fill="#DDD6FE" stroke={INK} strokeWidth="2.2" />
          <ellipse cx="18" cy="41" rx="7" ry="5" transform="rotate(18 18 41)" fill="#C4B5FD" stroke={INK} strokeWidth="2" />
          <ellipse cx="46" cy="41" rx="7" ry="5" transform="rotate(-18 46 41)" fill="#C4B5FD" stroke={INK} strokeWidth="2" />
          <circle cx="32" cy="34" r="12" fill="#FEF08A" stroke={INK} strokeWidth="2.4" />
          <circle cx="28" cy="33" r="2" fill={INK} />
          <circle cx="36" cy="33" r="2" fill={INK} />
          <path d="M29 38 Q32 41 35 38" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M32 10 L34 15 L39 17 L34 19 L32 24 L30 19 L25 17 L30 15 Z" fill="#F472B6" stroke={INK} strokeWidth="1.6" />
        </>
      );
    case 'citrus':
      return (
        <>
          <path d="M32 16 C36 9 45 9 47 14 C42 19 36 20 32 16 Z" fill="#22C55E" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="32" cy="36" r="18" fill="#FACC15" stroke={INK} strokeWidth="2.5" />
          <path d="M22 25 Q26 21 31 23" fill="none" stroke="#FEF9C3" strokeWidth="3" strokeLinecap="round" />
          <circle cx="25" cy="35" r="2.4" fill={INK} />
          <circle cx="39" cy="35" r="2.4" fill={INK} />
          <path d="M28 41 Q32 44.5 36 41" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="20" cy="40" r="2.5" fill="#F97316" opacity="0.6" />
          <circle cx="44" cy="40" r="2.5" fill="#F97316" opacity="0.6" />
        </>
      );
    case 'apple':
      return (
        <>
          <path d="M32 18 L34 10" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
          <path d="M34 14 C40 9 47 11 47 16 C42 19 37 18 34 14 Z" fill="#22C55E" stroke={INK} strokeWidth="2.1" />
          <path d="M32 21 C23 16 13 23 14 36 C15 47 23 54 32 51 C41 54 49 47 50 36 C51 23 41 16 32 21 Z" fill="#E3350D" stroke={INK} strokeWidth="2.5" />
          <path d="M20 27 Q23 23 26 25" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" opacity="0.8" />
          <circle cx="25.5" cy="36" r="2.4" fill={INK} />
          <circle cx="38.5" cy="36" r="2.4" fill={INK} />
          <path d="M29 41 Q32 44 35 41" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'peach':
      return (
        <>
          <path d="M32 18 C25 11 17 12 16 17 C21 20 27 20 32 18 Z" fill="#22C55E" stroke={INK} strokeWidth="2.1" />
          <path d="M32 18 C39 11 47 12 48 17 C43 20 37 20 32 18 Z" fill="#22C55E" stroke={INK} strokeWidth="2.1" />
          <path d="M32 18 C46 18 52 33 46 44 C41 51 35 53 32 55 C29 53 23 51 18 44 C12 33 18 18 32 18 Z" fill="#FDA4AF" stroke={INK} strokeWidth="2.5" />
          <path d="M32 19 C35 28 35 38 32 52" fill="none" stroke="#F43F5E" strokeWidth="2" opacity="0.6" />
          <circle cx="25" cy="36" r="2.3" fill={INK} />
          <circle cx="39" cy="36" r="2.3" fill={INK} />
        </>
      );
    case 'melon':
      return (
        <>
          <path d="M26 11 H38 M32 11 V19" stroke="#15803D" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="32" cy="37" r="18" fill="#86EFAC" stroke={INK} strokeWidth="2.5" />
          <path d="M20 24 L44 48 M44 24 L20 48 M15 37 H49" stroke="#22C55E" strokeWidth="1.8" opacity="0.7" />
          <circle cx="25.5" cy="36" r="2.4" fill={INK} />
          <circle cx="38.5" cy="36" r="2.4" fill={INK} />
          <path d="M29 42 Q32 45 35 42" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'rice':
      return (
        <>
          <path d="M32 12 C42 12 52 36 50 46 C49 52 15 52 14 46 C12 36 22 12 32 12 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <rect x="23" y="38" width="18" height="13" rx="2.5" fill="#1E293B" stroke={INK} strokeWidth="2" />
          <circle cx="25" cy="31" r="2.4" fill={INK} />
          <circle cx="39" cy="31" r="2.4" fill={INK} />
          <circle cx="20.5" cy="34" r="2.4" fill="#FDA4AF" />
          <circle cx="43.5" cy="34" r="2.4" fill="#FDA4AF" />
        </>
      );
    case 'noodle':
      return (
        <>
          <path d="M22 15 Q20 11 23 8 M32 14 Q30 10 33 7 M42 15 Q40 11 43 8" fill="none" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M12 24 L52 21 M14 29 L52 27" stroke="#92400E" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M12 32 H52 C51 45 43 52 32 52 C21 52 13 45 12 32 Z" fill="#E3350D" stroke={INK} strokeWidth="2.5" />
          <rect x="24" y="51" width="16" height="4.5" rx="2" fill="#B91C1C" stroke={INK} strokeWidth="2" />
          <circle cx="32" cy="31" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
          <path d="M30 31 A2.5 2.5 0 1 1 34.5 32.5" fill="none" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'flower':
      return (
        <>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse
              key={angle}
              cx="32"
              cy="18"
              rx="8.5"
              ry="12"
              transform={`rotate(${angle} 32 32)`}
              fill="#FBCFE8"
              stroke={INK}
              strokeWidth="2.3"
            />
          ))}
          <circle cx="32" cy="32" r="7.5" fill="#FFCB05" stroke={INK} strokeWidth="2.2" />
        </>
      );
    case 'tree':
      return (
        <>
          <rect x="27" y="40" width="10" height="14" rx="2" fill="#92400E" stroke={INK} strokeWidth="2.4" />
          <circle cx="32" cy="24" r="12" fill="#16A34A" stroke={INK} strokeWidth="2.4" />
          <circle cx="21" cy="33" r="10" fill="#22C55E" stroke={INK} strokeWidth="2.4" />
          <circle cx="43" cy="33" r="10" fill="#22C55E" stroke={INK} strokeWidth="2.4" />
          <circle cx="32" cy="33" r="10" fill="#22C55E" />
        </>
      );
    case 'mountain':
      return (
        <>
          <circle cx="46" cy="18" r="7" fill="#E3350D" stroke={INK} strokeWidth="2" />
          <path d="M8 50 L26 20 L38 20 L56 50 Z" fill="#246BCE" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 20 L38 20 L43 29 L37 27 L32 31 L27 27 L21 29 Z" fill="#FFFFFF" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case 'water':
      return (
        <>
          <path d="M32 10 C42 24 49 32 49 41 C49 50 41 55 32 55 C23 55 15 50 15 41 C15 32 22 24 32 10 Z" fill="#38BDF8" stroke={INK} strokeWidth="2.5" />
          <path d="M23 41 C23 47 28 49 33 49" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <circle cx="26" cy="35" r="2.2" fill={INK} />
          <circle cx="38" cy="35" r="2.2" fill={INK} />
        </>
      );
    case 'castle':
      return (
        <>
          <path d="M16 52 L20 38 H44 L48 52 Z" fill="#CBD5E1" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M12 38 L20 30 H44 L52 38 Z" fill="#1E293B" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
          <rect x="23" y="22" width="18" height="9" fill="#FFFFFF" stroke={INK} strokeWidth="2.2" />
          <path d="M17 23 L26 14 H38 L47 23 Z" fill="#1E293B" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
          <circle cx="24" cy="12" r="2.2" fill="#FFCB05" />
          <circle cx="40" cy="12" r="2.2" fill="#FFCB05" />
        </>
      );
    case 'star':
      return (
        <>
          <path
            d="M32 9 L38.5 23 L54 25 L42.5 35.5 L45.5 51 L32 43.5 L18.5 51 L21.5 35.5 L10 25 L25.5 23 Z"
            fill="#FFCB05"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="27" cy="31" r="2.3" fill={INK} />
          <circle cx="37" cy="31" r="2.3" fill={INK} />
          <path d="M29.5 36.5 Q32 39 34.5 36.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'ceramic':
      return (
        <>
          <path d="M14 23 H50 C50 40 43 49 32 49 C21 49 14 40 14 23 Z" fill="#E0F2FE" stroke={INK} strokeWidth="2.5" />
          <rect x="24" y="49" width="16" height="5" rx="2" fill="#94A3B8" stroke={INK} strokeWidth="2.2" />
          <path d="M16 33 Q24 28 32 33 T48 33" fill="none" stroke="#246BCE" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="41" r="2.5" fill="#E3350D" />
        </>
      );
    default:
      // Playful Poké-spark fallback emblem
      return (
        <>
          <circle cx="32" cy="32" r="19" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M13 32 A19 19 0 0 1 51 32 Z" fill="#E3350D" stroke={INK} strokeWidth="2.5" />
          <line x1="13" y1="32" x2="51" y2="32" stroke={INK} strokeWidth="3" />
          <circle cx="32" cy="32" r="6.5" fill="#FFCB05" stroke={INK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="2.5" fill="#FFFFFF" />
        </>
      );
  }
}

export const TraitIcon: React.FC<TraitIconProps> = ({
  trait,
  size = 36,
  className = '',
  decorative = false,
}) => {
  const label = `${formatTraitLabel(trait)} trait icon`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
    >
      {renderTraitGlyph(trait)}
    </svg>
  );
};

interface DomainOrbIconProps {
  domain: MascotDomain;
  size?: number;
  className?: string;
}

export const DomainOrbIcon: React.FC<DomainOrbIconProps> = ({
  domain,
  size = 24,
  className = '',
}) => {
  const meta = DOMAIN_META[domain];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={`${meta.label} domain`}
    >
      <circle cx="16" cy="16" r="13.5" fill={meta.color} stroke={INK} strokeWidth="2.2" />
      <circle cx="12" cy="11" r="4.2" fill="#FFFFFF" opacity="0.28" />
      {domain === 'Fauna' && (
        <g fill="#FFFFFF">
          <circle cx="11.5" cy="13" r="2.1" />
          <circle cx="16" cy="10.8" r="2.1" />
          <circle cx="20.5" cy="13" r="2.1" />
          <ellipse cx="16" cy="18.8" rx="4.5" ry="3.5" />
        </g>
      )}
      {domain === 'Flora_Food' && (
        <path
          d="M16 9 C21 11 23 17 19 22 C16 23 12 22 10 18 C9 14 12 10 16 9 Z M16 11 L15.5 23"
          fill="#FFFFFF"
          stroke={meta.color}
          strokeWidth="1.2"
        />
      )}
      {domain === 'Lore_History' && (
        <path
          d="M9 12 H23 M11 16 H21 M13 12 V23 M19 12 V23"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      )}
      {domain === 'Geo_Nature' && (
        <path d="M8 21 L14 11 L18 11 L24 21 Z" fill="#FFFFFF" strokeLinejoin="round" />
      )}
      {domain === 'Object_Abstract' && (
        <path
          d="M16 8.5 L18.3 13.7 L23.8 16 L18.3 18.3 L16 23.5 L13.7 18.3 L8.2 16 L13.7 13.7 Z"
          fill="#FFFFFF"
        />
      )}
    </svg>
  );
};
