import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface PatternLockProps {
  onPatternComplete: (pattern: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export const PatternLock: React.FC<PatternLockProps> = ({
  onPatternComplete,
  disabled = false,
  error = false,
}) => {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentLineEnd, setCurrentLineEnd] = useState<{ x: number; y: number } | null>(null);

  // 9 dots in a 3x3 grid: 0, 1, 2 / 3, 4, 5 / 6, 7, 8
  const dots = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const getDotCenter = (index: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const dotElement = containerRef.current.querySelector(`[data-dot-index="${index}"]`);
    if (!dotElement) return { x: 0, y: 0 };
    const rect = dotElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    return {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2,
    };
  };

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    setSelectedDots([index]);
    const center = getDotCenter(index);
    setCurrentLineEnd(center);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing || disabled || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      setCurrentLineEnd({
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      });

      // Find if touch is hovering over any dot
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        const dotIndexAttr = el.getAttribute("data-dot-index");
        if (dotIndexAttr !== null) {
          const dotIndex = parseInt(dotIndexAttr, 10);
          if (!isNaN(dotIndex) && !selectedDots.includes(dotIndex)) {
            setSelectedDots((prev) => [...prev, dotIndex]);
            break;
          }
        }
      }
    },
    [isDrawing, disabled, selectedDots]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentLineEnd(null);

    if (selectedDots.length >= 2) {
      onPatternComplete(selectedDots.join("-"));
    }
  }, [isDrawing, selectedDots, onPatternComplete]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleClear = () => {
    setSelectedDots([]);
    setIsDrawing(false);
    setCurrentLineEnd(null);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        className="relative w-64 h-64 select-none touch-none p-4 rounded-3xl bg-[#2C3531] border border-[#334155] shadow-lg"
      >
        {/* SVG connection lines between selected dots */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {selectedDots.map((dotIdx, i) => {
            if (i === 0) return null;
            const from = getDotCenter(selectedDots[i - 1]);
            const to = getDotCenter(dotIdx);
            return (
              <line
                key={`line-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={error ? "#EF4444" : "#116466"}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.9"
              />
            );
          })}
          {isDrawing && selectedDots.length > 0 && currentLineEnd && (
            <line
              x1={getDotCenter(selectedDots[selectedDots.length - 1]).x}
              y1={getDotCenter(selectedDots[selectedDots.length - 1]).y}
              x2={currentLineEnd.x}
              y2={currentLineEnd.y}
              stroke={error ? "#EF4444" : "#D1E8E2"}
              strokeWidth="3"
              strokeDasharray="4 4"
              strokeLinecap="round"
              opacity="0.8"
            />
          )}
        </svg>

        {/* 3x3 Grid of Dots */}
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-4 relative z-20">
          {dots.map((dot) => {
            const isSelected = selectedDots.includes(dot);
            return (
              <div
                key={dot}
                data-dot-index={dot}
                onPointerDown={(e) => handlePointerDown(dot, e)}
                className="flex items-center justify-center cursor-pointer touch-none"
              >
                <div
                  className={`transition-all duration-150 rounded-full flex items-center justify-center ${
                    isSelected
                      ? error
                        ? "w-7 h-7 bg-red-500/20 border-2 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                        : "w-7 h-7 bg-[#116466]/30 border-2 border-[#116466] shadow-[0_0_12px_rgba(17,100,102,0.6)]"
                      : "w-5 h-5 bg-[#334155]/40 hover:bg-[#334155] border border-[#334155]"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-transform ${
                      isSelected
                        ? error
                          ? "bg-red-500 scale-125"
                          : "bg-[#D1E8E2] scale-125"
                        : "bg-[#94A3B8]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDots.length > 0 && !isDrawing && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Redraw pattern</span>
        </button>
      )}
    </div>
  );
};
