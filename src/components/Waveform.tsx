import { useEffect, useRef } from 'react';

interface WaveformProps {
  isActive: boolean;
}

export function Waveform({ isActive }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const draw = () => {
      if (!isActive) return;

      animationRef.current = requestAnimationFrame(draw);

      ctx.fillStyle = '#252525';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barCount = 32;
      const barWidth = canvas.width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        const barHeight =
          Math.sin((i / barCount) * Math.PI * 2 + phase) * 0.3 + 0.5;
        const height = barHeight * canvas.height * 0.7;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#8b5cf6');

        ctx.fillStyle = gradient;
        ctx.fillRect(
          i * (barWidth + 2),
          canvas.height - height,
          barWidth,
          height
        );
      }

      phase += 0.1;
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={352}
      height={60}
      className="w-full h-15 rounded-lg"
    />
  );
}
