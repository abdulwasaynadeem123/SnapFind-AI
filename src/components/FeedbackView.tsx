import React, { useState, useEffect } from "react";
import {
  Bug,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { FeedbackItem, FeedbackType, UserProfile, ScreenshotItem } from "../types";
import { FeedbackService } from "../services/feedbackService";
import { PageHeroHeader } from "./PageHeroHeader";

interface FeedbackViewProps {
  isDark: boolean;
  currentUser?: UserProfile | null;
  screenshots?: ScreenshotItem[];
  onNavigate?: (view: any) => void;
  preselectedType?: FeedbackType;
  initialFounderPrompt?: boolean;
}

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: any }[] = [
  { id: "Bug Report", label: "Bug Report", icon: Bug },
  { id: "Feature Request", label: "Feature Request", icon: Sparkles },
  { id: "Other", label: "General Feedback", icon: MessageSquare },
];

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  isDark = true,
  currentUser,
  preselectedType,
}) => {
  const [selectedType, setSelectedType] = useState<FeedbackType>(
    preselectedType || "Feature Request"
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pastFeedback, setPastFeedback] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    const loadPast = async () => {
      try {
        const items = await FeedbackService.getUserFeedback(currentUser?.id || "guest");
        setPastFeedback(items);
      } catch {}
    };
    loadPast();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please enter your message.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await FeedbackService.submitFeedback(
        {
          type: selectedType,
          description: message.trim(),
          user_email: email.trim() || undefined,
        },
        currentUser
      );

      if (res.success) {
        setSubmittedSuccess(true);
        setMessage("");
        if (res.item) {
          setPastFeedback((prev) => [res.item, ...prev]);
        }
      } else {
        setErrorMsg("Failed to send feedback. Please try again.");
      }
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 px-3 sm:px-4">
      <PageHeroHeader
        type="feedback"
        title="Feedback"
        isDark={isDark}
      />

      {submittedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Thank you for your feedback! We review every submission.</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmittedSuccess(false)}
            className="text-xs underline font-semibold text-emerald-300 hover:text-white cursor-pointer"
          >
            Send another
          </button>
        </div>
      )}

      {/* Main Feedback Form Card */}
      <div className="bg-[#141714] rounded-2xl p-6 border border-[#30362E] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Feedback Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A5AAA1]">
              Feedback Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {FEEDBACK_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedType(item.id)}
                    className={`flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#B7F36B] border-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                        : "bg-[#1B1F1A] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#222720]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Message Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A5AAA1]">
              Message
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what happened, what worked well, or what you'd like to see improved..."
              className="w-full px-4 py-3 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] text-sm text-[#F7F8F5] placeholder-[#777E74] transition-colors outline-none resize-y shadow-[inset_3px_3px_6px_rgba(0,0,0,0.65)]"
              required
            />
          </div>

          {/* 3. Contact Email (Optional if not logged in) */}
          {!currentUser?.isLoggedIn && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#A5AAA1]">
                Your Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com for follow-up"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] text-xs text-[#F7F8F5] placeholder-[#777E74] transition-colors outline-none shadow-[inset_3px_3px_6px_rgba(0,0,0,0.65)]"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 4. Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] disabled:opacity-50 disabled:pointer-events-none text-[#10130D] text-xs font-bold transition-all shadow-[2px_2px_8px_rgba(0,0,0,0.4)] flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 5. Past Feedback Submissions (if any) */}
      {pastFeedback.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A5AAA1]">
            Your Previous Submissions
          </h3>
          <div className="space-y-2.5">
            {pastFeedback.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#141714] border border-[#30362E] text-xs space-y-1.5 shadow-[2px_2px_6px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/30">
                    {item.type}
                  </span>
                  <span className="text-[#777E74] text-[10px]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[#F7F8F5] leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackView;
