import React from 'react';

export const PostCardSkeleton: React.FC = () => {
  return (
    <div className="bg-surface rounded-xl p-5 shadow-sm border border-border mb-4 animate-pulse">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-200 rounded w-1/4" />
          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
        </div>
      </div>

      {/* Title and Excerpt */}
      <div className="space-y-2.5 mb-4">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
      </div>

      {/* Image skeleton */}
      <div className="h-44 bg-slate-100 rounded-xl mb-4" />

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-16 bg-slate-200 rounded-md" />
        <div className="h-6 w-20 bg-slate-200 rounded-md" />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-3 border-t border-border">
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-slate-200 rounded-lg" />
          <div className="h-7 w-20 bg-slate-200 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-8 bg-slate-200 rounded-lg" />
          <div className="h-7 w-8 bg-slate-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const PostDetailSkeleton: React.FC = () => {
  return (
    <div className="bg-surface rounded-2xl p-6 sm:p-8 shadow-sm border border-border animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-28" />
        </div>
      </div>

      <div className="h-8 bg-slate-200 rounded w-4/5" />

      <div className="h-64 bg-slate-100 rounded-xl" />

      <div className="space-y-3">
        <div className="h-4 bg-slate-100 rounded w-full" />
        <div className="h-4 bg-slate-100 rounded w-full" />
        <div className="h-4 bg-slate-100 rounded w-3/4" />
      </div>
    </div>
  );
};
