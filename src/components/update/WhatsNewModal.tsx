import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, X, ArrowRight, ShieldCheck } from "lucide-react";
import { formatVersionDisplay } from "../../config/version";
import { SnapFindLogo } from "../SnapFindLogo";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose, version }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-3xl bg-[#141714] border border-[#30362E] shadow-2xl overflow-hidden text-[#F7F8F5]"
        >
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#B7F36B]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#1B1F1A] border border-[#30362E] shrink-0">
                <SnapFindLogo className="w-7 h-7 rounded-xl" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B7F36B] px-2 py-0.5 rounded-full bg-[#1B1F1A] border border-[#30362E]">
                  Update Successful
                </span>
                <h3 className="text-lg font-black text-[#F7F8F5] mt-1">
                  SnapFind updated to {formatVersionDisplay(version)}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] space-y-2.5 text-xs text-[#A5AAA1]">
              <div className="font-bold text-[#F7F8F5] flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B7F36B]" />
                <span>What's New in this release:</span>
              </div>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-start gap-2">
                  <span className="text-[#B7F36B] font-bold">•</span>
                  <span>Faster offline indexing and optical character recognition</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B7F36B] font-bold">•</span>
                  <span>Enhanced duplicate detection and gallery cache acceleration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B7F36B] font-bold">•</span>
                  <span>Automatic app update notifications and release checks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#B7F36B] font-bold">•</span>
                  <span>Full data preservation across your screenshots, collections, and settings</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#A5AAA1]">
              <ShieldCheck className="w-4 h-4 text-[#B7F36B] shrink-0" />
              <span>All your indexed data, collections, and settings are up to date.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
