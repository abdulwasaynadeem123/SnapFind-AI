import React, { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Smartphone,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PaymentRequest, UserProfile } from "../../types";
import { ManualPaymentService } from "../../services/billing/ManualPaymentService";

interface PaymentHistoryCardProps {
  user: UserProfile | null;
  isDark: boolean;
  onOpenUpgradeModal?: () => void;
  addToast?: (toast: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

export const PaymentHistoryCard: React.FC<PaymentHistoryCardProps> = ({
  user,
  isDark,
  onOpenUpgradeModal,
  addToast,
}) => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user || user.id === "guest" || user.id.startsWith("local-guest")) {
      setRequests([]);
      return;
    }

    try {
      setLoading(true);
      const list = await ManualPaymentService.getMyPaymentRequests(user.id);
      setRequests(list);
    } catch (e) {
      console.warn("[PaymentHistory] Error fetching:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id]);

  if (!user || user.id === "guest" || user.id.startsWith("local-guest") || requests.length === 0) {
    return null;
  }

  return (
    <div
      id="manual-payment-history-card"
      className="rounded-3xl border border-[#30362E] p-5 bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#B7F36B] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#F7F8F5]">Manual Payment History</h4>
            <p className="text-xs text-[#A5AAA1]">
              Your Lifetime Pro payment confirmation submissions
            </p>
          </div>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 rounded-xl text-xs font-medium transition-colors flex items-center space-x-1 hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] border border-transparent hover:border-[#30362E]"
          title="Refresh payment status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {requests.map((req) => {
          const reqId = req.id;
          const status = req.status;
          const isExpanded = expandedId === reqId;
          const method = req.payment_method || req.paymentMethod || "manual";
          const txId = req.transaction_id || req.transactionId;
          const dateStr = new Date(req.submitted_at || req.submittedAt || req.created_at || Date.now()).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={reqId}
              className="rounded-2xl border border-[#30362E] overflow-hidden bg-[#0D0F0D] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] transition-colors"
            >
              {/* Main Summary Bar */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : reqId)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#1B1F1A]/40 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                    {method === "easypaisa" ? <Smartphone className="w-4 h-4 text-[#B7F36B]" /> : <Building2 className="w-4 h-4 text-[#B7F36B]" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#F7F8F5]">Lifetime Pro (PKR 7,999)</span>
                      <span className="text-[10px] text-[#777E74] capitalize">• {method.replace("_", " ")}</span>
                    </div>
                    <p className="text-[11px] font-mono text-[#A5AAA1]">TRX: {txId}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Status Badge */}
                  {status === "pending" && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E] flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-[#B7F36B] animate-pulse" />
                      <span>Pending Review</span>
                    </span>
                  )}
                  {status === "approved" && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-[#B7F36B]" />
                      <span>Approved</span>
                    </span>
                  )}
                  {status === "rejected" && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1B1F1A] text-red-400 border border-red-500/20 flex items-center space-x-1">
                      <XCircle className="w-3 h-3" />
                      <span>Rejected</span>
                    </span>
                  )}

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#A5AAA1]" /> : <ChevronDown className="w-4 h-4 text-[#A5AAA1]" />}
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-3.5 border-t border-[#30362E] text-xs space-y-2.5 bg-[#141714] text-[#A5AAA1]"
                  >
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#777E74] block">Submitted At</span>
                        <span className="font-medium text-[#F7F8F5]">{dateStr}</span>
                      </div>
                      <div>
                        <span className="text-[#777E74] block">Sender Account</span>
                        <span className="font-medium text-[#F7F8F5]">{req.sender_account || req.senderAccount || "-"}</span>
                      </div>
                      {req.sender_name && (
                        <div>
                          <span className="text-[#777E74] block">Sender Name</span>
                          <span className="font-medium text-[#F7F8F5]">{req.sender_name}</span>
                        </div>
                      )}
                      {req.verified_at && (
                        <div>
                          <span className="text-[#777E74] block">Verified At</span>
                          <span className="font-medium text-[#F7F8F5]">{new Date(req.verified_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {status === "rejected" && (
                      <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-red-500/30 text-red-400 text-xs">
                        <span className="font-bold block mb-0.5">Rejection Reason:</span>
                        <span>{req.rejection_reason || req.rejectionReason || "Payment could not be verified in bank records."}</span>
                        {onOpenUpgradeModal && (
                          <button
                            onClick={onOpenUpgradeModal}
                            className="mt-2 text-xs font-bold underline block text-[#B7F36B] hover:text-[#A5E65A]"
                          >
                            Resubmit with correct Transaction ID →
                          </button>
                        )}
                      </div>
                    )}

                    {status === "approved" && (
                      <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] text-xs flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-[#B7F36B]" />
                        <span>Lifetime Pro is permanently active with unlimited screenshot indexing!</span>
                      </div>
                    )}

                    {status === "pending" && (
                      <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1] text-xs flex items-center space-x-2">
                        <Clock className="w-4 h-4 flex-shrink-0 text-[#B7F36B]" />
                        <span>Our verification team checks bank & Easypaisa statements regularly. Average turnaround is 15-60 mins.</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
