import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  Sparkles,
  Mic,
  Volume2,
  Clock,
  ArrowRight,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CategoryType, ScreenshotItem, SearchHistoryItem } from "../types";

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  onExecuteSearch: (q: string) => void;
  selectedCategory?: CategoryType;
  setSelectedCategory?: (cat: CategoryType) => void;
  isDark: boolean;
  isSearching: boolean;
  screenshots?: ScreenshotItem[];
  searchHistory?: SearchHistoryItem[];
  onDeleteHistoryItem?: (id: string) => void;
  placeholder?: string;
  showSuggestionsDropdown?: boolean;
}

const ROTATING_PLACEHOLDERS = [
  "Search anything across your screenshots...",
  'Try "Show passport photo"',
  'Try "Electricity bill due amount"',
  'Try "Flight ticket confirmation"',
  'Try "Wi-Fi password screenshot"',
  'Try "Pasta recipe ingredients"',
];

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  onExecuteSearch,
  isDark,
  isSearching,
  screenshots = [],
  searchHistory = [],
  onDeleteHistoryItem,
  placeholder,
  showSuggestionsDropdown = true,
}) => {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Rotate placeholders when input is empty & not focused
  useEffect(() => {
    if (query || isFocused) return;
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [query, isFocused]);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      } else if (e.key === "Escape" && isFocused) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isFocused]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute Instant Suggestions
  const suggestions = useMemo(() => {
    const qLower = query.toLowerCase().trim();

    // Matching Recent History
    const historyMatches = searchHistory
      .filter((h) => !qLower || h.query.toLowerCase().includes(qLower))
      .slice(0, 4)
      .map((h) => ({
        id: h.id,
        text: h.query,
        type: "history" as const,
      }));

    // Matching Screenshot Titles
    const titleMatches: { id: string; text: string; type: "screenshot" }[] = [];
    if (qLower && screenshots.length > 0) {
      const seen = new Set<string>();
      screenshots.forEach((s) => {
        if (titleMatches.length >= 4) return;
        if (s.title.toLowerCase().includes(qLower) && !seen.has(s.title.toLowerCase())) {
          seen.add(s.title.toLowerCase());
          titleMatches.push({
            id: s.id,
            text: s.title,
            type: "screenshot",
          });
        }
      });
    }

    const flatList = [...historyMatches, ...titleMatches];

    return {
      history: historyMatches,
      screenshots: titleMatches,
      flatList,
    };
  }, [query, screenshots, searchHistory]);

  // Voice Search Handler
  const startVoiceSearch = () => {
    setVoiceTranscript("");
    setIsVoiceListening(true);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsVoiceListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery(transcript);
          onExecuteSearch(transcript);
        }
        setIsVoiceListening(false);
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsVoiceListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const flat = suggestions.flatList;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < flat.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < flat.length) {
        const selected = flat[highlightedIndex].text;
        setQuery(selected);
        onExecuteSearch(selected);
        setIsFocused(false);
      } else if (query.trim()) {
        onExecuteSearch(query.trim());
        setIsFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    onExecuteSearch(text);
    setIsFocused(false);
  };

  const hasSuggestionsToShow =
    showSuggestionsDropdown &&
    isFocused &&
    (suggestions.history.length > 0 || suggestions.screenshots.length > 0);

  return (
    <div ref={containerRef} className="w-full relative z-30">
      {/* Search Input Box */}
      <div
        className={`relative flex items-center w-full rounded-2xl border transition-all duration-300 ${
          isFocused
            ? "bg-[#1E293B] border-[#116466] ring-1 ring-[#116466]/60 shadow-[0_0_24px_rgba(17,100,102,0.25)]"
            : "bg-[#1E293B]/90 border-[#334155] hover:border-[#475569] hover:bg-[#1E293B] shadow-lg"
        }`}
      >
        {/* Subtle AI Searching animated glow beam at bottom of bar */}
        {isSearching && (
          <div className="absolute inset-x-4 -bottom-px h-[2px] bg-gradient-to-r from-transparent via-[#116466] to-[#D1E8E2] animate-pulse rounded-full" />
        )}

        {/* Left Search Icon */}
        <div className="pl-4 pr-3 text-[#94A3B8] flex items-center shrink-0">
          {isSearching ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              className="text-[#D1E8E2]"
            >
              <Sparkles className="w-5 h-5" />
            </motion.div>
          ) : (
            <Search className={`w-5 h-5 transition-colors ${isFocused ? "text-[#D1E8E2]" : "text-[#94A3B8]"}`} />
          )}
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          id="snapfind-main-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || ROTATING_PLACEHOLDERS[placeholderIdx]}
          className="w-full bg-transparent border-none outline-none text-sm sm:text-base font-normal placeholder:text-[#94A3B8]/60 text-[#F1F5F9] py-3.5 sm:py-4 pr-2"
        />

        {/* Voice Listening indicator */}
        {isVoiceListening && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1E293B] border border-[#D9B08C] text-[#D9B08C] text-xs mr-2 animate-pulse font-mono font-semibold">
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LISTENING...</span>
          </div>
        )}

        {/* Clear (X) button ONLY when text exists */}
        {query && (
          <button
            id="snapfind-clear-search-btn"
            type="button"
            onClick={() => {
              setQuery("");
              onExecuteSearch("");
              inputRef.current?.focus();
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#94A3B8] hover:text-[#F1F5F9] mr-1 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Voice search button */}
        <button
          id="snapfind-voice-search-btn"
          type="button"
          onClick={startVoiceSearch}
          className={`p-2 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] transition-colors cursor-pointer mr-1.5 ${
            isVoiceListening ? "text-[#D1E8E2] bg-[#243347]" : ""
          }`}
          title="Voice Search"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* Primary Search button */}
        <button
          id="snapfind-execute-search-btn"
          type="button"
          onClick={() => {
            onExecuteSearch(query);
            setIsFocused(false);
          }}
          disabled={isSearching}
          className="mr-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#116466] hover:bg-[#157F81] active:scale-98 text-[#F1F5F9] border border-[#116466] font-bold text-xs sm:text-sm shadow-[0_0_12px_rgba(17,100,102,0.3)] transition-all shrink-0 cursor-pointer disabled:opacity-50"
        >
          <span>Search</span>
        </button>
      </div>

      {/* Autocomplete Suggestions Popover */}
      <AnimatePresence>
        {hasSuggestionsToShow && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl border border-[#334155] bg-[#1E293B]/95 backdrop-blur-md text-[#F1F5F9] shadow-2xl z-50 max-h-[320px] overflow-y-auto"
          >
            {suggestions.history.length > 0 && (
              <div className="space-y-0.5">
                <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#94A3B8]/70">
                  Recent Searches
                </div>
                {suggestions.history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleSelectSuggestion(h.text)}
                    className="px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9] border border-transparent hover:border-[#334155] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8]/70 shrink-0" />
                      <span className="truncate">{h.text}</span>
                    </div>
                    {onDeleteHistoryItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistoryItem(h.id);
                        }}
                        className="p-1 rounded hover:bg-[#2C3531] text-[#94A3B8] hover:text-[#F1F5F9]"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {suggestions.screenshots.length > 0 && (
              <div className="space-y-0.5 mt-1">
                <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#94A3B8]/70">
                  Matching Screenshots
                </div>
                {suggestions.screenshots.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSuggestion(s.text)}
                    className="px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 cursor-pointer hover:bg-[#243347] text-[#94A3B8] hover:text-[#D1E8E2] border border-transparent hover:border-[#334155] transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                    <span className="truncate">{s.text}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
