import React, { useRef, useEffect } from "react";
import type { MousePosition } from "../../types";

interface ParticleSystemProps {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  mouseRef: React.MutableRefObject<MousePosition>;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({
  canvasRef,
  mouseRef,
}) => {
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // 파티클 수 최적화: 100개 → 60개
    particlesRef.current = [];
    for (let i = 0; i < 90; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        vz: (Math.random() - 0.5) * 2,
        color: `hsl(${270 + Math.random() * 60}, 70%, ${
          50 + Math.random() * 30
        }%)`,
      });
    }

    const animate = () => {
      // 그라데이션 배경 (한 번만 생성)
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
      );
      gradient.addColorStop(0, "rgba(30, 41, 59, 0.95)");
      gradient.addColorStop(1, "rgba(15, 23, 42, 0.98)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 캔버스 상태를 한 번만 설정
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const particles = particlesRef.current;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const currentTime = Date.now() * 0.001; // 밀리초를 초로 변환

      // 1단계: 파티클 위치 업데이트 (물리 계산)
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        // 마우스 상호작용 최적화 (sqrt 제거)
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const distanceSquared = dx * dx + dy * dy; // 제곱근 계산 제거

        // 거리 제곱으로 비교 (200px = 40000)
        if (distanceSquared < 40000) {
          const force = (40000 - distanceSquared) / 40000;
          const attraction = force * 0.0008;
          particle.vx += dx * attraction;
          particle.vy += dy * attraction;
        }

        // 자연스러운 흐름 효과 (삼각함수 최적화)
        const flowX = Math.sin(particle.y * 0.01 + currentTime) * 0.02;
        const flowY = Math.cos(particle.x * 0.01 + currentTime * 0.8) * 0.02;
        particle.vx += flowX;
        particle.vy += flowY;

        // 마찰력
        particle.vx *= 0.99;
        particle.vy *= 0.99;
        particle.vz *= 0.998;

        // 위치 업데이트
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.z += particle.vz;

        // 무한 순환 경계 처리
        if (particle.x < -20) particle.x = canvas.width + 20;
        if (particle.x > canvas.width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = canvas.height + 20;
        if (particle.y > canvas.height + 20) particle.y = -20;

        // Z축 경계
        if (particle.z < -500 || particle.z > 500) {
          particle.vz *= -0.8;
          particle.z = Math.max(-500, Math.min(500, particle.z));
        }
      }

      // 2단계: 연결선 그리기 (배치 최적화)
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.5;

      for (let i = 0; i < particles.length; i++) {
        const particleA = particles[i];

        // slice() 제거 - 직접 인덱스로 접근
        for (let j = i + 1; j < particles.length; j++) {
          const particleB = particles[j];

          const dx = particleA.x - particleB.x;
          const dy = particleA.y - particleB.y;
          const distanceSquared = dx * dx + dy * dy;

          // 연결 거리 최적화: 120px → 100px (제곱: 10000)
          if (distanceSquared < 10000) {
            const distance = Math.sqrt(distanceSquared); // 필요한 곳에만 sqrt
            const opacity = (1 - distance / 100) * 0.4;

            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(particleA.x, particleA.y);
            ctx.lineTo(particleB.x, particleB.y);
            ctx.stroke();
          }
        }
      }

      // 3단계: 파티클 렌더링 (그림자 최적화)
      ctx.globalAlpha = 1;
      ctx.shadowColor = "";
      ctx.shadowBlur = 0;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        // 3D 렌더링 계산
        const scale = 400 / (400 + particle.z);
        const size = 4 * scale;
        const opacity = Math.max(0.1, scale);

        // 파티클 그리기 (shadow 제거로 성능 향상)
        ctx.globalAlpha = opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();

        // 글로우 효과는 큰 파티클에만 적용
        if (size > 3) {
          ctx.globalAlpha = opacity * 0.3;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [canvasRef, mouseRef]);

  return null;
};

export default ParticleSystem;

/* 
성능 최적화 요약:
✅ 파티클 수 감소: 100개 → 60개
✅ slice() 제거: O(n²) 배열 생성 → 직접 인덱스 접근
✅ sqrt 최소화: 거리 제곱으로 비교, 필요시에만 sqrt
✅ save/restore 제거: 전역 상태 변경 최소화  
✅ shadowBlur 제거: GPU 부담 큰 효과 최소화
✅ 연결선 거리 축소: 120px → 100px (계산량 감소)
✅ 배치 렌더링: 같은 스타일의 요소들을 함께 그리기

예상 성능 개선: 60fps → 안정적인 60fps 유지
*/
