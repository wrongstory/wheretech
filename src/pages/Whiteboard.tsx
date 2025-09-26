// 📁 src/pages/Whiteboard.tsx (TypeScript 완전 준수 버전)
import { useEffect, useRef, useState, useId, useCallback } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { Users, Palette, Wifi, WifiOff, Copy, Hash, Share } from "lucide-react";
import { BackButton } from "../components/common/BackButton";
import type { Route } from "../types";

const colors: string[] = [
  "#ffffff",
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#54a0ff",
];

const userColors: string[] = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#54a0ff",
  "#5f27cd",
];

// Y.js 타입 정의
interface DrawData {
  type: "draw";
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  color: string;
  brushSize: number;
  tool: "pen" | "eraser";
  userId: string;
  timestamp: number;
}

interface CursorData {
  type: "cursor";
  x: number;
  y: number;
  userId: string;
  userName: string;
  userColor: string;
}

interface UserInfo {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

// Y.js Awareness 상태 타입
interface AwarenessState {
  user?: {
    id: string;
    name: string;
    color: string;
  };
  cursor?: {
    x: number;
    y: number;
  };
}

interface WhiteboardProps {
  onNavigate?: (route: Route) => void;
}

interface ToolConfig {
  id: "pen" | "eraser";
  icon: string;
  name: string;
}

// DPR Canvas Hook 최적화
function useDprCanvas(canvas: HTMLCanvasElement | null): void {
  useEffect(() => {
    if (!canvas) return;

    const resize = (): void => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // 배경 초기화
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, rect.width, rect.height);
      drawGrid(ctx, rect.width, rect.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvas]);
}

// 격자 그리기 함수
const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  const gridSize = 30;

