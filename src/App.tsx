import { useCallback, useState, type JSX } from "react";
import "./App.css";
import type { Route } from "./types";
import { ThreeDPortfolio } from "./pages/ThreeDPortfolio";
import { ShaderArtGallery } from "./pages/ShaderArtGallerty";
import { HomePage } from "./pages/HomePage";
import Whiteboard from "./pages/Whiteboard";

function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>("home");

  const handleNavigate = useCallback((route: Route) => {
    setCurrentRoute(route);
  }, []);

  const renderRoute = (): JSX.Element => {
    switch (currentRoute) {
      case "home":
        return <HomePage onNavigate={handleNavigate} />;
      case "3d-portfolio":
        return <ThreeDPortfolio onNavigate={handleNavigate} />;
      case "shader-art":
        return <ShaderArtGallery onNavigate={handleNavigate} />;
      case "whiteboard":
        return <Whiteboard />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 font-sans antialiased">
      {renderRoute()}
    </div>
  );
}

export default App;
