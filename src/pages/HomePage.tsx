import { useState } from "react";
import type { Project, Route } from "../types";
import { Camera, Palette, Sparkles } from "lucide-react";
interface HomePageProps {
  onNavigate: (route: Route) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const projects: Project[] = [
    {
      id: "3d-portfolio",
      title: "3D 인터랙티브 포트폴리오",
      description: "Three.js 기반 3D 경험",
      icon: <Camera className="w-8 h-8" />,
      gradient: "from-purple-500 to-pink-500",
      tech: ["Three.js", "WebGL", "TypeScript"],
      features: ["파티클 시스템", "마우스 인터랙션", "3D 애니메이션"],
    },
    {
      id: "shader-art",
      title: "WebGL 셰이더 아트",
      description: "수학으로 만드는 시각 예술",
      icon: <Sparkles className="w-8 h-8" />,
      gradient: "from-blue-500 to-cyan-500",
      tech: ["WebGL", "GLSL", "Canvas"],
      features: ["실시간 렌더링", "수학적 패턴", "픽셀 셰이더"],
    },
    {
      id: "whiteboard",
      title: "실시간 협업 화이트보드",
      description: "멀티유저 실시간 드로잉",
      icon: <Palette className="w-8 h-8" />,
      gradient: "from-green-500 to-emerald-500",
      tech: ["Canvas", "WebSocket", "WebRTC"],
      features: ["실시간 협업", "드로잉 도구", "사용자 관리"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-8">
      <div className="max-w-7xl w-full">
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            최신 프론트엔드 기술
          </h1>
          <p className="text-xl text-gray-300 mb-4">
            TypeScript + Tailwind CSS 4 기반 모던 웹 개발
          </p>
          <div className="flex items-center justify-center gap-4 text-gray-400 mb-8">
            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
              Vite
            </span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
              React 19
            </span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
              TypeScript
            </span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
              Tailwind CSS 4
            </span>
          </div>
          <div className="w-32 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`relative group cursor-pointer transform transition-all duration-500 hover:scale-105 hover:-translate-y-4 ${
                hoveredCard === project.id ? "z-10" : ""
              }`}
              onMouseEnter={() => setHoveredCard(project.id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => onNavigate(project.id as Route)}
            >
              <div
                className={`bg-gradient-to-br ${project.gradient} p-1 rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow`}
              >
                <div className="bg-gray-800 rounded-xl p-8 h-full">
                  <div className="text-white mb-6 transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-5">
                    {project.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    {project.title}
                  </h3>
                  <p className="text-gray-300 mb-6">{project.description}</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.tech.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 transition-colors"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-400 mb-2">
                      주요 기능
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {project.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transform transition-all duration-200 hover:scale-105 hover:from-purple-500 hover:to-pink-500">
                    체험하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
