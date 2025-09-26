import { useCallback, useEffect, useRef, useState } from "react";
import type { MousePosition, Route } from "../types";
import { Navigation } from "../components/common/Navigation";
import { BackButton } from "../components/common/BackButton";
import { Mouse, Zap } from "lucide-react";
import ParticleSystem from "../components/3d/ParticleSystem";

interface ThreeDPortfolioProps {
  onNavigate: (route: Route) => void;
}

export const ThreeDPortfolio: React.FC<ThreeDPortfolioProps> = ({
  onNavigate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<MousePosition>({ x: 0, y: 0 });
  const [modalVisible, setModalVisible] = useState<boolean>(true);

  // 2초 후 모달 페이드아웃
  useEffect(() => {
    const timer = setTimeout(() => {
      setModalVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  return (
    <div
      className="min-h-screen bg-gray-900 relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <ParticleSystem canvasRef={canvasRef} mouseRef={mouseRef} />

      <Navigation currentRoute="3d-portfolio" onNavigate={onNavigate} />
      <BackButton onBack={() => onNavigate("home")} color="purple" />

      {/* 페이드아웃 모달 */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pointer-events-none">
        <div
          className={`text-center bg-gray-800/80 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20 max-w-2xl shadow-2xl transition-all duration-1000 ${
            modalVisible
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <h1 className="text-5xl font-bold text-white mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            3D 인터랙티브 포트폴리오
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            마우스를 움직여보세요 - 파티클들이 반응합니다
          </p>
          <div className="grid grid-cols-2 gap-6 text-gray-400 mb-8">
            <div className="flex items-center justify-center gap-3 p-4 bg-gray-700/50 rounded-lg">
              <Mouse className="w-6 h-6 text-purple-400" />
              <span>마우스 상호작용</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 bg-gray-700/50 rounded-lg">
              <Zap className="w-6 h-6 text-purple-400" />
              <span>실시간 물리 엔진</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 bg-gray-900/50 p-4 rounded-lg">
            <strong className="text-purple-400">사용 기술:</strong> Canvas API,
            TypeScript, 3D 수학, 파티클 시스템, 실시간 애니메이션
          </div>

          {/* 자동 사라짐 힌트 */}
          <div className="mt-6 text-xs text-gray-600 animate-pulse">
            이 메시지는 곧 사라집니다...
          </div>
        </div>
      </div>
    </div>
  );
};