  ctx.beginPath();
  for (let x = 0; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
};

// 사용자 이름 생성
const generateUsername = (): string => {
  const adjectives = ["Creative", "Artistic", "Dynamic", "Bright", "Swift"];
  const nouns = ["Designer", "Developer", "Artist", "Creator", "Maker"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${noun}${num}`;
};

const Whiteboard: React.FC<WhiteboardProps> = ({ onNavigate }) => {
  const id = useId().replace(/[:]/g, "");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Y.js 상태
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const drawingArrayRef = useRef<Y.Array<DrawData> | null>(null);
  const awarenessRef = useRef<WebrtcProvider["awareness"] | null>(null);

  // UI 상태
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showRoomDialog, setShowRoomDialog] = useState<boolean>(true);
  const [inputRoomId, setInputRoomId] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");

  // 드로잉 상태
  const [color, setColor] = useState<string>("#ffffff");
  const [brush, setBrush] = useState<number>(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  // 연결 상태
  const [connected, setConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("준비 중...");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());

  const tools: ToolConfig[] = [
    { id: "pen", icon: "✏️", name: "펜" },
    { id: "eraser", icon: "🧽", name: "지우개" },
  ];

  useDprCanvas(canvasRef.current);

  // Room ID 생성
  const generateRoomId = (): string => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  // 캔버스에 그리기
  const renderStroke = useCallback((drawData: DrawData): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = drawData.brushSize * dpr;

    if (drawData.tool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawData.color;
    } else {
      ctx.globalCompositeOperation = "destination-out";
    }

    ctx.beginPath();
    if (drawData.prevX !== undefined && drawData.prevY !== undefined) {
      ctx.moveTo(drawData.prevX * dpr, drawData.prevY * dpr);
    }
    ctx.lineTo(drawData.x * dpr, drawData.y * dpr);
    ctx.stroke();
  }, []);

  // Y.js 초기화
  const initializeYjs = useCallback(
    (roomName: string): void => {
      // Y.js 문서 생성
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // WebRTC Provider 설정
      const provider = new WebrtcProvider(roomName, ydoc, {
        signaling: [
          "wss://signaling.yjs.dev",
          "wss://y-webrtc-signaling-eu.herokuapp.com",
          "wss://y-webrtc-signaling-us.herokuapp.com",
        ],
        password: undefined,
      });

      // awareness 가져오기
      const awareness = provider.awareness;

      providerRef.current = provider;

      // 공유 배열 생성 (모든 드로잉 데이터)
      const drawingArray = ydoc.getArray<DrawData>("drawings");
      drawingArrayRef.current = drawingArray;

      // Awareness API (사용자 커서 추적)
      awarenessRef.current = awareness;

      // 연결 상태 감지
      provider.on("status", (event: { connected: boolean }) => {
        console.log("Y.js 연결 상태:", event.connected);
        if (event.connected) {
          setConnected(true);
          setConnectionStatus("P2P 연결됨");
        } else {
          setConnected(false);
          setConnectionStatus("연결 끊김");
        }
      });

      // 드로잉 데이터 변경 감지
      drawingArray.observe((event: Y.YArrayEvent<DrawData>) => {
        event.changes.added.forEach((item) => {
          const content = item.content.getContent() as DrawData[];
          content.forEach((drawData) => {
            if (drawData && drawData.userId !== id) {
              // 다른 사용자의 드로잉만 렌더링 (자신의 것은 이미 그려짐)
              renderStroke(drawData);
            }
          });
        });
      });

      // 사용자 Awareness 변경 감지 (커서, 사용자 목록)
      const updateFromAwareness = () => {
        const states = Array.from(
          awareness.getStates().values()
        ) as AwarenessState[];

        // 사용자 목록 업데이트
        const connectedUsers: UserInfo[] = states
          .filter((state) => state.user)
          .map((state) => ({
            id: state.user!.id,
            name: state.user!.name,
            color: state.user!.color,
            lastSeen: Date.now(),
          }));
        setUsers(connectedUsers);

        // 커서 위치 업데이트
        const cursorMap = new Map<string, CursorData>();
        states.forEach((state) => {
          if (state.cursor && state.user && state.user.id !== id) {
            cursorMap.set(state.user.id, {
              type: "cursor",
              x: state.cursor.x,
              y: state.cursor.y,
              userId: state.user.id,
              userName: state.user.name,
              userColor: state.user.color,
            });
          }
        });
        setCursors(cursorMap);
      };
      awareness.on("change", updateFromAwareness);

      // ✅ 리스너 등록 이후에 내 상태 세팅 (초기에도 목록에 보이도록)
      awareness.setLocalState({
        user: { id, name: userName, color },
      });
      // 그리고 한 번 즉시 반영
      updateFromAwareness();

      console.log(`Y.js 초기화 완료: 방 ${roomName}`);
    },
    [userName, color, id, renderStroke]
  );

  // 방 생성
  const createRoom = useCallback((): void => {
    if (!inputName.trim()) return;

    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setUserName(inputName);
    setShowRoomDialog(false);
    setColor(userColors[0]);
    setConnectionStatus("방 생성 중...");

    // Y.js 초기화
    initializeYjs(`whiteboard-${newRoomId}`);
  }, [inputName, initializeYjs]);

  // 방 참여
  const joinRoom = useCallback((): void => {
    if (!inputRoomId.trim() || !inputName.trim()) return;

    setRoomId(inputRoomId);
    setUserName(inputName);
    setShowRoomDialog(false);
    setColor(userColors[Math.floor(Math.random() * userColors.length)]);
    setConnectionStatus("방 연결 중...");

    // Y.js 초기화
    initializeYjs(`whiteboard-${inputRoomId}`);
  }, [inputRoomId, inputName, initializeYjs]);

  // 캔버스 지우기
  const clearCanvas = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, rect.width, rect.height);
  }, []);

  // 전체 지우기 (Y.js 동기화)
  const handleClearAll = useCallback((): void => {
    const drawingArray = drawingArrayRef.current;
    if (!drawingArray) return;

    // Y.js 배열 클리어 - 모든 클라이언트에 동기화됨
    drawingArray.delete(0, drawingArray.length);
    clearCanvas();
  }, [clearCanvas]);

  // Room ID 복사
  const copyRoomId = useCallback(async (): Promise<void> => {
    if (!roomId) return;

    try {
      await navigator.clipboard.writeText(roomId);
      alert("방 ID가 복사되었습니다!");
    } catch (error) {
      console.warn("클립보드 복사 실패:", error);

      // 폴백: 텍스트 선택
      const textArea = document.createElement("textarea");
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("방 ID가 복사되었습니다!");
    }
  }, [roomId]);

  // 포인터 좌표 계산
  const getPoint = useCallback((e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // 드로잉 이벤트 처리
  useEffect(() => {
    if (!connected || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let isDrawing = false;
    let lastPoint: { x: number; y: number } | null = null;

    const onPointerMove = (e: PointerEvent): void => {
      const point = getPoint(e);

      // 커서 위치 업데이트 (Awareness API)
      const awareness = awarenessRef.current;
      if (awareness) {
        awareness.setLocalStateField("cursor", {
          x: point.x,
          y: point.y,
        });
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      isDrawing = true;
      lastPoint = getPoint(e);
      canvas.setPointerCapture(e.pointerId);

      // 시작점 그리기
      const drawData: DrawData = {
        type: "draw",
        x: lastPoint.x,
        y: lastPoint.y,
        color,
        brushSize: brush,
        tool,
        userId: id,
        timestamp: Date.now(),
      };

      renderStroke(drawData);

      // Y.js 배열에 추가 - 자동으로 모든 클라이언트에 동기화됨!
      const drawingArray = drawingArrayRef.current;
      if (drawingArray) {
        drawingArray.push([drawData]);
      }
    };

    const onPointerUp = (e: PointerEvent): void => {
      isDrawing = false;
      lastPoint = null;
      canvas.releasePointerCapture(e.pointerId);
    };

    const onPointerDraw = (e: PointerEvent): void => {
      if (!isDrawing || !lastPoint) return;

      const point = getPoint(e);

      const drawData: DrawData = {
        type: "draw",
        x: point.x,
        y: point.y,
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        color,
        brushSize: brush,
        tool,
        userId: id,
        timestamp: Date.now(),
      };

      // 낙관적 렌더링 (즉시 그리기)
      renderStroke(drawData);

      // Y.js 동기화
      const drawingArray = drawingArrayRef.current;
      if (drawingArray) {
        drawingArray.push([drawData]);
      }

      lastPoint = point;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointermove", onPointerDraw);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerDraw);
    };
  }, [connected, color, brush, tool, id, renderStroke, getPoint]);

  // 정리
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, []);

  // 방 입장 다이얼로그
  if (showRoomDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-8">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-purple-500/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Y.js P2P 화이트보드
            </h1>
            <p className="text-gray-400">구글독스 수준의 실시간 협업</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-white font-medium mb-2">
                사용자 이름
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder={generateUsername()}
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                onKeyPress={(e) => e.key === "Enter" && createRoom()}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createRoom}
                disabled={!inputName.trim()}
                className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Hash className="w-5 h-5 mx-auto mb-1" />방 만들기
              </button>

              <button
                onClick={() => setShowRoomDialog(false)}
                className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition-all"
              >
                <Share className="w-5 h-5 mx-auto mb-1" />방 참여하기
              </button>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">
                방 ID (참여시에만)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  placeholder="방 ID 입력"
                  className="flex-1 p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none uppercase font-mono"
                  maxLength={8}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                />
                <button
                  onClick={joinRoom}
                  disabled={!inputName.trim() || !inputRoomId.trim()}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  참여
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
            <h3 className="text-white font-medium mb-2">Y.js의 장점</h3>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 구글독스 수준 협업</li>
              <li>• 자동 충돌 해결</li>
              <li>• 오프라인 지원</li>
              <li>• 완전 서버리스</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* 네비게이션 */}
      {onNavigate && (
        <BackButton onBack={() => onNavigate("home")} color="green" />
      )}

      <div className="pt-20 max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Y.js P2P 화이트보드
          </h1>
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-yellow-400" />
              )}
              <span className="text-sm">{connectionStatus}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{users.length} 명 접속중</span>
            </div>
            {roomId && (
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                <span className="font-mono text-lg font-bold text-green-400">
                  {roomId}
                </span>
                <button
                  onClick={copyRoomId}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="방 ID 복사"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-6 h-[calc(100vh-200px)]">
          {/* 캔버스 영역 */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-800 border border-gray-700">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none cursor-crosshair"
            />

            {/* 다른 사용자 커서 */}
            {Array.from(cursors.values()).map((cursor) => (
              <div
                key={cursor.userId}
                className="absolute pointer-events-none z-10 transform -translate-x-1 -translate-y-1"
                style={{
                  left: `${cursor.x}px`,
                  top: `${cursor.y}px`,
                  transition: "all 0.1s ease-out",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                  style={{ backgroundColor: cursor.userColor }}
                />
                <div
                  className="absolute top-5 left-0 text-xs font-bold px-2 py-1 rounded shadow-lg text-white whitespace-nowrap"
                  style={{ backgroundColor: cursor.userColor }}
                >
                  {cursor.userName}
                </div>
              </div>
            ))}
          </div>

          {/* 도구 패널 */}
          <aside className="flex flex-col gap-4">
            {/* 도구 선택 */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">도구</h3>
              <div className="flex gap-2">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`flex-1 p-3 rounded-lg flex flex-col items-center gap-2 transition-all ${
                      tool === t.id
                        ? "bg-green-600 text-white shadow-lg scale-105"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-xs font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 색상 선택 */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">색상</h3>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((c) => (
                  <button
                    type="button"
                    aria-label="색상 선택"
                    key={c}
                    className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                      color === c
                        ? "border-white scale-110 shadow-lg"
                        : "border-gray-600 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* 브러시 크기 */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">브러시 크기</h3>
              <input
                aria-label="브러시 크기"
                type="range"
                min={1}
                max={20}
                value={brush}
                onChange={(e) => setBrush(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center text-white mt-2 font-medium">
                {brush}px
              </div>
            </div>

            {/* 접속 사용자 */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">접속 사용자</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: user.color }}
                    />
                    <span className="text-sm text-white flex-1">
                      {user.name}
                      {user.id === id && " (나)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 액션 버튼 */}
            <button
              onClick={handleClearAll}
              disabled={!connected}
              className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              전체 지우기
            </button>

            {/* 상태 정보 */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg text-sm">
              <div className="space-y-1 text-gray-400">
                <div>상태: {connected ? "🟢 연결됨" : "🟡 연결 중"}</div>
                <div>사용자: {users.length}명</div>
                <div className="text-xs opacity-70">Y.js + WebRTC P2P</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
