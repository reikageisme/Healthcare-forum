// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminModerationPage from './AdminModerationPage';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import { Post } from '../../types';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getModerationPosts: vi.fn(),
    getModerationPost: vi.fn(),
    approvePost: vi.fn(),
    rejectPost: vi.fn(),
  },
}));

vi.mock('../../services/categoryService', () => ({
  categoryService: {
    getCategories: vi.fn(),
  },
}));

const summary = {
  id: 'post-1',
  title: 'Pending post',
  slug: 'pending-post',
  excerpt: 'Summary only',
  post_type: 'article',
  status: 'pending',
  rejection_reason: null,
  view_count: 0,
  helpful_count: 0,
  comment_count: 0,
  is_published: true,
  created_at: '2026-09-07T00:00:00.000Z',
  updated_at: '2026-09-07T00:00:00.000Z',
  author: { id: 'author-1', username: 'author', email: 'author@example.com', role: 'user' },
  category: null,
  tags: [],
  user_reaction: null,
  reaction_breakdown: { helpful: 0, like: 0, informative: 0, total: 0 },
  is_bookmarked: false,
} as unknown as Post;

const fullPost = {
  ...summary,
  content: '<p>Safe full content</p><script>alert(1)</script><img src="data:text/html,evil">',
} as Post;

describe('AdminModerationPage preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.getModerationPosts).mockResolvedValue({ items: [summary], total: 1 });
    vi.mocked(adminService.getModerationPost).mockResolvedValue(fullPost);
    vi.mocked(categoryService.getCategories).mockResolvedValue([]);
  });
  afterEach(cleanup);

  it('XSS-10 loads full detail before rendering a sanitized moderation preview', async () => {
    const { container } = render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem trước' }));

    expect(screen.getByText('Đang tải toàn bộ nội dung bài viết...')).not.toBeNull();
    await waitFor(() => expect(adminService.getModerationPost).toHaveBeenCalledWith('post-1'));
    expect(await screen.findByText('Safe full content')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src^="data:"]')).toBeNull();
  });
});
