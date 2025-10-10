"use client"
import { motion } from 'framer-motion';

export default function Loading() {
  const dots = 8;
  const radius = 20;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="relative h-20 w-20">
        {[...Array(dots)].map((_, index) => {
          const angle = (index / dots) * (2 * Math.PI);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);

          return (
            <motion.div
              key={index}
              className="absolute h-3 w-3 rounded-full bg-blue-500"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: (index / dots) * 0.8,
                ease: 'easeInOut',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
