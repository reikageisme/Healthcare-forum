import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, PostType } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    // If it's already a relative string like "2 giờ trước", return as is
    return String(dateInput);
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'vừa xong';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ngày trước`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} năm trước`;
}

export function formatDate(dateInput: string | Date | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getAvatarUrl(user?: User | null, defaultName = 'User'): string {
  if (!user) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=3B82F6&color=fff`;
  }
  if (user.avatar_url) return user.avatar_url;
  if (user.avatar) return user.avatar;
  
  const name = user.full_name || user.fullName || user.username || defaultName;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`;
}

export function getPostTypeInfo(type?: PostType | string): { label: string; color: string; bgBadge: string } {
  const norm = (type || 'article').toLowerCase();
  switch (norm) {
    case 'question':
      return {
        label: 'Hỏi đáp',
        color: 'text-primary',
        bgBadge: 'bg-primary/10 text-primary border-primary/20',
      };
    case 'share':
      return {
        label: 'Chia sẻ',
        color: 'text-emerald-600',
        bgBadge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      };
    case 'review':
      return {
        label: 'Đánh giá',
        color: 'text-amber-600',
        bgBadge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      };
    case 'article':
    default:
      return {
        label: 'Bài viết',
        color: 'text-blue-600',
        bgBadge: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      };
  }
}
