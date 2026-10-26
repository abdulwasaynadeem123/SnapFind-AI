import React from "react";
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  FileText,
  Utensils,
  CreditCard,
  Plane,
  Sparkles,
  Cpu,
} from "lucide-react";
import { Ai3dCanvas } from "./Ai3dCanvas";
import { HeroParticles } from "./HeroParticles";
import { ArcCarousel } from "./ArcCarousel";

interface LandingScreenProps {
  onGetStarted: () => void;
  onTrySearch: (query: string) => void;
  onOpenDemo?: (initialQuery?: string) => void;
  isDark: boolean;
  totalIndexed: number;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onGetStarted,
  onTrySearch,
  onOpenDemo,
}) => {
  return (
    <div className="space-y-12 py-2">
      {/* Hero Section with Blueprint Wireframe Accents & Dark Cyber Teal styling */}
      <div className="relative rounded-3xl border border-[#164E50]/70 bg-gradient-to-b from-[#0A383A]/90 to-[#062426]/95 backdrop-blur-md p-8 sm:p-14 text-center transition-all select-none overflow-hidden shadow-[0_0_35px_rgba(8,45,47,0.6)]">
        {/* Subtle blueprint grid background */}
        <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />

        {/* Blueprint Corner Reticles in Soft Mint */}
        <div className="absolute top-3 left-3 font-mono text-[9px] text-[#D1E8E2]/40 tracking-widest pointer-events-none">
          + [SYS_01 // VISUAL_ENGINE]
        </div>
        <div className="absolute top-3 right-3 font-mono text-[9px] text-[#D1E8E2]/40 tracking-widest pointer-events-none">
          [MODE // ENCRYPTED_LOCAL] +
        </div>
        <div className="absolute bottom-3 left-3 font-mono text-[9px] text-[#D1E8E2]/40 tracking-widest pointer-events-none">
          + [OCR // LOCAL_MULTIMODAL]
        </div>
        <div className="absolute bottom-3 right-3 font-mono text-[9px] text-[#D1E8E2]/40 tracking-widest pointer-events-none">
          [LATENCY // FAST_SEARCH] +
        </div>

        {/* Reversible particle/petal canvas animation (respects prefers-reduced-motion) */}
        <HeroParticles className="opacity-60" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono border border-[#116466]/60 bg-[#062426]/90 backdrop-blur-xs text-[#D1E8E2]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D1E8E2] animate-pulse" />
            <span className="tracking-wide">AI-Powered Visual Memory &amp; Semantic Retrieval</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F1F5F9] leading-[1.15]">
            Stop Scrolling. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#D1E8E2] to-[#80C2B9] drop-shadow-[0_0_20px_rgba(17,100,102,0.35)]">
              Find Any Screenshot in Seconds.
            </span>
          </h1>

          {/* Neural Canvas visual */}
          <div className="w-full max-w-md mx-auto my-1">
            <Ai3dCanvas height="h-52 sm:h-60" />
          </div>

          {/* Subheadline */}
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            SnapFind indexes every word, date, price, and object inside your saved screenshots.
            Ask naturally like talking to a human, and retrieve the exact screenshot instantly.
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              onClick={() => (onOpenDemo ? onOpenDemo() : onTrySearch(""))}
              id="hero-try-demo-btn"
              type="button"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-[#1B5254] bg-[#07292B] hover:bg-[#0C3B3D] text-[#F1F5F9] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-98 shadow-md"
            >
              <span className="w-2 h-2 rounded-full bg-[#D1E8E2] animate-ping" />
              <span>Try Interactive Demo</span>
            </button>

            <button
              onClick={onGetStarted}
              id="hero-get-started-btn"
              type="button"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#116466]/40 hover:scale-[1.02] active:scale-98"
            >
              <span>Open My Vault</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Quick Natural Queries */}
          <div className="pt-6 border-t border-[#164E50]/50">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#D1E8E2]/70 mb-3">
              <Cpu className="w-3.5 h-3.5 text-[#D1E8E2]" />
              <span>TEST NEURAL QUERIES IN REAL TIME:</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: "Show passport photo saved last week", icon: FileText },
                { label: "Find the pizza recipe I downloaded", icon: Utensils },
                { label: "Show electricity bill due amount", icon: CreditCard },
                { label: "Find flight ticket confirmation", icon: Plane },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => (onOpenDemo ? onOpenDemo(label) : onTrySearch(label))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#164E50]/60 bg-[#062426]/80 text-slate-300 hover:text-white hover:border-[#116466] hover:bg-[#0B3537] text-xs transition-all cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                  <span>"{label}"</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Arc Carousel Section */}
      <div className="relative rounded-3xl border border-[#164E50]/60 bg-gradient-to-b from-[#0A383A]/85 to-[#051F21]/90 backdrop-blur-md p-6 sm:p-8 shadow-[0_0_30px_rgba(8,45,47,0.4)]">
        <div className="text-center max-w-xl mx-auto mb-2 space-y-1">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#D1E8E2]/80 uppercase">
            Auto-Curated Albums
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Smart Collections
          </h2>
          <p className="text-xs text-slate-300">
            Screenshots automatically organized by content, dates, and sensitive vault rules.
          </p>
        </div>

        {/* 3D Arc Carousel Component */}
        <ArcCarousel
          collections={[]}
          onSelectCollection={(name) => {
            if (onOpenDemo) onOpenDemo(name);
          }}
        />
      </div>

      {/* Relatable Category Highlights with Darker Cyber Teal Styling */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#D1E8E2]/80 uppercase">
            Vault Architecture
          </span>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            Enterprise-Grade Privacy &amp; OCR Engine
          </h2>
          <p className="text-xs text-slate-300">
            Your screenshots automatically categorized, parsed, and protected locally.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative p-5 rounded-2xl border border-[#164E50]/50 bg-[#07282A]/90 backdrop-blur-xs space-y-2.5 hover:border-[#116466] hover:bg-[#0B3739] transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#0B3537] border border-[#164E50] flex items-center justify-center text-[#D1E8E2] group-hover:border-[#116466] transition-all">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Bills &amp; Invoices</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Extracts due dates, account numbers, and amounts due automatically.
            </p>
            <span className="inline-block text-[10px] font-mono text-[#D1E8E2]/60">AUTO-PARSED · ZERO MANUAL WORK</span>
          </div>

          <div className="relative p-5 rounded-2xl border border-[#164E50]/50 bg-[#07282A]/90 backdrop-blur-xs space-y-2.5 hover:border-[#116466] hover:bg-[#0B3739] transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#0B3537] border border-[#164E50] flex items-center justify-center text-[#D1E8E2] group-hover:border-[#116466] transition-all">
              <Plane className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Travel &amp; Passes</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Locates airline bookings, gate updates, and itinerary confirmations.
            </p>
            <span className="inline-block text-[10px] font-mono text-[#D1E8E2]/60">FLIGHTS · HOTELS · DATES</span>
          </div>

          <div className="relative p-5 rounded-2xl border border-[#164E50]/50 bg-[#07282A]/90 backdrop-blur-xs space-y-2.5 hover:border-[#116466] hover:bg-[#0B3739] transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#0B3537] border border-[#164E50] flex items-center justify-center text-[#D1E8E2] group-hover:border-[#116466] transition-all">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Private Vault</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sensitive screenshots are automatically blurred and secured behind biometric locks.
            </p>
            <span className="inline-block text-[10px] font-mono text-[#D1E8E2]/60">ZERO KNOWLEDGE · ENCRYPTED</span>
          </div>

          <div className="relative p-5 rounded-2xl border border-[#164E50]/50 bg-[#07282A]/90 backdrop-blur-xs space-y-2.5 hover:border-[#116466] hover:bg-[#0B3739] transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#0B3537] border border-[#164E50] flex items-center justify-center text-[#D1E8E2] group-hover:border-[#116466] transition-all">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Instant Offline OCR</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Fast local indexing with zero cloud telemetry required.
            </p>
            <span className="inline-block text-[10px] font-mono text-[#D1E8E2]/60">INDEXED LOCALLY · 100% PRIVATE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
