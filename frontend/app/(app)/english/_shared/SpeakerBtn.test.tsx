import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeakerBtn } from './SpeakerBtn';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
vi.mock('@/shared/api/client', () => ({ getAccessToken: () => 'test-token' }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); request.mockReset(); });

describe('pronunciation lifecycle', () => {
  it('deduplicates repeated taps and aborts pending audio on unmount', async () => {
    let finish!: (value: Response) => void;
    request.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const { unmount } = render(<SpeakerBtn text="Word" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeDisabled();
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(new Response('audio')); });
  });
  it('stops playback and releases its object URL when removed', async () => {
    const pause = vi.fn();
    vi.stubGlobal('Audio', class { pause = pause; play = vi.fn().mockResolvedValue(undefined); });
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    request.mockResolvedValue(new Response('audio'));
    const { unmount } = render(<SpeakerBtn text="Word" />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    unmount();
    expect(pause).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
