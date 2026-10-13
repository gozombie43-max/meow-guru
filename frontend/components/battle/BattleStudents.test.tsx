import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BattleStudents from './BattleStudents';
const mocks = vi.hoisted(() => ({ add: vi.fn().mockResolvedValue(undefined), accept: vi.fn().mockResolvedValue(undefined), mutate: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, token: 'token' }) }));
vi.mock('@/shared/api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/api/battleSocialApi', () => ({ sendBattleFriendRequest: mocks.add, respondBattleFriendRequest: mocks.accept }));
vi.mock('swr', () => ({ default: () => ({ mutate: mocks.mutate, data: { students: [
  { userId: 'a', displayName: 'Asha', online: true, activity: 'Online', busy: false, friendship: 'friend' },
  { userId: 'b', displayName: 'Ben', online: true, activity: 'Online', busy: false, friendship: 'none' },
  { userId: 'c', displayName: 'Chris', online: false, activity: 'Offline', busy: false, friendship: 'friend' },
  { userId: 'd', displayName: 'Dana', online: true, activity: 'Online', busy: false, friendship: 'incoming' },
  { userId: 'e', displayName: 'Eli', online: true, activity: 'Online', busy: false, friendship: 'pending' },
], limit: 100 } }) }));
describe('online battle students', () => {
  it('hides offline students and allows invites only for friends', () => {
    const invite = vi.fn();
    render(<BattleStudents disabled={false} onInvite={invite} />);
    expect(screen.queryByText('Chris')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite Ben to battle' })).not.toBeInTheDocument();
    expect(screen.getByText('Requested').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Invite Asha to battle' }));
    expect(invite).toHaveBeenCalledWith('a');
  });
  it('sends and accepts friend requests from discovery', async () => {
    render(<BattleStudents disabled={false} onInvite={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add friend Ben' }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('b'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept friend request from Dana' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Accept friend request from Dana' }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('d', 'accept'));
  });
});
