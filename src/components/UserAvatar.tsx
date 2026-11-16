import React, { useState, useEffect } from 'react';
import { formatImageUrl } from '../utils/imageUrl';

interface UserAvatarProps {
  src?: string | null;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
  xl: 'w-24 h-24 text-2xl'
};

export default function UserAvatar({
  src,
  username = 'scholar',
  size = 'sm',
  className = ''
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const cleanSrc = src && src.trim() ? formatImageUrl(src.trim()) : '';
  const initial = (username.trim().charAt(0) || 'S').toUpperCase();
  const sizeClass = SIZE_CLASSES[size];

  if (!cleanSrc || imgError) {
    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center font-bold shrink-0 select-none ${className}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={`${username}'s profile photo`}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 ${className}`}
    />
  );
}
