import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/layout/Navbar';
import { postRoomEvent } from '../lib/accountApi';
import { getActivePremiumRooms, removeActivePremiumRoom, upsertActivePremiumRoom } from '../lib/premiumActiveRooms';
import { getPremiumRoomStorageBucket, uploadPremiumRoomFile } from '../lib/premiumRoomStorage';
import {
  deleteAllPremiumMessagesForRoom,
  deletePremiumMessageRow,
  fetchPremiumRoomMessagesFromDb,
  persistPremiumFileMessage,
  persistPremiumTextMessage,
} from '../lib/premiumRoomDbMessages';

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
    text: '🔒 欢迎来到 TopTalk 高级聊天室。所有消息阅后即焚，文件可选是否允许下载，珍惜每一次沟通。',
    destroySeconds: 0, expireAt: 0, createdAt: new Date().toISOString(), allowDownload: false,
  },
];

function getFileIcon(mimeType: string, fileName: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📝';
  if (mimeType.includes('sheet') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return '📊';
  if (mimeType.includes('presentation') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) return '📽️';
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

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl font-light w-10 h-10 flex items-center justify-center">×</button>
      <img src={src} alt="预览" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()} />
    </div>
  );
}

export default function PremiumChatRoom() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId') || '------';
  const destroyParam = parseInt(searchParams.get('destroy') || '3600');
  const durationLabel = searchParams.get('duration') ? decodeURIComponent(searchParams.get('duration')!) : '1小时';

  // dissolveBarRef and leaveBarRef removed — animation via CSS
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomLeft, setRoomLeft] = useState(destroyParam);
  const [onlineCount, setOnlineCount] = useState(1);
  const userIdRef = useRef(`u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const nicknameRef = useRef('匿名用户');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [userOrder, setUserOrder] = useState<string[]>([]);

  const [overlayType, setOverlayType] = useState<'dissolving' | 'leaving' | 'expired' | null>(null);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [msgTimes, setMsgTimes] = useState<Record<string, number>>({});

  const [sendMode, setSendMode] = useState<'text' | 'file'>('text');
  const [inputText, setInputText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [msgDestroySeconds, setMsgDestroySeconds] = useState(300);

  const [pendingFile, setPendingFile] = useState<{
    file: File; url: string; name: string;
    size: string; mime: string; allowDownload: boolean;
  } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // ── 读取昵称（用于消息展示/广播）────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('toptalk_user');
      if (!stored) return;
      const u = JSON.parse(stored);
      const name = u.nickname || u.email?.split('@')[0] || '用户';
      nicknameRef.current = String(name || '用户');
    } catch {
      // ignore
    }
  }, []);

  // ── 创建者判断 ─────────────────────────────────────
  const amICreator = (() => {
    try {
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]');
      return created.includes(roomId);
    } catch { return false; }
  })();

  // 统计：进入/离开房间（不影响聊天功能，失败忽略）
  useEffect(() => {
    if (!roomId || roomId === '------') return;
    postRoomEvent({ roomId, roomType: 'premium', event: 'enter' }).catch(() => {});
    // 标记为活跃房间（加入也算）
    const nowIso = new Date().toISOString();
    const existing = getActivePremiumRooms().find(r => r.id === roomId);
    upsertActivePremiumRoom({
      id: roomId,
      // 创建者离开再进入时，沿用原 createdAt，避免倒计时被重置
      createdAt: existing?.createdAt || nowIso,
      destroySeconds: destroyParam,
      role: amICreator ? 'creator' : 'member',
      password: searchParams.get('password') || undefined,
    });
    return () => {
      postRoomEvent({ roomId, roomType: 'premium', event: 'leave' }).catch(() => {});
      // 成员离开后从“活跃房间”里移除；创建者离开则仍保持活跃（直到解散/倒计时结束）
      if (!amICreator) removeActivePremiumRoom(roomId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── 进房：拉取未过期的历史消息（后进用户可见仍在倒计时中的消息）──────────
  useEffect(() => {
    if (!roomId || roomId === '------') return;
    let cancelled = false;
    void (async () => {
      const loaded = await fetchPremiumRoomMessagesFromDb(roomId, userIdRef.current);
      if (cancelled) return;
      setMessages(prev => {
        const system = prev.filter(m => m.sender === 'system');
        const rest = prev.filter(m => m.sender !== 'system');
        const seen = new Set(rest.map(m => m.id));
        const toAdd = loaded.filter(m => !seen.has(m.id)).map(m => ({ ...m } as Message));
        const combined = [...rest, ...toAdd].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return [...system, ...combined];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ── Supabase Realtime 订阅 ──────────────────────────
  useEffect(() => {
    const uid = userIdRef.current;
    const channel = supabase.channel(`premium_room_${roomId}`, {
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

    // 监听新消息广播（与即时聊天室一致；兼容 payload 在 .payload 或根上的两种形态）
    channel.on('broadcast', { event: 'new_message' }, (raw: unknown) => {
      const wrap = raw as { payload?: Message } | Message | null | undefined;
      const msg = (wrap && typeof wrap === 'object' && 'payload' in wrap && wrap.payload
        ? wrap.payload
        : wrap) as Message | undefined;
      if (!msg?.sender || msg.sender === userIdRef.current) return;
      if (!msg.id) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    channel.on('broadcast', { event: 'room_dissolved' }, () => {
      setOverlayType('dissolving');
      setTimeout(() => window.location.replace('/rooms-premium'), 2100);
    });

    channel.on('presence', { event: 'sync' }, updatePresence);
    channel.on('presence', { event: 'join' }, updatePresence);
    channel.on('presence', { event: 'leave' }, updatePresence);

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      try {
        await channel.track({ userId: uid, roomId, online_at: new Date().toISOString() });
      } catch {
        /* ignore */
      }
      updatePresence();
    });

    return () => {
      const savedChannel = channelRef.current;
      channelRef.current = null;
      try {
        savedChannel?.unsubscribe();
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Room countdown
  useEffect(() => {
    const id = setInterval(() => setRoomLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Room expired → overlay，并清空该房间在 DB 中的消息（阅后即焚不落库）
  useEffect(() => {
    if (roomLeft === 0) {
      try { removeActivePremiumRoom(roomId); } catch { /* ignore */ }
      void deleteAllPremiumMessagesForRoom(roomId);
      setOverlayType('expired');
    }
  }, [roomLeft, roomId]);

  // Message expiration ticker
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setMsgTimes(() => {
        const next: Record<string, number> = {};
        messages.forEach(m => { if (m.expireAt > 0) next[m.id] = Math.max(0, m.expireAt - now); });
        return next;
      });
      setMessages(prev => {
        const next = prev.filter(m => m.expireAt === 0 || m.expireAt > now);
        const removed = prev.filter(m => m.expireAt > 0 && m.expireAt <= now);
        for (const m of removed) {
          if (m.sender === 'system') continue;
          void deletePremiumMessageRow(m.id);
        }
        return next;
      });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doDissolveRoom = () => {
    setShowDissolveConfirm(false);
    setOverlayType('dissolving');
    const _ch = channelRef.current;
    try { _ch?.send({ type: 'broadcast', event: 'room_dissolved', payload: { roomId } }); } catch { /* ignore */ }
    setTimeout(() => { try { _ch?.unsubscribe(); } catch { /* ignore */ } }, 0);
    // 清除活跃房间 + 创建者标记 + 更新 Supabase 房间状态
    try {
      const dissolved: string[] = JSON.parse(localStorage.getItem('toptalk_dissolved') || '[]');
      if (!dissolved.includes(roomId)) { dissolved.push(roomId); localStorage.setItem('toptalk_dissolved', JSON.stringify(dissolved)); }
      removeActivePremiumRoom(roomId);
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]');
      localStorage.setItem('toptalk_premium_created_rooms', JSON.stringify(created.filter(id => id !== roomId)));
    } catch { /* ignore */ }
    // 更新 Supabase 房间状态为已解散（供其他用户查询）
    supabase.from('rooms').update({ status: 'dissolved' }).eq('id', roomId).then(() => {});
    void deleteAllPremiumMessagesForRoom(roomId);
    // 2秒后跳转高级聊天室列表页
    setTimeout(() => window.location.replace('/rooms-premium'), 2100);
  };
  const doLeaveRoom = () => {
    setShowLeaveConfirm(false);
    setOverlayType('leaving');
    const _ch = channelRef.current;
    const _uid = userIdRef.current;
    // 加入者离开后标记（创建者离开不标记，仍可进入）
    if (!amICreator) {
      try {
        const leftRooms: Record<string, number> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
        leftRooms[roomId] = Date.now();
        localStorage.setItem('toptalk_left', JSON.stringify(leftRooms));
      } catch { /* ignore */ }
    }
    setTimeout(() => {
      try { _ch?.send({ type: 'broadcast', event: 'user_left', payload: { userId: _uid } }); } catch { /* ignore */ }
      try { _ch?.unsubscribe(); } catch { /* ignore */ }
    }, 0);
    setTimeout(() => { window.location.replace('/rooms-premium'); }, 2100);
  };

  const handleSendFile = async () => {
    if (!pendingFile || fileUploading) return;
    const now = Date.now();
    const myId = userIdRef.current;
    const myName = nicknameRef.current || '用户';
    const pf = pendingFile;

    setFileUploading(true);
    const result = await uploadPremiumRoomFile(roomId, pf.file);
    setFileUploading(false);

    if ('error' in result) {
      const bucket = getPremiumRoomStorageBucket();
      alert(
        `文件上传失败：${result.error}\n\n` +
          '说明：对方看到「请检查互联网连接」，是因为此前把仅本机可用的 blob 链接发给了别人。\n' +
          `请先在 Supabase 创建 Storage 桶「${bucket}」并设为公开访问，且允许匿名上传（见控制台 Storage 策略）。`
      );
      return;
    }

    try { URL.revokeObjectURL(pf.url); } catch { /* ignore */ }

    const persisted = await persistPremiumFileMessage({
      roomId,
      myId,
      myName,
      destroySeconds: msgDestroySeconds,
      fileUrl: result.url,
      fileName: pf.name,
      fileSize: pf.size,
      fileType: pf.mime,
      allowDownload: pf.allowDownload,
    });

    let newMsg: Message;
    if ('error' in persisted) {
      console.warn('文件消息持久化失败:', persisted.error);
      newMsg = {
        id: `${now}_${myId}`,
        type: 'file',
        sender: myId,
        senderName: myName,
        fileName: pf.name,
        fileUrl: result.url,
        fileSize: pf.size,
        fileType: pf.mime,
        allowDownload: pf.allowDownload,
        destroySeconds: msgDestroySeconds,
        expireAt: msgDestroySeconds > 0 ? now + msgDestroySeconds * 1000 : 0,
        createdAt: new Date(now).toISOString(),
        isMine: true,
      };
    } else {
      const createdMs = new Date(persisted.createdAt).getTime();
      newMsg = {
        id: persisted.id,
        type: 'file',
        sender: myId,
        senderName: myName,
        fileName: pf.name,
        fileUrl: result.url,
        fileSize: pf.size,
        fileType: pf.mime,
        allowDownload: pf.allowDownload,
        destroySeconds: msgDestroySeconds,
        expireAt: msgDestroySeconds > 0 ? createdMs + msgDestroySeconds * 1000 : 0,
        createdAt: persisted.createdAt,
        isMine: true,
      };
    }

    setMessages(m => [...m, newMsg]);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    void channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: newMsg });
  };

  const handleSend = async () => {
    if (sendMode !== 'text') return;
    const textBody = inputText.trim();
    if (!textBody) return;
    const now = Date.now();
    const myId = userIdRef.current;
    const myName = nicknameRef.current || '用户';

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const persisted = await persistPremiumTextMessage({
      roomId,
      myId,
      myName,
      textBody,
      destroySeconds: msgDestroySeconds,
    });

    let newMsg: Message;
    if ('error' in persisted) {
      console.warn('文字消息持久化失败:', persisted.error);
      newMsg = {
        id: `${now}_${myId}`,
        type: 'text',
        sender: myId,
        senderName: myName,
        text: textBody,
        allowDownload: false,
        destroySeconds: msgDestroySeconds,
        expireAt: msgDestroySeconds > 0 ? now + msgDestroySeconds * 1000 : 0,
        createdAt: new Date(now).toISOString(),
        isMine: true,
      };
    } else {
      const createdMs = new Date(persisted.createdAt).getTime();
      newMsg = {
        id: persisted.id,
        type: 'text',
        sender: myId,
        senderName: myName,
        text: textBody,
        allowDownload: false,
        destroySeconds: msgDestroySeconds,
        expireAt: msgDestroySeconds > 0 ? createdMs + msgDestroySeconds * 1000 : 0,
        createdAt: persisted.createdAt,
        isMine: true,
      };
    }

    setMessages(m => [...m, newMsg]);
    void channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: newMsg });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('文件不可超过 10MB'); return; }
    const url = URL.createObjectURL(file);
    setPendingFile({
      file, url, name: file.name,
      size: file.size > 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`,
      mime: file.type || 'application/octet-stream',
      allowDownload: true,
    });
    e.target.value = '';
  };

  const handleDownload = async (msg: Message) => {
    const href = msg.fileUrl;
    if (!href || href === '#') return;
    if (href.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = href;
      a.download = msg.fileName || 'file';
      a.click();
      return;
    }
    try {
      const res = await fetch(href, { mode: 'cors' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = msg.fileName || 'file';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-[#050d1a] flex flex-col">

      {/* ── 共享导航栏（可点击下拉菜单） ── */}
      <Navbar />

      {/* ── Sticky Header ── */}
      <div className="sticky top-16 md:top-20 z-[60] bg-[#071525]/95 backdrop-blur-md border-b border-amber-400/20">
        <div className="max-w-5xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* ── 左半边：房间信息 ── */}
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-2xl">🔐</span>
              <span className="text-white font-extrabold text-base tracking-wide">高级聊天室</span>
              <span className="text-gray-500 text-sm font-mono">#{roomId}</span>
              <span className="bg-orange-400/10 text-orange-400 text-xs px-2 py-0.5 rounded-full border border-orange-400/30 flex-shrink-0">
                ⏱ {durationLabel}
              </span>
              <span className="bg-yellow-400/10 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-400/30 flex-shrink-0 tabular-nums">
                剩余 {formatRemain(roomLeft * 1000)}
              </span>
              <span className="bg-amber-400/10 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-400/30 flex-shrink-0">高级</span>
            </div>

            {/* ── 右半边：在线人数 + 操作按钮 ── */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 在线人数 */}
              <div className="flex items-center gap-1.5 bg-green-400/10 border border-green-400/25 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-green-400 text-xs font-semibold">{onlineCount} 人在线</span>
              </div>
              {/* 解散房间 */}
              {amICreator && (
                <button onClick={() => setShowDissolveConfirm(true)}
                  className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  解散房间
                </button>
              )}
              {/* 离开 */}
              <button onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1.5 bg-white/8 hover:bg-white/12 border border-white/15 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                离开
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Dissolve Confirm Overlay ── */}
      {showDissolveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a2535] border-2 border-red-500/60 rounded-2xl p-8 max-w-sm w-[90%] text-center shadow-2xl">
            <div className="text-5xl mb-4">🚨</div>
            <h2 className="text-red-400 font-bold text-xl mb-2">确定要解散房间吗？</h2>
            <p className="text-gray-500 text-sm mb-6">解散后所有消息将永久清除，房间无法恢复。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDissolveConfirm(false)}
                className="flex-1 border border-white/15 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">取消</button>
              <button onClick={doDissolveRoom}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">确认解散</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave Confirm Overlay ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a2535] border-2 border-yellow-500/60 rounded-2xl p-8 max-w-sm w-[90%] text-center shadow-2xl">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-yellow-400 font-bold text-xl mb-2">确定要离开房间吗？</h2>
            <p className="text-gray-500 text-sm mb-6">离开后你将无法再次进入此房间。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 border border-white/15 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">取消</button>
              <button onClick={doLeaveRoom}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-[#1a365d] font-bold py-2.5 rounded-xl text-sm transition-colors">确认离开</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dissolving Overlay ── */}
      {overlayType === 'dissolving' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a2535] border border-green-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">✅</div>
            <h2 className="text-green-400 font-bold text-xl mb-3">房间已解散！</h2>
            <p className="text-gray-500 text-sm mb-6">正在返回聊天室列表...</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full" style={{ width: '100%', animation: 'shrink 2.1s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Leaving Overlay ── */}
      {overlayType === 'leaving' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a2535] border border-yellow-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">👋</div>
            <h2 className="text-yellow-400 font-bold text-xl mb-3">已离开房间</h2>
            <p className="text-gray-500 text-sm mb-6">正在返回聊天室列表...</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full leave-bar" />
            </div>
          </div>
        </div>
      )}

      {/* ── Expired Overlay ── */}
      {overlayType === 'expired' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a2535] border border-orange-400/40 rounded-2xl p-10 max-w-sm w-[90%] text-center">
            <div className="text-5xl mb-5">⏱️</div>
            <h2 className="text-orange-400 font-bold text-xl mb-3">房间已结束</h2>
            <p className="text-gray-500 text-sm mb-6">房间时间已到，所有消息已焚毁。</p>
            <button onClick={() => window.location.replace('/rooms-premium')}
              className="w-full bg-orange-400 hover:bg-orange-300 text-[#1a365d] font-bold py-3 rounded-xl text-sm transition-colors">
              返回聊天室列表
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-auto max-w-5xl w-full mx-auto px-4 pt-32 pb-4 space-y-4 flex flex-col justify-center">
        {messages.map(msg => {
          const isMine = msg.sender === userIdRef.current;
          const isSystem = msg.sender === 'system';
          const isFile = msg.type === 'file';
          const isImage = isFile && isImageFile(msg.fileType || '');
          const remain = msgTimes[msg.id] ?? (msg.expireAt > 0 ? Math.max(0, msg.expireAt - Date.now()) : 0);
          const expired = msg.expireAt > 0 && remain <= 0;
          const progress = msg.destroySeconds > 0 ? Math.max(0, remain / (msg.destroySeconds * 1000)) : 1;
          const senderId = msg.sender;
          const joinIndex = (() => {
            const idx = userOrder.indexOf(senderId);
            return idx >= 0 ? idx : 0;
          })();
          const side = joinIndex % 2 === 0 ? 'right' : 'left';
          const colorIdx = joinIndex % 4;
          const bubbleClass = (() => {
            // 0: yellow, 1: white, 2: blue, 3: green
            if (colorIdx === 0) return 'bg-gradient-to-br from-yellow-400/90 to-yellow-500/90 text-[#1a365d]';
            if (colorIdx === 1) return 'bg-white/10 border border-white/15 text-white';
            if (colorIdx === 2) return 'bg-blue-500/20 border border-blue-400/30 text-white';
            return 'bg-green-500/20 border border-green-400/30 text-white';
          })();
          const nameTextClass = colorIdx === 0 ? 'text-gray-700' : 'text-gray-500';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center max-w-lg">
                  <p className="text-gray-400 text-sm">{msg.text}</p>
                  <p className="text-gray-700 text-xs mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          }
          if (expired) return null;

          return (
            <div key={msg.id} className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-xl ${side === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
                {side === 'left' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/40 to-amber-600/40 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {(msg.senderName || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className={`flex flex-col gap-1 ${side === 'right' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                    <span className={`${nameTextClass} text-xs`}>{msg.senderName}</span>
                    <span className="text-gray-700 text-xs">
                      {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.destroySeconds > 0 && remain > 0 && (
                      <span className="text-orange-400/80 text-xs flex items-center gap-0.5">🔥 {formatRemain(remain)}</span>
                    )}
                    {msg.destroySeconds > 0 && remain <= 0 && (
                      <span className="text-gray-700 text-xs">🔥 已焚毁</span>
                    )}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    side === 'right'
                      ? `${bubbleClass} rounded-br-md`
                      : `${bubbleClass} rounded-bl-md`
                  }`}>
                    {msg.type === 'text' && <p className="break-all">{msg.text}</p>}
                    {isFile && (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {isImage && msg.fileUrl && (
                          <div className="relative group cursor-pointer rounded-xl overflow-hidden"
                            onClick={() => setPreviewImage(msg.fileUrl!)}>
                            <img src={msg.fileUrl} alt={msg.fileName}
                              className="max-w-64 max-h-64 object-cover hover:opacity-90 transition-opacity" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">🔍 预览</span>
                              {msg.allowDownload && (
                                <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">⬇ 下载</span>
                              )}
                            </div>
                            <div className="text-white/60 text-xs truncate px-1 py-0.5 bg-black/20">{msg.fileName}</div>
                          </div>
                        )}
                        {!isImage && (
                          <div className="flex items-start gap-3">
                            <span className="text-3xl flex-shrink-0">{getFileIcon(msg.fileType || '', msg.fileName || '')}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm break-all leading-tight">{msg.fileName}</div>
                              <div className="text-gray-500 text-xs mt-0.5">{msg.fileSize}</div>
                            </div>
                          </div>
                        )}
                        {msg.allowDownload ? (
                          <button onClick={() => void handleDownload(msg)}
                            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-xs py-1.5 rounded-lg transition-colors w-full">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            下载文件
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 text-gray-600 text-xs py-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            已禁止下载
                          </div>
                        )}
                        {msg.destroySeconds > 0 && (
                          <div className="w-full bg-white/10 rounded-full h-1">
                            <div className="h-1 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                                background: progress > 0.5 ? '#fbbf24' : progress > 0.2 ? '#f97316' : '#ef4444',
                              }} />
                          </div>
                        )}
                      </div>
                    )}
                    {msg.type === 'text' && msg.destroySeconds > 0 && (
                      <div className="w-full bg-white/10 rounded-full h-1 mt-2">
                        <div className="h-1 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                            background: progress > 0.5 ? '#fbbf24' : progress > 0.2 ? '#f97316' : '#ef4444',
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

      {/* ── Input Area ── */}
      <div className="bg-[#07111f] border-t border-white/8 max-w-5xl w-full mx-auto px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            {([
              { id: 'text' as const, label: '文字', icon: '💬' },
              { id: 'file' as const, label: '文件', icon: '📎' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setSendMode(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  sendMode === t.id
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                    : 'text-gray-500 hover:text-white'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              消息有效期
            </span>
            <select value={msgDestroySeconds}
              onChange={e => setMsgDestroySeconds(Number(e.target.value))}
              className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-400/50">
              {[
                { label: '15秒', value: 15 },
                { label: '30秒', value: 30 },
                { label: '1分钟', value: 60 },
                { label: '5分钟', value: 300 },
                { label: '10分钟', value: 600 },
                { label: '15分钟', value: 900 },
                { label: '30分钟', value: 1800 },
                { label: '1小时', value: 3600 },
                { label: '2小时', value: 7200 },
                { label: '2.5小时', value: 9000 },
              ].map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {sendMode === 'text' && (
          <div className="flex gap-2">
            <textarea
              ref={textareaRef} value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                const t = e.target;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="输入消息，按 Enter 发送..."
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-amber-400/50 resize-none transition-colors leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button onClick={() => void handleSend()} disabled={!inputText.trim()}
              className="bg-gradient-to-r from-amber-400 to-amber-500 text-[#1a365d] font-bold px-5 rounded-xl hover:from-amber-300 hover:to-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex-shrink-0 flex items-center gap1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              发送
            </button>
          </div>
        )}

        {sendMode === 'file' && !pendingFile && (
          <div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
              className="hidden" id="file-upload-input" />
            <label htmlFor="file-upload-input"
              className="flex flex-col items-center justify-center gap-3 border border-dashed border-amber-400/30 rounded-xl py-8 text-amber-400/60 hover:text-amber-400 hover:border-amber-400/60 transition-colors cursor-pointer text-sm">
              <span className="text-4xl">📎</span>
              <span>点击选择任意文件发送</span>
              <span className="text-xs text-gray-700">支持图片、文档、压缩包等（≤ 10MB）</span>
              <span className="text-xs text-amber-400/70">发送时将上传到云端，对方才能下载（不再使用仅本机可用的链接）</span>
            </label>
          </div>
        )}

        {sendMode === 'file' && pendingFile && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              {isImageFile(pendingFile.mime) ? (
                <img src={pendingFile.url} alt={pendingFile.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-3xl border border-white/10">
                  {getFileIcon(pendingFile.mime, pendingFile.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm break-all leading-tight">{pendingFile.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{pendingFile.size}</div>
                {isImageFile(pendingFile.mime) && (
                  <span className="text-blue-400 text-xs mt-0.5 inline-block">🖼️ 图片 · 支持在线预览</span>
                )}
              </div>
              <button onClick={() => setPendingFile(null)}
                className="text-gray-600 hover:text-white text-lg flex-shrink-0 transition-colors">✕</button>
            </div>
            <div className="flex items-center justify-between mb-3 p-2.5 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-400 text-xs">允许对方下载</span>
              </div>
              <button
                onClick={() => setPendingFile(p => p ? { ...p, allowDownload: !p.allowDownload } : null)}
                className={`w-10 h-5 bg-white/20 rounded-full relative transition-colors ${pendingFile.allowDownload ? 'bg-green-500' : 'bg-white/20'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${pendingFile.allowDownload ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPendingFile(null)}
                className="flex-1 border border-white/15 text-gray-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">取消</button>
              <button onClick={() => void handleSendFile()} disabled={fileUploading}
                className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 text-[#1a365d] font-bold py-2.5 rounded-xl text-sm hover:from-amber-300 hover:to-amber-400 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {fileUploading ? '上传中…' : '发送文件'}
              </button>
            </div>
          </div>
        )}
      </div>

      {previewImage && <ImageModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      <style>{`
        @keyframes shrink { from { width: 100% } to { width: 0% } }
        @keyframes leave-shrink { from { width: 100% } to { width: 0% } }
      `}</style>
    </div>
  );
}
