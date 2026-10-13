"use client";

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Search, Swords, Users, UserPlus } from 'lucide-react';
import { sendBattleFriendRequest, respondBattleFriendRequest } from '@/lib/api/battleSocialApi';
import api from '@/shared/api/client';
import { useAuth } from '@/context/AuthContext';

type Student = { userId: string; displayName: string; online: boolean; activity: string; busy: boolean; friendship: "none" | "pending" | "incoming" | "friend" };
type Roster = { students: Student[]; limit: number };
const fetchStudents = async (): Promise<Roster> => (await api.get('/api/battle/students')).data;
export default function BattleStudents({ disabled, onInvite }: { disabled: boolean; onInvite: (id: string) => void }) {
  const { user, token } = useAuth();
  const { data, error, mutate } = useSWR(user && token ? ['battle-students', user.id] : null, fetchStudents,
    { refreshInterval: 30000, revalidateOnFocus: true, shouldRetryOnError: false });
  const [pending, setPending] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [notice, setNotice] = useState('');
  const addFriend = async (student: Student) => {
    if (actionLock.current) return;
    actionLock.current = true; setPending(student.userId); setNotice('');
    try {
      if (student.friendship === 'incoming') await respondBattleFriendRequest(student.userId, 'accept');
      else await sendBattleFriendRequest(student.userId);
      await mutate();
    } catch { setNotice('Could not update this friend request. Please try again.'); }
    finally { actionLock.current = false; setPending(null); }
  };
  const [query, setQuery] = useState('');
  const students = (data?.students || []).filter(student => student.online);
  const online = students.filter(student => student.online).length;
  const visible = students.filter(student => student.displayName.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="battle-students" aria-labelledby="battle-students-title">
    <header><div><Users size={19} /><h2 id="battle-students-title">Students</h2></div><span>{online} online</span></header>
    {notice && <p role="status" className="battle-student-empty">{notice}</p>}
    <label className="battle-student-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search students" placeholder="Find a student" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error ? <div className="battle-student-empty" role="status">Unable to refresh students. <button type="button" onClick={() => void mutate()}>Retry</button></div> : !data ? <p className="battle-student-empty" role="status">Loading students…</p> : visible.length ? <ul className="battle-student-list">{visible.map(student => <li key={student.userId}>
      <div className="battle-student-avatar" aria-hidden="true">{student.displayName.trim().slice(0, 2).toUpperCase()}<i className={student.online ? 'online' : ''} /></div>
      <div className="battle-student-info"><strong>{student.displayName}</strong><span className={student.online ? 'online' : ''}>{student.activity}</span></div>
      {student.friendship === 'friend' ? <button type="button" data-ui-button="state" className="battle-student-invite" disabled={disabled || student.busy || Boolean(pending)} aria-label={`Invite ${student.displayName} to battle`} onClick={() => onInvite(student.userId)}><Swords size={15} aria-hidden="true" /><span>{student.busy ? 'Busy' : 'Invite'}</span></button> : <button type="button" data-ui-button="state" className="battle-student-invite" disabled={Boolean(pending) || student.friendship === 'pending'} aria-label={`${student.friendship === 'incoming' ? 'Accept friend request from' : 'Add friend'} ${student.displayName}`} onClick={() => void addFriend(student)}><UserPlus size={15} aria-hidden="true" /><span>{pending === student.userId ? 'Saving…' : student.friendship === 'pending' ? 'Requested' : student.friendship === 'incoming' ? 'Accept' : 'Add friend'}</span></button>}
    </li>)}</ul> : <p className="battle-student-empty">{query ? 'No students match your search.' : 'No students online right now.'}</p>}
    <p className="battle-student-footer">Add friends to invite them to battle</p>
  </section>;
}
