import React, { useEffect, useState } from "react";
import { Search, Image as ImageIcon, UserPlus, LogIn } from "lucide-react";
import { SnapFindLogo } from "./SnapFindLogo";

const REMOTE_HERO_BACKGROUND =
  "https://img.magnific.com/premium-photo/black-green-technological-background-generated-by-ai_1127-20762.jpg?semt=ais_hybrid&w=740&q=80";
const LOCAL_HERO_BACKGROUND = "/hero-tech-bg.jpg";

interface LandingScreenProps {
  onSignUp: () => void;
  onSignIn: () => void;
  onNavigateToSearch: () => void;
  onNavigateToGallery: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onSignUp,
  onSignIn,
  onNavigateToSearch,
  onNavigateToGallery,
}) => {
  const [heroBackgroundUrl, setHeroBackgroundUrl] = useState<string>(
    REMOTE_HERO_BACKGROUND
  );

  useEffect(() => {
    let active = true;
    const probe = new window.Image();

    probe.onerror = () => {
      if (active) {
        setHeroBackgroundUrl(LOCAL_HERO_BACKGROUND);
      }
    };

    probe.src = REMOTE_HERO_BACKGROUND;

    return () => {
      active = false;
      probe.onerror = null;
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto py-2 sm:py-6 px-1 sm:px-2">
      <section
        aria-label="SnapFind AI Hero"
        style={{
          backgroundColor: "#080908",
          backgroundImage: `url("${heroBackgroundUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className="relative overflow-hidden rounded-2xl border border-[#30362E] min-h-[480px] sm:min-h-[560px] flex items-center p-6 sm:p-12 lg:p-16 shadow-[8px_8px_24px_rgba(0,0,0,0.75)]"
      >
        {/* Solid dark readability overlay (no gradient, no glow) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#080908]/75 pointer-events-none"
        />

        {/* Hero Foreground Content */}
        <div className="relative z-10 w-full max-w-2xl space-y-7">
          {/* SnapFind AI Logo & Name */}
          <div className="flex items-center gap-3">
            <SnapFindLogo className="w-11 h-11 rounded-xl border border-[#30362E] bg-[#0D0F0D] shrink-0" />
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#F7F8F5]">
              SnapFind AI
            </span>
          </div>

          {/* Headline & Short Description */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F7F8F5] leading-[1.1]">
              Your Screenshots. Finally Searchable.
            </h1>

            <p className="text-sm sm:text-base text-[#A5AAA1] leading-relaxed max-w-xl">
              AI-powered screenshot organization and smart search. Automatically
              index text, links, prices, and key details so you can locate any
              saved screenshot in seconds.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md pt-1">
            <button
              id="landing-sign-up-btn"
              type="button"
              onClick={onSignUp}
              className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-sm flex items-center justify-center gap-2 border border-[#B7F36B] shadow-[4px_4px_12px_rgba(0,0,0,0.6)] transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Sign Up</span>
            </button>

            <button
              id="landing-sign-in-btn"
              type="button"
              onClick={onSignIn}
              className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#141714] hover:bg-[#222720] text-[#F7F8F5] font-semibold text-sm flex items-center justify-center gap-2 border border-[#30362E] hover:border-[#B7F36B] shadow-[4px_4px_12px_rgba(0,0,0,0.6)] transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#B7F36B] shrink-0" />
              <span>Sign In</span>
            </button>

            <button
              id="landing-search-btn"
              type="button"
              onClick={onNavigateToSearch}
              className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#141714] hover:bg-[#222720] text-[#F7F8F5] font-semibold text-sm flex items-center justify-center gap-2 border border-[#30362E] hover:border-[#B7F36B] shadow-[4px_4px_12px_rgba(0,0,0,0.6)] transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#B7F36B] shrink-0" />
              <span>Search</span>
            </button>

            <button
              id="landing-gallery-btn"
              type="button"
              onClick={onNavigateToGallery}
              className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#141714] hover:bg-[#222720] text-[#F7F8F5] font-semibold text-sm flex items-center justify-center gap-2 border border-[#30362E] hover:border-[#B7F36B] shadow-[4px_4px_12px_rgba(0,0,0,0.6)] transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-[#B7F36B] shrink-0" />
              <span>Gallery</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingScreen;
