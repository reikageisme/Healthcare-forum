// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminReportsPage from './AdminReportsPage';
import { adminService } from '../../services/adminService';
import { Report } from '../../types';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getReports: vi.fn(),
    deleteReportContent: vi.fn(),
    resolveReport: vi.fn(),
  },
}));

const openReport: Report = {
  id: 'report-1',
  reporter_id: 'reporter-1',
  target_type: 'user',
  target_id: 'user-1',
  reason: 'Impersonation',
  status: 'open',
  created_at: '2026-09-07T00:00:00.000Z',
};

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.getReports).mockResolvedValue({
      items: [openReport],
      total: 1,
    });
    vi.mocked(adminService.deleteReportContent).mockResolvedValue();
    vi.mocked(adminService.resolveReport).mockResolvedValue({
      ...openReport,
      status: 'resolved',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('FEREP-01 calls the atomic endpoint exactly once and never resolves separately', async () => {
    render(<AdminReportsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa nội dung' }));

    await waitFor(() => expect(adminService.deleteReportContent).toHaveBeenCalledWith('report-1'));
    expect(adminService.deleteReportContent).toHaveBeenCalledOnce();
    expect(adminService.resolveReport).not.toHaveBeenCalled();
  });
});
