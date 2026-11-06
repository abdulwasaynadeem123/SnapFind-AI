import React, { useState, useEffect } from "react";
import { X, MessageSquare, Send, CheckCircle2, AlertCircle, Sparkles, Bug, Loader2 } from "lucide-react";
import { FeedbackType, UserProfile } from "../../types";
import { FeedbackService } from "../../services/feedbackService";

interface GiveFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  user: UserProfile | null;
  isDark?: boolean;
  onSubmitted?: () => void;
}

const FEEDBACK_TYPES: Array<{ type: FeedbackType; label: string; icon: any }> = [
  { type: "Bug Report", label: "Bug Report", icon: Bug },
  { type: "Feature Request", label: "Feature Request", icon: Sparkles },
  { type: "Other", label: "General Feedback", icon: MessageSquare },
];

export const GiveFeedbackModal: React.FC<GiveFeedbackModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  user,
  isDark = true,
  onSubmitted,
}) => {
  const [selectedType, setSelectedType] = useState<FeedbackType>("Feature Request");
  const [message, setMessage] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSuccess(false);
      setMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please enter your message.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const isFounder = Boolean(user?.entitlement?.isFounder);
      const res = await FeedbackService.submitFeedback(
        {
          type: selectedType,
          description: message.trim(),
          page: currentPage,
          user_email: user?.email || guestEmail.trim() || undefined,
        },
        user,
        isFounder
      );

      if (res.success) {
        setIsSuccess(true);
        if (onSubmitted) {
          onSubmitted();
        }
        setTimeout(() => {
          setIsSuccess(false);
          setMessage("");
          onClose();
        }, 1500);
      } else {
        setErrorMsg("Could not submit feedback. Please try again.");
      }
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="feedback-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        id="feedback-modal-container"
        className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? "bg-[#1E293B] text-[#F1F5F9] border-[#334155]"
            : "bg-white text-slate-900 border-slate-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#334155]">
          <h2 className="text-lg font-bold tracking-tight text-[#F1F5F9]">
            Feedback
          </h2>
          <button
            id="feedback-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#0B0F19] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#F1F5F9]">Thank You!</h3>
              <p className="text-xs text-[#94A3B8]">
                Your feedback has been received.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Feedback Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                Feedback Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FEEDBACK_TYPES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedType === cat.type;
                  return (
                    <button
                      type="button"
                      key={cat.type}
                      onClick={() => setSelectedType(cat.type)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-[#116466] text-[#F1F5F9] border-[#116466] font-bold shadow-md shadow-[#116466]/20"
                          : "bg-[#0B0F19]/60 text-[#94A3B8] border-[#334155] hover:border-[#116466] hover:text-[#F1F5F9]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                Message
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened or what would you like to see?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#334155] focus:border-[#116466] text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 outline-none resize-none transition-colors"
                required
              />
            </div>

            {/* Email input for guest users */}
            {!user?.isLoggedIn && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Your Email (Optional)
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="name@example.com for follow-up"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F19]/80 border border-[#334155] focus:border-[#116466] text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 outline-none transition-colors"
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="px-5 py-2 rounded-xl bg-[#116466] hover:bg-[#116466]/90 disabled:opacity-50 disabled:pointer-events-none text-[#F1F5F9] text-xs font-bold transition-all shadow-md shadow-[#116466]/20 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
