import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from './adminService';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../lib/api', () => ({ default: api }));

describe('adminService canonical endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses one canonical request for post moderation actions', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    api.post
      .mockResolvedValueOnce({ data: { post: { id: 'post-1' } } })
      .mockResolvedValueOnce({ data: { post: { id: 'post-1' } } });

    await adminService.getModerationPosts({ status: 'pending' });
    await adminService.approvePost('post-1');
    await adminService.rejectPost('post-1', 'reason');

    expect(api.get).toHaveBeenCalledWith('/admin/posts', { params: { status: 'pending' } });
    expect(api.post).toHaveBeenNthCalledWith(1, '/admin/posts/post-1/approve');
    expect(api.post).toHaveBeenNthCalledWith(2, '/admin/posts/post-1/reject', { reason: 'reason' });
    expect(api.put).not.toHaveBeenCalled();
  });

  it('surfaces the first moderation error without a fallback mutation', async () => {
    const error = new Error('canonical endpoint failed');
    api.post.mockRejectedValue(error);

    await expect(adminService.approvePost('post-1')).rejects.toBe(error);
    expect(api.post).toHaveBeenCalledOnce();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('uses PUT for report resolution and one DELETE for atomic content removal', async () => {
    api.put.mockResolvedValue({ data: { id: 'report-1', status: 'resolved' } });
    api.delete.mockResolvedValue({ data: undefined });

    await adminService.resolveReport('report-1', {
      status: 'resolved',
      resolution_notes: 'handled',
    });
    await adminService.deleteReportContent('report-1');

    expect(api.put).toHaveBeenCalledWith('/admin/reports/report-1', {
      status: 'resolved',
      resolution_notes: 'handled',
    });
    expect(api.delete).toHaveBeenCalledWith('/admin/reports/report-1/content');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('does not fallback from user update or attempt target-specific deletion', async () => {
    api.patch.mockRejectedValue(new Error('canonical user endpoint failed'));
    await expect(adminService.updateUser('user-1', { is_active: false })).rejects.toThrow(
      'canonical user endpoint failed',
    );
    expect(api.patch).toHaveBeenCalledWith('/admin/users/user-1', { is_active: false });
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
});
