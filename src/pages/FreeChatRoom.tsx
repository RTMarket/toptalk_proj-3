import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, supabaseConfigHint, supabaseConfigOk } from '../lib/supabase';
import Navbar from '../components/layout/Navbar';
import { postRoomEvent } from '../lib/accountApi';
import {
  consumePendingInstantChatNavigation,
  INSTANT_ROOM_SECONDS,
  isNavigationReload,
  isRoomWallClockExpired,
} from '../lib/roomConstants';
import { newMessageRowId } from '../lib/messageRowId';

interface Message {
  id: string;
  type: 'text' | 'file';
  sender: string;
  senderName: string;
  text?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  fileType?: string;
  allowDownload: boolean;
  destroySeconds: number;
  expireAt: number;
  createdAt: string;
  isMine?: boolean;
}

const mockMessages: Message[] = [
  {
    id: 'sys1', type: 'text', sender: 'system', senderName: '系统',
    text: '🔒 欢迎来到 TopTalk 即时聊天室。所有消息阅后即焚，珍惜每一次沟通。',
    destroySeconds: 0, expireAt: 0, createdAt: new Date().toISOString(), allowDownload: false,
  },
];

function getFileIcon(mimeType: string, fileName: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
  if (mimeType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📝';
  if (mimeType.includes('sheet') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return '📊';
  if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return '📽️';
  if (mimeType.includes('video') || fileName.endsWith('.mp4')) return '🎬';
  if (mimeType.includes('audio') || fileName.endsWith('.mp3')) return '🎵';
  return '📎';
}

function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function formatRemain(ms: number): string {
  if (ms <= 0) return '0秒';
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`;
  if (s >= 60) return `${Math.floor(s / 60)}分${s % 60}秒`;
  return `${s}秒`;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl font-light w-10 h-10 flex items-center justify-center"
        onClick={onClose}>&times;</button>
      <img src={src} alt="预览" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()} />
    </div>
  );
}

function applyInstantChatLeaveOnReload(roomId: string) {
  try {
    const activeRaw = localStorage.getItem('toptalk_active_room');
    if (activeRaw) {
      const active = JSON.parse(activeRaw);
      if (active?.id === roomId) localStorage.removeItem('toptalk_active_room');
    }
    const leftRooms: Record<string, string> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
    leftRooms[roomId] = new Date().toISOString();
    localStorage.setItem('toptalk_left', JSON.stringify(leftRooms));
  } catch { /* ignore */ }
  postRoomEvent({ roomId, roomType: 'instant', event: 'leave' }).catch(() => {});
}

export default function FreeChatRoom() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId') || '——';

  /** true：按「浏览器刷新」处理，跳过 Realtime/进房逻辑，必要时整页回列表（SPA 从列表进房会先消费 pending 标为 false） */
  const [suppressChatDueToReload, setSuppressChatDueToReload] = useState(() => isNavigationReload());

  const [rtStatus, setRtStatus] = useState<'connecting' | 'ready' | 'failed'>('connecting');

  const [overlay, setOverlay] = useState<string | null>(null);
  /** 房间剩余秒数：始终以「创建者创建时间 + 15 分钟」为准，与 URL 参数无关 */
  const [roomLeft, setRoomLeft] = useState(0);
  const [roomMeta, setRoomMeta] = useState<{ createdAt: string; destroySeconds: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [msgTimes, setMsgTimes] = useState<Record<string, number>>({});
  const [inputText, setInputText] = useState('');
  const [msgDestroySeconds, setMsgDestroySeconds] = useState(300);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [userNickname, setUserNickname] = useState('匿名用户');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef(`u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const nicknameRef = useRef('匿名用户');
  const [userOrder, setUserOrder] = useState<string[]>([]);

  // 刷新页面 = 离开房间（与点「离开」同等本地规则），然后回列表。
  // SPA 从 /rooms 进入：整站 NavigationTiming 可能仍是 reload，须用 pending 区分。
  useLayoutEffect(() => {
    if (!roomId || roomId === '——') return;
    if (consumePendingInstantChatNavigation(roomId)) {
      setSuppressChatDueToReload(false);
      return;
    }
    if (!isNavigationReload()) {
      setSuppressChatDueToReload(false);
      return;
    }
    applyInstantChatLeaveOnReload(roomId);
    window.location.replace('/rooms');
  }, [roomId]);

  // 统计：进入房间（刷新离开时不计为进入）
  useEffect(() => {
    if (!supabaseConfigOk || !roomId || roomId === '——' || suppressChatDueToReload) return;
    postRoomEvent({ roomId, roomType: 'instant', event: 'enter' }).catch(() => {});
    return () => {
      if (suppressChatDueToReload) return;
      postRoomEvent({ roomId, roomType: 'instant', event: 'leave' }).catch(() => {});
    };
  }, [roomId, suppressChatDueToReload]);

  // 拉取房间创建时间：即时房固定 15 分钟，所有人倒计时一致
  useEffect(() => {
    if (!supabaseConfigOk || !roomId || roomId === '——' || suppressChatDueToReload) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('rooms')
        .select('created_at')
        .eq('id', roomId)
        .eq('room_type', 'instant')
        .maybeSingle();
      if (cancelled) return;
      if (data?.created_at) {
        setRoomMeta({ createdAt: String(data.created_at), destroySeconds: INSTANT_ROOM_SECONDS });
        return;
      }
      try {
        const raw: { id: string; type: string; createdAt: string }[] = JSON.parse(
          localStorage.getItem('toptalk_rooms') || '[]'
        );
        const r = raw.find(x => x.id === roomId && x.type === 'free');
        if (r?.createdAt) setRoomMeta({ createdAt: r.createdAt, destroySeconds: INSTANT_ROOM_SECONDS });
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, suppressChatDueToReload]);

  // 房间倒计时：created_at + 15 分钟（与谁加入、是否刷新 URL 无关）
  useEffect(() => {
    if (!roomMeta) return;
    const tick = () => {
      const createdMs = new Date(roomMeta.createdAt).getTime();
      const totalMs = Math.max(0, roomMeta.destroySeconds * 1000);
      const remainMs = Math.max(0, createdMs + totalMs - Date.now());
      setRoomLeft(Math.ceil(remainMs / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [roomMeta]);

  // 房间时间到 → 结束（与解散不同：自然到期）。必须用墙钟判断；已弹出「已结束」后勿重复执行
  useEffect(() => {
    if (!roomMeta || !isRoomWallClockExpired(roomMeta)) return;
    if (overlay === 'expired') return;
    try {
      localStorage.removeItem('toptalk_active_room');
    } catch { /* ignore */ }
    setOverlay('expired');
  }, [roomLeft, roomMeta, overlay]);

  // 关闭/离开页面：也算离开房间，并释放“活跃即时房间”占用
  useEffect(() => {
    if (!supabaseConfigOk || !roomId || roomId === '——' || suppressChatDueToReload) return;
    const release = () => {
      try {
        const raw = localStorage.getItem('toptalk_active_room');
        if (raw) {
          const active = JSON.parse(raw);
          if (active?.id === roomId) localStorage.removeItem('toptalk_active_room');
        }
      } catch { /* ignore */ }
      postRoomEvent({ roomId, roomType: 'instant', event: 'leave' }).catch(() => {});
      try { channelRef.current?.unsubscribe(); } catch { /* ignore */ }
    };
    window.addEventListener('pagehide', release);
    return () => window.removeEventListener('pagehide', release);
  }, [roomId, suppressChatDueToReload]);

  // ── 读取昵称 ────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('toptalk_user');
      if (stored) {
        const u = JSON.parse(stored);
        const name = u.nickname || u.email?.split('@')[0] || '用户';
        nicknameRef.current = name;
        setUserNickname(name);
      }
    } catch {}
  }, []);

  // ── Supabase Realtime：广播消息 + Presence 在线人数（跨设备一致） ──
  useEffect(() => {
    if (!supabaseConfigOk || !roomId || roomId === '——' || suppressChatDueToReload) return;
    const uid = userIdRef.current;
    const channel = supabase.channel(`free_room_${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: uid },
      },
    });
    channelRef.current = channel;

    const computeUserOrderFromPresence = () => {
      try {
        const state = channel.presenceState() as any;
        const entries = Object.entries(state || {}) as Array<[string, any]>;
        const rows = entries.map(([key, v]) => {
          const metas: any[] = Array.isArray(v?.metas) ? v.metas : [];
          const firstOnlineAt = metas
            .map(m => String(m?.online_at || ''))
            .filter(Boolean)
            .sort()[0];
          return { key, firstOnlineAt: firstOnlineAt || '9999-12-31T23:59:59.999Z' };
        });
        rows.sort((a, b) => a.firstOnlineAt.localeCompare(b.firstOnlineAt));
        return rows.map(r => r.key);
      } catch {
        return [] as string[];
      }
    };

    const updatePresence = () => {
      const order = computeUserOrderFromPresence();
      setUserOrder(order);
      setOnlineCount(order.length > 0 ? order.length : 1);
    };

    channel.on('presence', { event: 'sync' }, updatePresence);
    channel.on('presence', { event: 'join' }, updatePresence);
    channel.on('presence', { event: 'leave' }, updatePresence);

    // 监听新消息
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      const msg = payload as Message;
      if (msg.sender === userIdRef.current) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // 监听解散
    channel.on('broadcast', { event: 'room_dissolved' }, () => {
      setOverlay('dissolving');
      setTimeout(() => { window.location.href = '/rooms'; }, 2000);
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      setRtStatus('ready');
      try {
        await channel.track({
          userId: uid,
          roomId,
          online_at: new Date().toISOString(),
        });
      } catch {
        // presence 失败不应影响收发消息；在线人数/排序会退化
      }
      updatePresence();
    });

    return () => {
      channelRef.current = null;
      try {
        channel.unsubscribe();
      } catch { /* ignore */ }
    };
  }, [roomId, suppressChatDueToReload]);

  // 如果长时间没订阅成功，提示用户（网络/Realtime 异常）
  useEffect(() => {
    if (!supabaseConfigOk || suppressChatDueToReload) return;
    setRtStatus('connecting');
    const t = window.setTimeout(() => {
      setRtStatus(s => (s === 'ready' ? s : 'failed'));
    }, 6000);
    return () => window.clearTimeout(t);
  }, [roomId, suppressChatDueToReload]);

  // ── 进入房间权限检查 ─────────────────────────────────
  useEffect(() => {
    if (suppressChatDueToReload) return;
    const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_dissolved') || '[]');
    if (dissolved.includes(roomId)) { window.location.href = '/rooms'; return; }

    const isCreatorRoom = (() => {
      try {
        const created: string[] = JSON.parse(localStorage.getItem('toptalk_created_rooms') || '[]');
        return created.includes(roomId);
      } catch { return false; }
    })();

    if (!isCreatorRoom) {
      const leftRooms: Record<string, string> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
      if (leftRooms[roomId]) { window.location.href = '/rooms'; return; }
      (async () => {
        try {
          const { data } = await supabase
            .from('rooms').select('id, room_type').eq('id', roomId).maybeSingle();
          if (data && data.room_type !== 'instant') window.location.href = '/rooms-premium';
        } catch {}
      })();
    }
  }, [roomId, suppressChatDueToReload]);

  // ── 消息过期检测 ────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setMsgTimes(() => {
        const next: Record<string, number> = {};
        messages.forEach(m => { if (m.expireAt > 0) next[m.id] = Math.max(0, m.expireAt - now); });
        return next;
      });
      setMessages(prev => prev.filter(m => m.expireAt === 0 || m.expireAt > now));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [messages]);

  // ── 自动滚动 ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 发送消息 ───────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim()) return;
    const now = Date.now();
    const newMsg: Message = {
      id: `${now}_${userIdRef.current}`,
      type: 'text',
      sender: userIdRef.current,
      senderName: nicknameRef.current,
      text: inputText,
      allowDownload: false,
      destroySeconds: msgDestroySeconds,
      expireAt: msgDestroySeconds > 0 ? now + msgDestroySeconds * 1000 : 0,
      createdAt: new Date(now).toISOString(),
      isMine: true,
    };

    // 本地立即显示
    setMessages(m => [...m, newMsg]);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 广播给房间内所有人
    channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: newMsg });

    // 持久化到 Supabase
    supabase.from('messages').insert({
      id: newMessageRowId(),
      room_id: `free_${roomId}`,
      sender_id: userIdRef.current,
      sender_name: nicknameRef.current,
      type: 'text',
      content: inputText,
      destroy_seconds: msgDestroySeconds,
    }).then(({ error }) => {
      if (error) console.warn('消息持久化失败:', error.message);
    });
  };

  // ── 创建者判断 ─────────────────────────────────────
  const isCreator = (() => {
    try {
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_created_rooms') || '[]');
      return created.includes(roomId);
    } catch { return false; }
  })();

  const doDissolveRoom = () => {
    setShowDissolveConfirm(false);
    setOverlay('dissolving');
    try {
      const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_dissolved') || '[]');
      if (!dissolved.includes(roomId)) { dissolved.push(roomId); localStorage.setItem('toptalk_dissolved', JSON.stringify(dissolved)); }
      const activeRaw = localStorage.getItem('toptalk_active_room');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active.id === roomId) localStorage.removeItem('toptalk_active_room');
      }
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_created_rooms') || '[]');
      localStorage.setItem('toptalk_created_rooms', JSON.stringify(created.filter((id: string) => id !== roomId)));
    } catch {}
    channelRef.current?.send({ type: 'broadcast', event: 'room_dissolved', payload: { roomId } });
    setTimeout(() => { window.location.href = '/rooms'; }, 2000);
  };

  const doLeaveRoom = () => {
    setShowLeaveConfirm(false);
    setOverlay('leaving');
    try {
      const leftRooms: Record<string, string> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
      leftRooms[roomId] = new Date().toISOString();
      localStorage.setItem('toptalk_left', JSON.stringify(leftRooms));
    } catch {}
    channelRef.current?.send({ type: 'broadcast', event: 'user_left', payload: { userId: userIdRef.current } });
    try {
      const activeRaw = localStorage.getItem('toptalk_active_room');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active?.id === roomId) localStorage.removeItem('toptalk_active_room');
      }
    } catch {}
    setTimeout(() => { window.location.href = '/rooms'; }, 2000);
  };

  const isRoomExpired = !!roomMeta && isRoomWallClockExpired(roomMeta);
  const roomM = Math.floor(roomLeft / 60);
  const roomS = roomLeft % 60;

  /** 用户消息按时间顺序：左右交替 + 蓝/白（即时）底色轮流 */
  const bubbleAlternationByMessageId = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const m of messages) {
      if (m.sender === 'system') continue;
      const remain = msgTimes[m.id] ?? (m.expireAt > 0 ? Math.max(0, m.expireAt - Date.now()) : 0);
      if (m.expireAt > 0 && remain <= 0) continue;
      map.set(m.id, i++);
    }
    return map;
  }, [messages, msgTimes]);

  if (!supabaseConfigOk) {
    return (
      <div className="min-h-screen bg-[#050d1a] text-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-28 pb-16">
          <div className="bg-red-900/20 border border-red-500/30 rounded-3xl p-6">
            <div className="text-red-300 font-bold text-lg mb-2">聊天室暂不可用</div>
            <div className="text-gray-400 text-sm leading-relaxed">{supabaseConfigHint}</div>
            <div className="mt-4 text-gray-600 text-xs">（这不是你的操作问题，是部署环境变量缺失/错误导致。）</div>
          </div>
        </div>
      </div>
    );
  }

  if (suppressChatDueToReload) {
    return <div className="min-h-screen bg-[#050d1a]" />;
  }

  return (
    <div className="min-h-screen bg-[#050d1a] text-white flex flex-col">

      {/* 导航栏（fixed，永远在最上层） */}
      <Navbar />

      {/* ── 房间信息栏（非sticky，贴着对话框顶部） ── */}
      <div className="bg-[#071525]/95 border-b border-yellow-400/20 flex-shrink-0" style={{ marginTop: 64 }}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">

            {/* 左侧：房间信息 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center text-sm flex-shrink-0">💬</div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-yellow-400 font-bold text-xs">#{roomId}</span>
                  <span className="text-gray-600 text-xs">· 即时聊天室</span>
                  <span className="bg-orange-400/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full border border-orange-400/25">固定 15 分钟</span>
                </div>
                <span className="text-gray-600 text-xs">
                  {!roomMeta
                    ? '正在同步创建者房间时间…'
                    : isRoomExpired
                      ? '房间已结束'
                      : `创建者房间倒计时 · 剩余 ${roomM}分${roomS.toString().padStart(2, '0')}秒`}
                </span>
              </div>
            </div>

            {/* 中间：在线人数 */}
            <div className="flex items-center gap-1.5 bg-green-400/10 border border-green-400/25 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0"></div>
              <span className="text-green-400 font-medium text-xs">{onlineCount} 人在线</span>
            </div>

            {/* Realtime 状态 */}
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${
                rtStatus === 'ready'
                  ? 'bg-blue-500/10 border-blue-500/25'
                  : rtStatus === 'connecting'
                    ? 'bg-orange-400/10 border-orange-400/25'
                    : 'bg-red-500/10 border-red-500/25'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  rtStatus === 'ready'
                    ? 'bg-blue-400'
                    : rtStatus === 'connecting'
                      ? 'bg-orange-400 animate-pulse'
                      : 'bg-red-400'
                }`}
              />
              <span
                className={`text-xs font-semibold ${
                  rtStatus === 'ready'
                    ? 'text-blue-300'
                    : rtStatus === 'connecting'
                      ? 'text-orange-300'
                      : 'text-red-300'
                }`}
              >
                {rtStatus === 'ready'
                  ? '实时已连接'
                  : rtStatus === 'connecting'
                    ? '实时连接加载中…'
                    : '实时连接失败'}
              </span>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isCreator && (
                <button onClick={() => setShowDissolveConfirm(true)}
                  className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors font-medium">
                  🔴 解散房间
                </button>
              )}
              <button onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1.5 bg-white/8 hover:bg-white/12 border border-white/15 text-gray-300 hover:text-white text-xs px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors">
                🚪 离开房间
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 对话框（正方形边框，可滚动） ── */}
      <div className="flex-1 overflow-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto">
          {/* 正方形对话框容器 */}
          <div className="bg-[#071525] border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ minHeight: 'calc(100vh - 220px)', maxHeight: 'calc(100vh - 180px)' }}>

            {/* 消息列表（可滚动） */}
            <div className="flex-1 overflow-auto px-3 sm:px-5 py-4 space-y-3">
              {messages.map(msg => {
                const isSystem = msg.sender === 'system';
                const isFile = msg.type === 'file';
                const isImage = isFile && isImageFile(msg.fileType || '');
                const remain = msgTimes[msg.id] ?? (msg.expireAt > 0 ? Math.max(0, msg.expireAt - Date.now()) : 0);
                const expired = msg.expireAt > 0 && remain <= 0;
                const progress = msg.destroySeconds > 0 ? Math.max(0, remain / (msg.destroySeconds * 1000)) : 1;
                const altIdx = bubbleAlternationByMessageId.get(msg.id) ?? 0;
                const side = altIdx % 2 === 0 ? 'left' : 'right';
                const isBlueStripe = altIdx % 2 === 0;
                const bubbleClass = isBlueStripe
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-400/30'
                  : 'bg-white border border-white/25 text-[#1a365d]';
                const nameAccentClass = isBlueStripe ? 'text-blue-100' : 'text-blue-600';
                const metaTimeClass = isBlueStripe ? 'text-blue-200/90' : 'text-gray-500';
                const fileSecondaryClass = isBlueStripe ? 'text-blue-100/90' : 'text-gray-600';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center max-w-lg">
                        <p className="text-gray-400 text-sm">{msg.text}</p>
                        <p className="text-gray-700 text-xs mt-1">{new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                }
                if (expired) return null;

                return (
                  <div key={msg.id} className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-2 max-w-[70%] ${side === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>

                      {/* 头像（左右交替时两侧都显示） */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400/60 to-blue-600/60 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                        {(msg.senderName || '?')[0].toUpperCase()}
                      </div>

                      <div className={`flex flex-col gap-0.5 ${side === 'right' ? 'items-end' : 'items-start'}`}>

                        {/* 昵称 + 时间 */}
                        <div className={`flex items-center gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                          <span className={`text-xs font-semibold ${nameAccentClass}`}>{msg.senderName}</span>
                          <span className={`text-xs ${metaTimeClass}`}>{new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                          {msg.destroySeconds > 0 && remain > 0 && (
                            <span className={`text-xs ${isBlueStripe ? 'text-amber-200' : 'text-orange-500'}`}>🔥 {formatRemain(remain)}</span>
                          )}
                        </div>

                        {/* 消息气泡 */}
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          side === 'right'
                            ? `${bubbleClass} rounded-br-sm`
                            : `${bubbleClass} rounded-bl-sm`
                        }`}>
                          {msg.type === 'text' && <p className="break-all">{msg.text}</p>}
                          {isFile && !isImage && (
                            <div className="flex items-start gap-3">
                              <span className="text-3xl flex-shrink-0">{getFileIcon(msg.fileType || '', msg.fileName || '')}</span>
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium text-sm break-all ${isBlueStripe ? 'text-white' : 'text-[#1a365d]'}`}>{msg.fileName}</div>
                                <div className={`text-xs mt-0.5 ${fileSecondaryClass}`}>{msg.fileSize}</div>
                              </div>
                            </div>
                          )}
                          {isFile && isImage && msg.fileUrl && (
                            <div className="relative group cursor-pointer rounded-xl overflow-hidden"
                              onClick={() => setPreviewImage(msg.fileUrl!)}>
                              <img src={msg.fileUrl} alt={msg.fileName} className="max-w-48 max-h-48 object-cover hover:opacity-90 transition-opacity" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg">🔍 预览</span>
                              </div>
                            </div>
                          )}
                          {msg.type === 'text' && msg.destroySeconds > 0 && (
                            <div className={`w-full rounded-full h-1 mt-2 ${isBlueStripe ? 'bg-white/20' : 'bg-gray-200'}`}>
                              <div className="h-1 rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                                  background: progress > 0.5 ? '#fbbf24' : progress > 0.2 ? '#f97316' : '#ef4444'
                                }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域（固定在对话框底部） */}
            <div className="bg-[#07111f] border-t border-white/8 px-5 py-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">💬 文字</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    阅后即焚
                  </span>
                  <select value={msgDestroySeconds}
                    onChange={e => setMsgDestroySeconds(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-yellow-400/50">
                    <option value={15}>15秒</option>
                    <option value={30}>30秒</option>
                    <option value={60}>1分钟</option>
                    <option value={300}>5分钟</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="输入消息，按 Enter 发送..."
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-400/50 resize-none transition-colors leading-relaxed"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <button onClick={handleSend} disabled={!inputText.trim()}
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold px-5 rounded-xl hover:from-yellow-300 hover:to-yellow-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center gap-1.5 flex-shrink-0">
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 解散确认遮罩 ── */}
      {showDissolveConfirm && (
        <Overlay>
          <div className="bg-[#1a2535] border border-red-500/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">🔴</div>
            <h2 className="text-red-400 font-bold text-xl mb-3">确定要解散房间吗？</h2>
            <p className="text-gray-500 text-sm mb-6">解散后所有消息将永久清除，房间无法恢复。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDissolveConfirm(false)} className="flex-1 border border-white/15 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">取消</button>
              <button onClick={doDissolveRoom} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">确认解散</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── 离开确认遮罩 ── */}
      {showLeaveConfirm && (
        <Overlay>
          <div className="bg-[#1a2535] border border-yellow-500/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">👋</div>
            <h2 className="text-yellow-400 font-bold text-xl mb-3">确定要离开房间吗？</h2>
            <p className="text-gray-500 text-sm mb-6">离开后你将无法再次进入此房间。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 border border-white/15 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">取消</button>
              <button onClick={doLeaveRoom} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-[#1a365d] font-bold py-2.5 rounded-xl text-sm transition-colors">确认离开</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── 解散中遮罩 ── */}
      {overlay === 'dissolving' && (
        <Overlay>
          <div className="bg-[#1a2535] border border-red-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">✅</div>
            <h2 className="text-green-400 font-bold text-xl mb-3">房间已解散！</h2>
            <p className="text-gray-500 text-sm mb-6">正在返回聊天室列表...</p>
          </div>
        </Overlay>
      )}

      {/* ── 离开中遮罩 ── */}
      {overlay === 'leaving' && (
        <Overlay>
          <div className="bg-[#1a2535] border border-yellow-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">👋</div>
            <h2 className="text-yellow-400 font-bold text-xl mb-3">已离开房间</h2>
            <p className="text-gray-500 text-sm mb-6">正在返回聊天室列表...</p>
          </div>
        </Overlay>
      )}

      {/* ── 房间结束遮罩 ── */}
      {overlay === 'expired' && (
        <Overlay>
          <div className="bg-[#1a2535] border border-orange-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">⏱</div>
            <h2 className="text-orange-400 font-bold text-xl mb-3">房间已结束</h2>
            <p className="text-gray-500 text-sm mb-6">房间时间已到，所有消息已焚毁。</p>
            <button
              onClick={() => {
                try {
                  const activeRaw = localStorage.getItem('toptalk_active_room');
                  if (activeRaw) {
                    const active = JSON.parse(activeRaw);
                    if (active.id === roomId) localStorage.removeItem('toptalk_active_room');
                  }
                } catch {}
                window.location.href = '/rooms';
              }}
              className="w-full bg-orange-400 hover:bg-orange-300 text-[#1a365d] font-bold py-3 rounded-xl text-sm transition-colors">
              返回聊天室列表
            </button>
          </div>
        </Overlay>
      )}

      {previewImage && <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />}
    </div>
  );
}
