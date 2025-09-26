// 주요 수정사항:
// 1. 방 참여 후 다이얼로그가 사라지지 않는 문제 수정
// 2. Y.js provider 상태 이벤트 리스너 개선
// 3. 방 참여 플로우 개선

import { useEffect, useRef, useState, useId, useCallback } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { Users, Palette, Wifi, WifiOff, Copy, Hash, Share } from "lucide-react";
import { BackButton } from "../components/common/BackButton";
import type { Route } from "../types";

// ... (기존 타입 정의는 동일)
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

// ... (기존 유틸 함수들은 동일)
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

  // UI 상태 - 수정된 부분
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showRoomDialog, setShowRoomDialog] = useState<boolean>(true);
  const [inputRoomId, setInputRoomId] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false); // 추가

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

  const generateRoomId = (): string => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const renderStroke = useCallback((drawData: DrawData): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

  // ✅ 수정된 Y.js 초기화 - 더 안정적인 연결 처리
  const initializeYjs = useCallback(
    (roomName: string): void => {
      console.log(`Y.js 초기화 시작: ${roomName}`);

      // 기존 연결 정리
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }

      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      const provider = new WebrtcProvider(roomName, ydoc, {
        signaling: [
          "wss://signaling.yjs.dev",
          "wss://y-webrtc-signaling-eu.herokuapp.com",
          "wss://y-webrtc-signaling-us.herokuapp.com",
        ],
        password: undefined,
        // 더 안정적인 WebRTC 설정
        maxConns: 20,
        filterBcConns: true,
      });

      providerRef.current = provider;

      const drawingArray = ydoc.getArray<DrawData>("drawings");
      drawingArrayRef.current = drawingArray;

      const awareness = provider.awareness;
      awarenessRef.current = awareness;

      // ✅ 연결 상태 이벤트 리스너 개선
      provider.on("status", (event: { connected: boolean }) => {
        console.log("Provider 상태 변경:", event.connected);

        if (event.connected) {
          setConnected(true);
          setConnectionStatus("P2P 연결됨");
          setIsJoining(false);

          // ✅ 연결 성공시 다이얼로그 닫기
          setTimeout(() => {
            setShowRoomDialog(false);
          }, 500);
        } else {
          setConnected(false);
          setConnectionStatus("연결 끊김");
        }
      });

      // ✅ provider 연결 확인 추가
      provider.on("synced", () => {
        console.log("Y.js 문서 동기화 완료");
        setConnected(true);
        setConnectionStatus("동기화 완료");
      });

      // 드로잉 데이터 변경 감지
      drawingArray.observe((event: Y.YArrayEvent<DrawData>) => {
        event.changes.added.forEach((item) => {
          const content = item.content.getContent() as DrawData[];
          content.forEach((drawData) => {
            if (drawData && drawData.userId !== id) {
              renderStroke(drawData);
            }
          });
        });
      });

      // Awareness 변경 감지
      const updateFromAwareness = (): void => {
        const states = Array.from(
          awareness.getStates().values()
        ) as AwarenessState[];

        const connectedUsers: UserInfo[] = states
          .filter((state) => state.user)
          .map((state) => ({
            id: state.user!.id,
            name: state.user!.name,
            color: state.user!.color,
            lastSeen: Date.now(),
          }));
        setUsers(connectedUsers);

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

      // ✅ 내 사용자 정보 설정 - 조금 늦게 설정해서 안정성 확보
      setTimeout(() => {
        awareness.setLocalState({
          user: { id, name: userName, color },
        });
        updateFromAwareness();
      }, 100);

      console.log(`Y.js 초기화 완료: ${roomName}`);
    },
    [userName, color, id, renderStroke]
  );

  // ✅ 수정된 방 생성
  const createRoom = useCallback((): void => {
    if (!inputName.trim()) {
      alert("사용자 이름을 입력해주세요.");
      return;
    }

    setIsJoining(true);
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setUserName(inputName);
    setColor(userColors[0]);
    setConnectionStatus("방 생성 중...");

    console.log(`새 방 생성: ${newRoomId}`);
    initializeYjs(`whiteboard-${newRoomId}`);
  }, [inputName, initializeYjs]);

  // ✅ 수정된 방 참여
  const joinRoom = useCallback((): void => {
    if (!inputRoomId.trim()) {
      alert("방 ID를 입력해주세요.");
      return;
    }
    if (!inputName.trim()) {
      alert("사용자 이름을 입력해주세요.");
      return;
    }

    setIsJoining(true);
    setRoomId(inputRoomId);
    setUserName(inputName);
    setColor(userColors[Math.floor(Math.random() * userColors.length)]);
    setConnectionStatus("방 연결 중...");

    console.log(`방 참여 시도: ${inputRoomId}`);
    initializeYjs(`whiteboard-${inputRoomId}`);
  }, [inputRoomId, inputName, initializeYjs]);

  // ✅ 다이얼로그 다시 보기 (디버깅용)
  const showDialog = useCallback((): void => {
    // 기존 연결 정리
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    setShowRoomDialog(true);
    setConnected(false);
    setUsers([]);
    setCursors(new Map());
    setConnectionStatus("준비 중...");
    setIsJoining(false);
  }, []);

  // 나머지 함수들은 기존과 동일
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

  const handleClearAll = useCallback((): void => {
    const drawingArray = drawingArrayRef.current;
    if (!drawingArray) return;

    drawingArray.delete(0, drawingArray.length);
    clearCanvas();
  }, [clearCanvas]);

  const copyRoomId = useCallback(async (): Promise<void> => {
    if (!roomId) return;

    try {
      await navigator.clipboard.writeText(roomId);
      alert("방 ID가 복사되었습니다!");
    } catch (error) {
      console.warn("클립보드 복사 실패:", error);

      const textArea = document.createElement("textarea");
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("방 ID가 복사되었습니다!");
    }
  }, [roomId]);

  const getPoint = useCallback((e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // 기존 드로잉 이벤트 처리는 동일
  useEffect(() => {
    if (!connected || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let isDrawing = false;
    let lastPoint: { x: number; y: number } | null = null;

    const onPointerMove = (e: PointerEvent): void => {
      const point = getPoint(e);
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

      renderStroke(drawData);

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

  // ✅ 수정된 방 입장 다이얼로그 - 더 명확한 상태 표시
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

            {/* ✅ 연결 상태 표시 */}
            {isJoining && (
              <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">{connectionStatus}</span>
                </div>
              </div>
            )}
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
                disabled={isJoining}
                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                onKeyPress={(e) => e.key === "Enter" && createRoom()}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createRoom}
                disabled={!inputName.trim() || isJoining}
                className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Hash className="w-5 h-5 mx-auto mb-1" />
                {isJoining ? "생성 중..." : "방 만들기"}
              </button>

              <button
                onClick={() => {
                  if (isJoining) return;
                  // 방 참여 UI 토글하는 대신 바로 참여 시도
                  if (inputRoomId.trim()) {
                    joinRoom();
                  }
                }}
                disabled={isJoining}
                className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50"
              >
                <Share className="w-5 h-5 mx-auto mb-1" />방 참여하기
              </button>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">
                방 ID (참여시 필수)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  placeholder="8자리 방 ID"
                  disabled={isJoining}
                  className="flex-1 p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none uppercase font-mono disabled:opacity-50"
                  maxLength={8}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                />
                <button
                  onClick={joinRoom}
                  disabled={
                    !inputName.trim() || !inputRoomId.trim() || isJoining
                  }
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isJoining ? "..." : "참여"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
            <h3 className="text-white font-medium mb-2">사용 팁</h3>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 방 만들기: 이름 입력 후 "방 만들기"</li>
              <li>• 방 참여: 이름 + 방ID 입력 후 "참여"</li>
              <li>• 같은 방ID로 여러 명이 참여 가능</li>
              <li>• 연결까지 10-30초 소요될 수 있음</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
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
            {/* ✅ 디버그용 방 나가기 버튼 */}
            <button
              onClick={showDialog}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              방 나가기
            </button>
          </div>
        </div>

        {/* 기존 캔버스와 도구 패널은 동일 */}
        <div className="grid grid-cols-[1fr_280px] gap-6 h-[calc(100vh-200px)]">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-800 border border-gray-700">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none cursor-crosshair"
            />

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

          {/* 도구 패널 - 기존과 동일하지만 간략화 */}
          <aside className="flex flex-col gap-4">
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

            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">색상</h3>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((c) => (
                  <button
                    type="button"
                    aria-label="색상"
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

            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 shadow-lg">
              <h3 className="mb-3 font-bold text-white">브러시 크기</h3>
              <input
                aria-label="방인원"
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

            <button
              onClick={handleClearAll}
              disabled={!connected}
              className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              전체 지우기
            </button>

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
