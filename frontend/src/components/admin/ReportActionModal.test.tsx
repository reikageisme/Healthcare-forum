// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportActionModal from './ReportActionModal';
import { Report } from '../../types';

const report: Report = {
  id: 'report-1',
  reporter_id: 'reporter-1',
  target_type: 'post',
  target_id: 'post-1',
  reason: 'Spam',
  status: 'open',
  created_at: '2026-09-07T00:00:00.000Z',
};

function renderModal(status: Report['status']) {
  return render(
    <ReportActionModal
      isOpen
      report={{ ...report, status }}
      onClose={vi.fn()}
      onResolve={vi.fn(async () => undefined)}
      onDeleteContent={vi.fn(async () => undefined)}
    />,
  );
}

describe('ReportActionModal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('FEREP-01 sends only the report ID to the atomic delete callback', async () => {
    const onDeleteContent = vi.fn(async () => undefined);
    render(
      <ReportActionModal
        isOpen
        report={report}
        onClose={vi.fn()}
        onResolve={vi.fn(async () => undefined)}
        onDeleteContent={onDeleteContent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xóa nội dung' }));
    await waitFor(() => expect(onDeleteContent).toHaveBeenCalledWith('report-1'));
    expect(onDeleteContent).toHaveBeenCalledOnce();
  });

  it.each([
    ['resolved', 'Báo cáo đã được giải quyết'],
    ['dismissed', 'Báo cáo đã được bỏ qua'],
  ] as const)('FEREP-02 renders %s as a closed report with no mutation controls', (status, label) => {
    renderModal(status);

    expect(screen.getByText(label)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa nội dung' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bỏ qua' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đã xử lý' })).toBeNull();
  });
});
