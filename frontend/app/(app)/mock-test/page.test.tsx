import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MockTestPage from './page';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
vi.mock('@/context/ExamModeContext', () => ({ useExamMode: () => ({ isJam: false }) }));
vi.mock('@/components/ExamModeSwitch', () => ({ default: () => null }));
vi.mock('@/components/JamMockCatalog', () => ({ default: () => null }));
vi.mock('@/components/ShinyPill', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); request.mockReset(); });
afterEach(cleanup);

it('renders saved totals for each exam and zero only for exams absent from initialized metadata', async () => {
  request.mockResolvedValue({ ok: true, json: async () => ({ exams: [{ examSlug: 'ssc-chsl', mockCount: 1, pyqCount: 14, total: 15 }] }) });
  render(<MockTestPage />);
  const chsl = screen.getByRole('link', { name: /SSC CHSL/ });
  expect(await within(chsl).findByText('15 Tests Included')).toBeInTheDocument();
  expect(within(screen.getByRole('link', { name: /SSC CGL/ })).getByText('0 Tests Included')).toBeInTheDocument();
  expect(screen.queryByText('142 Tests Included')).not.toBeInTheDocument();
  expect(screen.queryByText('84 Tests Included')).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});
