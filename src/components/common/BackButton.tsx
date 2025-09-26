import { Home } from "lucide-react";

interface BackButtonProps {
  onBack: () => void;
  color?: "blue" | "purple" | "green";
}

export const BackButton: React.FC<BackButtonProps> = ({
  onBack,
  color = "blue",
}) => {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25",
    purple: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/25",
    green: "bg-green-600 hover:bg-green-700 shadow-green-500/25",
  };

  return (
    <button
      aria-label="뒤로가기"
      type="button"
      onClick={onBack}
      className={`fixed top-4 right-4 z-50 p-3 ${colorClasses[color]} text-white rounded-full transition-all duration-200 shadow-lg hover:scale-110`}
    >
      <Home className="w-6 h-6" />
    </button>
  );
};
