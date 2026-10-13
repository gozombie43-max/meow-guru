import { getUsersCollection, getBattleRoomsCollection, getBattleFriendshipsCollection } from '../config/mongodb.js';
import { getConnectedBattleUserIds } from './battlePresenceService.js';

export async function getBattleStudents(viewerId) {
  const viewer = String(viewerId);
  const connectedIds = (await getConnectedBattleUserIds()).filter(id => id !== viewer);
  if (!connectedIds.length) return { students: [], limit: 100 };
  const users = await getUsersCollection().find({
    id: { $in: connectedIds }, role: { $nin: ['admin', 'superadmin', 'moderator'] }, status: { $nin: ['suspended', 'banned'] },
  }, { projection: { _id: 0, id: 1, name: 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
  const ids = users.map(user => String(user.id));
  const [rooms, friendships] = await Promise.all([
    getBattleRoomsCollection().find({ 'players.userId': { $in: ids }, status: { $in: ['waiting', 'active'] }, expiresAt: { $gt: new Date() } },
      { projection: { _id: 0, 'players.userId': 1, status: 1 } }).toArray(),
    getBattleFriendshipsCollection().find({ users: viewer, status: { $in: ['pending', 'accepted'] } }).toArray(),
  ]);
  const activities = new Map();
  for (const room of rooms) for (const player of room.players) {
    if (room.status === 'active' || !activities.has(player.userId)) activities.set(player.userId, room.status);
  }
  const relationships = new Map(friendships.map(item => [item.users.find(id => id !== viewer),
    item.status === 'accepted' ? 'friend' : item.requestedToUserId === viewer ? 'incoming' : 'pending']));
  return { students: users.map(user => {
    const id = String(user.id);
    return { userId: id, displayName: user.name || 'Student', online: true,
      activity: activities.get(id) === 'active' ? 'In a battle' : activities.get(id) === 'waiting' ? 'Waiting for opponent' : 'Online',
      busy: activities.has(id), friendship: relationships.get(id) || 'none' };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName)), limit: 100 };
}
