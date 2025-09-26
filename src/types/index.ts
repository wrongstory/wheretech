export interface User {
  id: number;
  name: string;
  color: string;
  active: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  tech: string[];
  features: string[];
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface ShaderColor {
  r: number;
  g: number;
  b: number;
}

export type Route = "home" | "3d-portfolio" | "shader-art" | "whiteboard";
export type Tool = "pen" | "eraser" | "text";
