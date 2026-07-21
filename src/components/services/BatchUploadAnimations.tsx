import React, { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
}

interface BatchUploadAnimationsProps {
  isActive: boolean;
  onComplete?: boolean;
  sourceRef?: React.RefObject<HTMLElement>;
  targetRef?: React.RefObject<HTMLElement>;
}

const getTokenColor = (token: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : 'currentColor';
};

export const BatchUploadAnimations: React.FC<BatchUploadAnimationsProps> = ({
  isActive,
  onComplete = false,
  sourceRef,
  targetRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const confettiRef = useRef<ConfettiParticle[]>([]);
  const animationFrameRef = useRef<number>();

  const createParticle = useCallback((sourceRect: DOMRect, targetRect: DOMRect): Particle => {
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + Math.random() * targetRect.width;
    const endY = targetRect.top + targetRect.height / 2;

    const angle = Math.atan2(endY - startY, endX - startX);
    const speed = 2 + Math.random() * 2;

    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 60 + Math.random() * 40,
      color: getTokenColor('--primary'),
      size: 2 + Math.random() * 3
    };
  }, []);

  const createConfetti = useCallback((x: number, y: number): ConfettiParticle => {
    const colors = ['--primary', '--info', '--success', '--warning', '--danger'].map(getTokenColor);

    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 10 - 5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 6,
      life: 100
    };
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life++;

      const alpha = 1 - (particle.life / particle.maxLife);
      
      if (alpha > 0) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        return true;
      }
      return false;
    });

    // Update and draw confetti
    confettiRef.current = confettiRef.current.filter(confetti => {
      confetti.x += confetti.vx;
      confetti.y += confetti.vy;
      confetti.vy += 0.3; // gravity
      confetti.rotation += confetti.rotationSpeed;
      confetti.life--;

      if (confetti.life > 0) {
        ctx.save();
        ctx.translate(confetti.x, confetti.y);
        ctx.rotate((confetti.rotation * Math.PI) / 180);
        ctx.fillStyle = confetti.color;
        ctx.fillRect(-confetti.size / 2, -confetti.size / 2, confetti.size, confetti.size / 3);
        ctx.restore();
        return true;
      }
      return false;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    if (isActive && sourceRef?.current && targetRef?.current) {
      const sourceRect = sourceRef.current.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();

      const interval = setInterval(() => {
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push(createParticle(sourceRect, targetRect));
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isActive, sourceRef, targetRef, createParticle]);

  useEffect(() => {
    if (onComplete && canvasRef.current) {
      const canvas = canvasRef.current;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const timeoutIds: ReturnType<typeof setTimeout>[] = [];
      for (let i = 0; i < 50; i++) {
        const id = setTimeout(() => {
          confettiRef.current.push(createConfetti(centerX, centerY));
        }, i * 20);
        timeoutIds.push(id);
      }
      return () => {
        timeoutIds.forEach((id) => clearTimeout(id));
      };
    }
  }, [onComplete, createConfetti]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
