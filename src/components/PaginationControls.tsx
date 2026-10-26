import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (num: number) => void;
  isDark: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  isDark,
}) => {
  if (totalPages <= 1 && totalItems <= itemsPerPage) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t ${
        isDark ? "border-[#334155] text-[#94A3B8]" : "border-slate-200 text-slate-600"
      } text-xs font-medium`}
    >
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className={isDark ? "text-[#F1F5F9]" : "text-slate-800"}>{startItem}</strong> -{" "}
          <strong className={isDark ? "text-[#F1F5F9]" : "text-slate-800"}>{endItem}</strong> of{" "}
          <strong className={isDark ? "text-[#F1F5F9]" : "text-slate-800"}>{totalItems}</strong> items
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-[#334155]">
            <span className="text-[11px] opacity-75">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className={`px-2 py-1 rounded-lg border text-xs outline-none cursor-pointer ${
                isDark ? "border-[#334155] bg-[#2C3531] text-[#F1F5F9]" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-xl border flex items-center gap-1 transition-all ${
            currentPage === 1
              ? "opacity-40 cursor-not-allowed border-transparent"
              : isDark
              ? "border-[#334155] hover:bg-[#243347] text-[#F1F5F9]"
              : "border-slate-200 hover:bg-slate-100 text-slate-800"
          }`}
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((p, idx, arr) => {
              const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
              return (
                <React.Fragment key={p}>
                  {showEllipsis && <span className="px-1 opacity-50">...</span>}
                  <button
                    onClick={() => onPageChange(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                      currentPage === p
                        ? "bg-[#116466] text-[#F1F5F9] shadow-sm shadow-[#116466]/30"
                        : isDark
                        ? "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347]"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-xl border flex items-center gap-1 transition-all ${
            currentPage === totalPages
              ? "opacity-40 cursor-not-allowed border-transparent"
              : isDark
              ? "border-[#334155] hover:bg-[#243347] text-[#F1F5F9]"
              : "border-slate-200 hover:bg-slate-100 text-slate-800"
          }`}
          title="Next Page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
