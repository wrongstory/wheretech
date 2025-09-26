import { useRef, useState } from "react";
import type { Route } from "../types";
import { Navigation } from "../components/common/Navigation";
import { BackButton } from "../components/common/BackButton";
import { ShaderRenderer } from "../components/shader/ShaderRenderer";

interface ShaderArtGalleryProps {
  onNavigate: (route: Route) => void;
}

interface Pattern {
  name: string;
  color: string;
  description: string;
}

export const ShaderArtGallery: React.FC<ShaderArtGalleryProps> = ({
  onNavigate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPattern, setSelectedPattern] = useState<number>(0);

  const patterns: Pattern[] = [
    {
      name: "플라즈마 웨이브",
      color: "from-blue-500 to-cyan-500",
      description: "사인파 합성으로 만드는 파동 효과",
    },
    {
      name: "프랙탈 만다라",
      color: "from-purple-500 to-pink-500",
      description: "극좌표계 기반 대칭 패턴",
    },
    {
      name: "리퀴드 메탈",
      color: "from-gray-400 to-gray-600",
      description: "유동체 시뮬레이션 효과",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <Navigation currentRoute="shader-art" onNavigate={onNavigate} />
      <BackButton onBack={() => onNavigate("home")} color="blue" />

      <div className="max-w-7xl mx-auto pt-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text">
            WebGL 셰이더 아트 갤러리
          </h1>
          <p className="text-gray-400 text-lg">
            TypeScript로 구현한 실시간 수학적 시각화
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
              <canvas
                ref={canvasRef}
                className="w-full aspect-[4/3] rounded-lg shadow-lg border border-gray-600"
              />
              <ShaderRenderer
                canvasRef={canvasRef}
                selectedPattern={selectedPattern}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">패턴 선택</h2>
              <div className="space-y-4">
                {patterns.map((pattern, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPattern(index)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-300 text-left hover:shadow-lg ${
                      selectedPattern === index
                        ? "border-white bg-gray-700 transform scale-105 shadow-xl"
                        : "border-gray-600 bg-gray-800 hover:border-gray-400"
                    }`}
                  >
                    <div
                      className={`h-12 bg-gradient-to-r ${pattern.color} rounded-lg mb-3 shadow-inner`}
                    ></div>
                    <h3 className="text-white font-medium mb-1">
                      {pattern.name}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {pattern.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">기술 정보</h3>
              <div className="space-y-4 text-gray-300 text-sm">
                <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-blue-400">
                      픽셀 셰이더 시뮬레이션
                    </strong>
                    <br />
                    Canvas ImageData API + TypeScript
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-purple-400">
                      수학적 함수 조합
                    </strong>
                    <br />
                    삼각함수와 극좌표계 활용
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <strong className="text-green-400">실시간 렌더링</strong>
                    <br />
                    60fps 타겟 최적화
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
