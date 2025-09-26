import { useEffect, useRef } from "react";
import type { ShaderColor } from "../../types";

interface ShaderRendererProps {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  selectedPattern: number;
}

export const ShaderRenderer: React.FC<ShaderRendererProps> = ({
  canvasRef,
  selectedPattern,
}) => {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    let time = 0;

    const shaderPatterns: Record<
      number,
      (x: number, y: number, t: number) => ShaderColor
    > = {
      0: (x: number, y: number, t: number): ShaderColor => {
        const nx = (x - 400) / 400;
        const ny = (y - 300) / 300;
        const plasma =
          Math.sin(nx * 10 + t) +
          Math.sin(ny * 10 + t) +
          Math.sin((nx + ny) * 10 + t * 0.5);
        return {
          r: Math.floor(128 + 127 * Math.sin(plasma)),
          g: Math.floor(128 + 127 * Math.sin(plasma + Math.PI / 3)),
          b: Math.floor(128 + 127 * Math.sin(plasma + (2 * Math.PI) / 3)),
        };
      },
      1: (x: number, y: number, t: number): ShaderColor => {
        const nx = (x - 400) / 400;
        const ny = (y - 300) / 300;
        const angle = Math.atan2(ny, nx);
        const radius = Math.sqrt(nx * nx + ny * ny);
        const mandala =
          Math.sin(angle * 15 + t) * Math.cos(radius * 30 - t * 3);
        return {
          r: Math.floor(128 + 127 * Math.sin(mandala + t)),
          g: Math.floor(128 + 127 * Math.sin(mandala + t + Math.PI / 2)),
          b: Math.floor(128 + 127 * Math.sin(mandala + t + Math.PI)),
        };
      },
      2: (x: number, y: number, t: number): ShaderColor => {
        const nx = (x - 400) / 200;
        const ny = (y - 300) / 200;
        const liquid =
          Math.sin(nx * 4 + Math.cos(ny * 3 + t)) +
          Math.cos(ny * 4 + Math.sin(nx * 3 + t * 0.8));
        const metallic = Math.floor(80 + 90 * liquid);
        return {
          r: metallic,
          g: metallic + 40,
          b: metallic + 80,
        };
      },
    };

    const animate = () => {
      time += 0.04;
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      const pattern = shaderPatterns[selectedPattern];

      // 성능 최적화를 위해 2픽셀씩 건너뛰며 처리
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const color = pattern(x, y, time);

          // 2x2 블록으로 색상 적용
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const i = ((y + dy) * canvas.width + (x + dx)) * 4;
              if (i < data.length) {
                data[i] = Math.max(0, Math.min(255, color.r));
                data[i + 1] = Math.max(0, Math.min(255, color.g));
                data[i + 2] = Math.max(0, Math.min(255, color.b));
                data[i + 3] = 255;
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [canvasRef, selectedPattern]);

  return null;
};
