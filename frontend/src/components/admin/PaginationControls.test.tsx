// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaginationControls from './PaginationControls';

describe('PaginationControls', () => {
  afterEach(cleanup);

  it('FEQ-04 shows disabled controls for an empty result set', () => {
    render(
      <PaginationControls page={1} total={0} pageSize={20} itemLabel="bài viết" onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole('navigation', { name: 'Phân trang' }).textContent).toContain('Trang 1 / 1');
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps both controls disabled for a one-page result set', () => {
    render(
      <PaginationControls page={1} total={20} pageSize={20} itemLabel="người dùng" onPageChange={vi.fn()} />,
    );

    expect(screen.getByText(/20 người dùng/)).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('FEQ-04 sends exactly the selected adjacent page for a multi-page result', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls page={2} total={45} pageSize={20} itemLabel="báo cáo" onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('navigation', { name: 'Phân trang' }).textContent).toContain('Trang 2 / 3');
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });
});
