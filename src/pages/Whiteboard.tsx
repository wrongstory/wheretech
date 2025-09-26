/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
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

function getContrastText(hex: string): string {
  // #fff, #ffffff 모두 허용
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b; // 0~255
  return luminance > 150 ? "#000000" : "#ffffff";
}

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

const generateUniqueId = () => {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
  const [userId] = useState(() => generateUniqueId());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Y.js 상태
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const drawingArrayRef = useRef<Y.Array<DrawData> | null>(null);
  const awarenessRef = useRef<WebsocketProvider["awareness"] | null>(null);

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
    console.log("=== renderStroke 시작 ===");
    console.log("받은 데이터:", drawData);

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("캔버스를 찾을 수 없음!");
      return;
    }
    console.log("캔버스 존재:", canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("2D 컨텍스트를 가져올 수 없음!");
      return;
    }
    console.log("컨텍스트 존재:", ctx);

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    console.log("DPR:", dpr);
    console.log("캔버스 크기:", canvas.width, "x", canvas.height);
    console.log("그릴 좌표:", drawData.x * dpr, drawData.y * dpr);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = drawData.brushSize * dpr;

    if (drawData.tool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawData.color;
      console.log(
        "펜 모드 - 색상:",
        drawData.color,
        "브러시:",
        drawData.brushSize
      );
    } else {
      ctx.globalCompositeOperation = "destination-out";
      console.log("지우개 모드");
    }

    ctx.beginPath();
    if (drawData.prevX !== undefined && drawData.prevY !== undefined) {
      ctx.moveTo(drawData.prevX * dpr, drawData.prevY * dpr);
      console.log("이동:", drawData.prevX * dpr, drawData.prevY * dpr);
    }
    ctx.lineTo(drawData.x * dpr, drawData.y * dpr);
    ctx.stroke();

    console.log("렌더링 완료");
    console.log("=== renderStroke 완료 ===");
  }, []);

  // ✅ 수정된 Y.js 초기화 - 더 안정적인 연결 처리
  // Y.js 디버깅을 위한 코드 추가 - initializeYjs 함수 내부에 추가

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

      // ✅ WebsocketProvider 사용 (WebrtcProvider 대신)
      const provider = new WebsocketProvider(
        "wss://demos.yjs.dev/ws", // Y.js 공식 웹소켓 서버
        roomName,
        ydoc,
        {
          connect: true, // 자동 연결
        }
      );

      providerRef.current = provider;

      const drawingArray = ydoc.getArray<DrawData>("drawings");
      drawingArrayRef.current = drawingArray;

      const awareness = provider.awareness;
      awarenessRef.current = awareness;

      // ✅ WebSocket 이벤트 리스너 (WebRTC와 다름)
      provider.on("status", (event: { status: string }) => {
        console.log("WebSocket 상태:", event.status);

        if (event.status === "connected") {
          setConnected(true);
          setConnectionStatus("서버 연결됨");
          setIsJoining(false);

          setTimeout(() => {
            setShowRoomDialog(false);
          }, 500);
        } else if (event.status === "connecting") {
          setConnectionStatus("서버 연결 중...");
        } else if (event.status === "disconnected") {
          setConnected(false);
          setConnectionStatus("서버 연결 끊김");
        }
      });

      // ✅ 수정: 'synced' → 'sync'
      provider.on("sync", (isSynced: boolean) => {
        console.log("Y.js 문서 동기화 상태:", isSynced);
        if (isSynced) {
          console.log("현재 그림 데이터 수:", drawingArray.length);
          setConnected(true);
          setConnectionStatus("동기화 완료");

          // 기존 그림들 다시 그리기
          const canvas = canvasRef.current;
          if (canvas) {
            clearCanvas();
            drawingArray.toArray().forEach((drawData) => {
              if (drawData && drawData.userId !== userId) {
                renderStroke(drawData);
              }
            });
          }
        }
      });

      // ✅ 추가 이벤트들
      provider.on("connection-close", () => {
        console.log("WebSocket 연결 닫힘");
        setConnected(false);
        setConnectionStatus("연결 닫힘");
      });

      provider.on("connection-error", (error: any) => {
        console.error("WebSocket 연결 오류:", error);
        setConnected(false);
        setConnectionStatus("연결 오류");
      });

      // 1. observe 대신 간단한 방법 사용
      let lastArrayLength = 0;

      ydoc.on("update", () => {
        const currentLength = drawingArray.length;

        if (currentLength > lastArrayLength) {
          console.log(`새 그림 데이터: ${lastArrayLength} → ${currentLength}`);
          console.log(`내 사용자 ID: "${userId}"`); // 디버깅용

          for (let i = lastArrayLength; i < currentLength; i++) {
            const drawData = drawingArray.get(i);
            console.log(`항목 ${i} 처리:`, drawData);
            console.log(`데이터의 userId: "${drawData?.userId}"`);
            console.log(
              `ID 비교: "${drawData?.userId}" !== "${userId}" = ${
                drawData?.userId !== userId
              }`
            );

            if (drawData && drawData.userId !== userId) {
              // id 대신 userId 사용
              console.log("다른 사용자 그림 - 렌더링 시작:", drawData.userId);
              renderStroke(drawData);
            } else if (drawData && drawData.userId === userId) {
              // id 대신 userId 사용
              console.log("내 그림 - 렌더링 스킵");
            } else {
              console.log("데이터 없음 또는 이상함:", drawData);
            }
          }

          lastArrayLength = currentLength;
        }
      });

      // ✅ Awareness 변경 감지 (기존과 동일)
      const updateFromAwareness = (): void => {
        const states = Array.from(
          awareness.getStates().values()
        ) as AwarenessState[];
        console.log("Awareness 상태 업데이트:", states);

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
          if (state.cursor && state.user && state.user.id !== userId) {
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

      // ✅ 내 사용자 정보 설정
      setTimeout(() => {
        awareness.setLocalState({
          user: { id: userId, name: userName, color },
        });
        console.log("내 사용자 정보 설정:", {
          id: userId,
          name: userName,
          color,
        });
        updateFromAwareness();
      }, 100);

      console.log(`Y.js 초기화 완료: ${roomName}`);
    },
    [clearCanvas, renderStroke, userId, userName, color]
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

  // 1. saveDrawData 함수 정의 (컴포넌트 내부, useEffect 위에)
  const saveDrawData = useCallback((drawData: DrawData) => {
    const drawingArray = drawingArrayRef.current;
    if (drawingArray) {
      console.log("드로잉 데이터 저장:", drawData);
      drawingArray.push([drawData]);
      console.log("현재 배열 길이:", drawingArray.length);
      console.log("배열 내용:", drawingArray.toArray());
    }
  }, []);

  // 2. 완전한 드로잉 이벤트 핸들러 (useEffect 내부)
  useEffect(() => {
    if (!connected || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let isDrawing = false;
    let lastPoint: { x: number; y: number } | null = null;

    // 마우스/터치 이동 - 커서 위치 업데이트
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

    // 그리기 시작
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
        userId: userId, // id 대신 userId 사용
        timestamp: Date.now(),
      };

      renderStroke(drawData);
      saveDrawData(drawData); // ✅ 수정된 부분
    };

    // 그리기 종료
    const onPointerUp = (e: PointerEvent): void => {
      isDrawing = false;
      lastPoint = null;
      canvas.releasePointerCapture(e.pointerId);
    };

    // 그리기 진행 중
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
        userId: userId, // id 대신 userId 사용
        timestamp: Date.now(),
      };

      renderStroke(drawData);
      saveDrawData(drawData); // ✅ 수정된 부분

      lastPoint = point;
    };

    // 이벤트 리스너 등록
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp); // 터치 취소시에도 그리기 종료
    canvas.addEventListener("pointermove", onPointerDraw);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerDraw);
    };
  }, [
    connected,
    color,
    brush,
    tool,
    renderStroke,
    getPoint,
    saveDrawData,
    userId,
  ]);

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
            <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">
              Y.js 실시간 화이트보드
            </h1>
            <p className="text-gray-400">구글독스 수준의 실시간 협업</p>

            {/* ✅ 연결 상태 표시 */}
            {isJoining && (
              <div className="flex items-center justify-center gap-6 text-gray-400">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-yellow-400" />
                  )}
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
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">
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

            {Array.from(cursors.values()).map((cursor, index) => {
              const bg = cursor.userColor || "#374151";
              const fg = getContrastText(bg);

              return (
                <div
                  key={`cursor-${cursor.userId}-${index}`}
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${cursor.x + 10}px`,
                    top: `${cursor.y - 5}px`,
                    transition: "all 0.1s ease-out",
                  }}
                >
                  <div
                    className="text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap"
                    style={{
                      backgroundColor: bg,
                      color: fg,
                      // 가독성 강화(흰 배경일 때 테두리 보강)
                      border:
                        fg === "#000000"
                          ? "1px solid rgba(0,0,0,0.2)"
                          : "1px solid rgba(255,255,255,0.3)",
                      textShadow:
                        fg === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.7)" : "none",
                    }}
                  >
                    {cursor.userName || "Unknown User"}
                  </div>
                </div>
              );
            })}
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
                {users.map((user, index) => (
                  <div
                    key={`user-${user.id}-${index}`} // 고유한 key 생성
                    className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: user.color }}
                    />
                    <span className="text-sm text-white flex-1">
                      {user.name}
                      {user.id === userId && " (나)"}
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
                <div className="text-xs opacity-70">Y.js + WebSocket</div>{" "}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
