import type React from "react";
import type { Route } from "../../types";
import { Camera, Home, Palette, Sparkles } from "lucide-react";

interface NavigationProps {
  currentRoute: Route;
  onNavigate: (route: Route) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const navItems = [
    { id: "home" as Route, label: "홈", icon: <Home className="w-5 h-5" /> },
    {
      id: "3d-portfolio" as Route,
      label: "3D 포트폴리오",
      icon: <Camera className="w-5 h-5" />,
    },
    {
      id: "shader-art" as Route,
      label: "셰이더 아트",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: "whiteboard" as Route,
      label: "화이트보드",
      icon: <Palette className="w-5 h-5" />,
    },
  ];

  if (currentRoute === "home") return null;

  return (
    <nav className="fixed top-4 left-4 z-50 bg-gray-800/90 backdrop-blur-lg rounded-xl p-2 border border-gray-700">
      <div className="flex gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              currentRoute === item.id
                ? "bg-blue-600 text-white shadow-lg scale-110"
                : "text-gray-400 hover:text-white hover:bg-gray-700 hover:scale-105"
            }`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </nav>
  );
};
