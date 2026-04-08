import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/layout/Navbar';
import { postRoomEvent } from '../lib/accountApi';

interface Room {
  id: string;
  type: 'free' | 'premium';
  createdAt: string; // ISO string
  isCreator?: boolean; // 是否是创建者
}

interface ActiveRoom {
  id: string;
  createdAt: string; // ISO string
  destroySeconds: number;
}

const ROOM_DURATION_MS = 15 * 60 * 1000; // 15分钟

function getActiveRoom(): ActiveRoom | null {
  try {
    const raw = localStorage.getItem('toptalk_active_room');
    if (!raw) return null;
    const room: ActiveRoom = JSON.parse(raw);
    const elapsed = Date.now() - new Date(room.createdAt).getTime();
    if (elapsed >= room.destroySeconds * 1000) {
      localStorage.removeItem('toptalk_active_room');
      return null;
    }
    return room;
  } catch { return null; }
}

// 判断用户是否是某房间的创建者（从 localStorage 中的 createdRooms 记录）
function isRoomCreator(roomId: string): boolean {
  try {
    const created: string[] = JSON.parse(localStorage.getItem('toptalk_created_rooms') || '[]');
    return created.includes(roomId);
  } catch { return false; }
}

function formatRemain(ms: number): string {
  if (ms <= 0) return '已结束';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}分${sec.toString().padStart(2, '0')}秒`;
}

export default function FreeRoomSelection() {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [myRooms, setMyRooms] = useState<Room[]>([]);

  // 实时倒计时状态
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [activeRoomRemaining, setActiveRoomRemaining] = useState(0);

  const loadRooms = () => {
    try {
      const raw: Room[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
      // 为每条记录补充创建者标记
      const rooms = raw.map(r => ({
        ...r,
        isCreator: isRoomCreator(r.id),
      }));
      setMyRooms(rooms);
    } catch { setMyRooms([]); }
  };

  // 初始化：检查活跃房间
  useEffect(() => {
    loadRooms();
    const room = getActiveRoom();
    setActiveRoom(room);
    if (room) {
      setActiveRoomRemaining(
        Math.max(0, room.destroySeconds * 1000 - (Date.now() - new Date(room.createdAt).getTime()))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每秒更新倒计时
  useEffect(() => {
    if (!activeRoom) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        activeRoom.destroySeconds * 1000 - (Date.now() - new Date(activeRoom.createdAt).getTime())
      );
      setActiveRoomRemaining(remaining);
      if (remaining === 0) {
        clearInterval(id);
        localStorage.removeItem('toptalk_active_room');
        setActiveRoom(null);
        loadRooms();
      }
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id]);

  const instantRemain = (createdAt: string) => {
    const expire = new Date(createdAt).getTime() + ROOM_DURATION_MS;
    return Math.max(0, expire - Date.now());
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId || joinRoomId.length !== 6) { setJoinError('请输入6位房间号'); return; }
    setJoinError('');

    // 规则2：创建者有未结束房间时，不能加入其他房间
    if (activeRoom && activeRoomRemaining > 0) {
      const elapsed = Math.max(0, activeRoom.destroySeconds * 1000 - (Date.now() - new Date(activeRoom.createdAt).getTime()));
      if (elapsed > 0) {
        setJoinError(`你还有进行中的房间（#${activeRoom.id}），结束后才能加入新房间`);
        return;
      }
    }

    setJoinLoading(true);
    await new Promise(r => setTimeout(r, 500));

    // 即时聊天室：只查 localStorage（本人创建的房间）+ Supabase（但过滤 room_type === 'instant'）
    // 这样高级房间永远不在查询结果里，两个系统完全隔离

    // 第一步：查本地（本人创建的房间）
    const localRooms: Room[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
    const localFound = localRooms.find(r => r.id === joinRoomId && r.type === 'free');

    // 第二步：Supabase 过滤即时房间（只查 room_type === 'instant'，高级房间永远不在结果里）
    let supabaseFound = false;
    try {
      const { data } = await supabase
        .from('rooms')
        .select('id, room_type')
        .eq('id', joinRoomId)
        .eq('room_type', 'instant')
        .maybeSingle();
      if (data) supabaseFound = true;
    } catch { /* ignore */ }

    if (!localFound && !supabaseFound) {
      setJoinError('房间不存在，请确认房间号是否正确'); setJoinLoading(false); return;
    }

    setJoinLoading(false);
    navigate(`/free-chat?roomId=${joinRoomId}&destroy=900`);
  };

  const handleCreateRoom = async () => {
    const current = getActiveRoom();
    if (current) {
      const remaining = Math.max(
        0,
        current.destroySeconds * 1000 - (Date.now() - new Date(current.createdAt).getTime())
      );
      if (remaining > 0) return;
    }
    setCreateLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date().toISOString();
    const room: Room = { id: newId, type: 'free', createdAt: now, isCreator: true };
    const existing: Room[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
    const updated = [room, ...existing].slice(0, 50);
    localStorage.setItem('toptalk_rooms', JSON.stringify(updated));

    // 即时房间写入 Supabase（room_type='instant'，供其他用户查询加入）
    try {
      await supabase.from('rooms').upsert({
        id: newId,
        room_type: 'instant',
        status: 'active',
        created_at: now,
      });
    } catch { /* ignore - localStorage 已成功写入 */ }

    // 标记为创建者
    try {
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_created_rooms') || '[]');
      if (!created.includes(newId)) { created.push(newId); localStorage.setItem('toptalk_created_rooms', JSON.stringify(created)); }
    } catch { /* ignore */ }

    // 标记为当前活跃房间
    const active: ActiveRoom = { id: newId, createdAt: now, destroySeconds: 900 };
    localStorage.setItem('toptalk_active_room', JSON.stringify(active));
    setActiveRoom(active);
    setActiveRoomRemaining(ROOM_DURATION_MS);

    setCreateLoading(false);
    // 统计：创建房间
    postRoomEvent({ roomId: newId, roomType: 'instant', event: 'create' }).catch(() => {});
    navigate(`/free-chat?roomId=${newId}&destroy=900`);
  };

  const goPremium = () => navigate('/rooms-premium');

  const instantRooms = myRooms.filter(r => r.type === 'free');

  // 倒计时中状态
  const isCountingDown = activeRoom && activeRoomRemaining > 0;
  const canCreate = !isCountingDown;

  // 是否可以加入（规则2：创建者有房间则禁止加入）
  const canJoin = !(activeRoom && activeRoomRemaining > 0);

  return (
    <div className="min-h-screen bg-[#050d1a] flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto px-5 py-10 space-y-8 w-full">

        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white mb-2">聊天室</h1>
          <p className="text-gray-500 text-sm">创建或进入安全私密聊天室</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 进入即时聊天室 */}
          <div className="bg-[#0a1628] border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/25 flex items-center justify-center"><span className="text-xl">💬</span></div>
              <div>
                <h2 className="text-white font-bold text-base">进入即时聊天室</h2>
                <p className="text-gray-600 text-xs mt-0.5">输入房间号直接加入</p>
              </div>
            </div>

            {/* 加入限制提示（规则2） */}
            {!canJoin && (
              <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-orange-400 text-xs font-medium">
                  你有进行中的房间（#{activeRoom?.id}），结束后才能加入新房间
                </span>
              </div>
            )}

            <div className="space-y-3">
              <input
                value={joinRoomId}
                onChange={e => { setJoinRoomId(e.target.value.replace(/\D/g, '').slice(0, 6)); setJoinError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinRoom(); }}
                placeholder="请输入6位数字房间号"
                disabled={!canJoin}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-blue-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
              <button
                onClick={handleJoinRoom}
                disabled={joinLoading || !canJoin}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {joinLoading ? '⟳' : '↪️'} {joinLoading ? '加入中...' : !canJoin ? '⏳ 有房间进行中...' : '进入即时聊天室'}
              </button>
            </div>
          </div>

          {/* 创建即时聊天室 */}
          <div className="bg-[#0a1628] border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-500/40 flex items-center justify-center"><span className="text-xl">➕</span></div>
              <div>
                <h2 className="text-white font-bold text-base">创建即时聊天室</h2>
                <p className="text-gray-600 text-xs mt-0.5">建立新的安全即时会话</p>
              </div>
            </div>
            <div className="bg-white/4 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 文字消息传输</div>
              <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 阅后即焚（最长5分钟）</div>
              <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 多用户实时同步</div>
              <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-red-500/60">✕</span> <span className="line-through text-gray-700">文件/图片传输</span></div>
            </div>

            {/* 活跃房间倒计时提示 */}
            {isCountingDown && (
              <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="text-orange-400 text-xs font-medium">
                    当前房间进行中，请等待结束或<span className="underline">进入房间解散</span>后再创建新房
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={createLoading || !canCreate}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {createLoading ? '⟳' : '⚡'} {createLoading ? '创建中...' : isCountingDown ? '⏳ 房间进行中...' : '+ 创建即时聊天室'}
            </button>

            {isCountingDown && (
              <p className="text-center text-gray-600 text-xs mt-2">
                剩余 {formatRemain(activeRoomRemaining)} 可创建新房
              </p>
            )}
          </div>
        </div>

        {/* 高级聊天室推广长栏 */}
        <div onClick={goPremium} className="bg-gradient-to-r from-yellow-400/10 to-amber-500/10 border border-yellow-400/30 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-yellow-400/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center text-2xl flex-shrink-0">🔐</div>
            <div>
              <h3 className="text-yellow-400 font-bold text-base">高级聊天室</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-500 text-xs flex items-center gap-1">✓ 文件传输</span>
                <span className="text-gray-500 text-xs flex items-center gap-1">✓ 阅后即焚（最长2.5小时）</span>
                <span className="text-gray-500 text-xs flex items-center gap-1">✓ 密码保护房间</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium group-hover:gap-3 transition-all">
            了解更多 <span>→</span>
          </div>
        </div>

        {/* 我的聊天室 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-base">我的聊天室</h3>
            <button className="text-gray-600 text-xs hover:text-gray-400 transition-colors">管理全部 →</button>
          </div>

          {/* 表头 */}
          <div className="grid grid-cols-3 gap-3 mb-2 px-1">
            <span className="text-gray-600 text-xs">类型</span>
            <span className="text-gray-600 text-xs">房间号</span>
            <span className="text-gray-600 text-xs text-right">剩余时间</span>
          </div>

          {/* 活跃房间卡片（创建者的未结束房间） */}
          {isCountingDown && activeRoom && (
            <div className="bg-[#0a1628] border border-orange-400/30 rounded-xl px-4 py-3 mb-2">
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">即时聊天室</span>
                  <span className="bg-orange-400/20 text-orange-400 text-xs px-2 py-0.5 rounded-full border border-orange-400/25">进行中</span>
                </div>
                <span className="text-gray-400 text-sm font-mono">#{activeRoom.id}</span>
                <div className="flex items-center justify-end gap-2">
                  <svg className="w-3.5 h-3.5 text-orange-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-orange-400 text-sm font-bold tabular-nums">{formatRemain(activeRoomRemaining)}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => navigate(`/free-chat?roomId=${activeRoom.id}&destroy=900`)}
                  className="text-blue-400 text-xs hover:text-blue-300 font-medium transition-colors"
                >
                  进入房间 →
                </button>
                <span className="text-gray-700 text-xs">创建者</span>
              </div>
            </div>
          )}

          {/* 历史房间列表（排除：加入后离开的房间 + 正在进行且已在上面显示的房间） */}
          <div className="space-y-2">
            {instantRooms
              .filter(room => {
                // 排除：已解散的房间
                const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_dissolved') || '[]');
                if (dissolved.includes(room.id)) return false;
                // 排除：正在进行中的房间（已在上面卡片单独显示）
                const isActive = activeRoom?.id === room.id;
                if (isActive) return false;
                // 排除：加入后离开的房间（加入者身份，非创建者）
                const leftRooms: Record<string, number> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
                const hasLeft = !!leftRooms[room.id];
                if (hasLeft && !room.isCreator) return false;
                return true;
              })
              .map(room => {
              const remain = instantRemain(room.createdAt);
              const isExpired = remain <= 0;
              return (
                <div key={room.id} className="flex items-center justify-between bg-[#0a1628] border border-white/8 rounded-xl px-4 py-3 hover:border-white/15 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/25 flex items-center justify-center text-sm">💬</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">即时聊天室</span>
                        <span className={isExpired ? 'bg-gray-500/20 text-gray-500 text-xs px-2 py-0.5 rounded-full border border-gray-500/25' : 'bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/25'}>
                          {isExpired ? '已结束' : '进行中'}
                        </span>
                        {room.isCreator && <span className="text-gray-700 text-xs">· 创建者</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-gray-600 text-xs font-mono">#{room.id}</span>
                        <span className="text-gray-700 text-xs">{new Date(room.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isExpired ? (
                      <span className="text-gray-600 text-xs">已结束</span>
                    ) : (
                      <span className="text-orange-400/70 text-xs">⏱ {formatRemain(remain)}</span>
                    )}
                    {!isExpired && (
                      <button onClick={() => navigate(`/free-chat?roomId=${room.id}&destroy=900`)} className="text-blue-400 text-sm hover:text-blue-300 transition-colors font-medium">进入 →</button>
                    )}
                  </div>
                </div>
              );
            })}
            {instantRooms.filter(room => {
              const isActive = activeRoom?.id === room.id;
              if (isActive) return false;
              const leftRooms: Record<string, number> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
              const hasLeft = !!leftRooms[room.id];
              if (hasLeft && !room.isCreator) return false;
              return true;
            }).length === 0 && (
              <p className="text-gray-700 text-sm text-center py-6">暂无聊天室记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
