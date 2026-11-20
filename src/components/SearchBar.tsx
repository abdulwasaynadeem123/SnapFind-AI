import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Mic,
  MicOff,
  Loader2,
  Clock,
  Tag,
  TrendingUp,
  ChevronRight,
  Trash2,
  Sparkles,
} from "lucide-react";
import { CategoryType, ScreenshotItem, SearchHistoryItem } from "../types";

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  onExecuteSearch: (q: string) => void;
  selectedCategory: CategoryType;
  setSelectedCategory: (cat: CategoryType) => void;
  isDark?: boolean;
  isSearching?: boolean;
  screenshots?: ScreenshotItem[];
  searchHistory?: SearchHistoryItem[];
  onDeleteHistoryItem?: (id: string) => void;
}

const POPULAR_QUERIES = [
  "receipt",
  "invoice",
  "flight ticket",
  "password",
  "code",
  "bank transfer",
];

interface SuggestionItem {
  text: string;
  type: "recent" | "keyword" | "popular";
  id?: string;
  subtitle?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  onExecuteSearch,
  isSearching = false,
  screenshots = [],
  searchHistory = [],
  onDeleteHistoryItem,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dynamicKeywords = useMemo(() => {
    const kwSet = new Set<string>();
    for (const s of screenshots) {
      if (s.tags) s.tags.forEach((t) => kwSet.add(t.toLowerCase()));
      if (s.keywords) s.keywords.forEach((k) => kwSet.add(k.toLowerCase()));
      if (s.keyEntities) s.keyEntities.forEach((e) => kwSet.add(e.toLowerCase()));
      if (s.category && s.category !== "Other") kwSet.add(s.category.toLowerCase());
    }
    return Array.from(kwSet);
  }, [screenshots]);

  const suggestions = useMemo<SuggestionItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SuggestionItem[] = [];
    const seen = new Set<string>();

    if (!q) {
      for (const h of searchHistory.slice(0, 4)) {
        if (!seen.has(h.query.toLowerCase())) {
          seen.add(h.query.toLowerCase());
          list.push({
            text: h.query,
            type: "recent",
            id: h.id,
            subtitle: `${h.resultCount ?? 0} results`,
          });
        }
      }
      for (const kw of dynamicKeywords.slice(0, 4)) {
        if (!seen.has(kw)) {
          seen.add(kw);
          list.push({ text: kw, type: "keyword", subtitle: "From your library" });
        }
      }
      for (const p of POPULAR_QUERIES) {
        if (list.length >= 8) break;
        if (!seen.has(p)) {
          seen.add(p);
          list.push({ text: p, type: "popular", subtitle: "Suggested search" });
        }
      }
      return list;
    }

    for (const h of searchHistory) {
      if (h.query.toLowerCase().includes(q) && !seen.has(h.query.toLowerCase())) {
        seen.add(h.query.toLowerCase());
        list.push({
          text: h.query,
          type: "recent",
          id: h.id,
          subtitle: "Recent search",
        });
      }
    }

    for (const kw of dynamicKeywords) {
      if (list.length >= 8) break;
      if (kw.includes(q) && !seen.has(kw)) {
        seen.add(kw);
        list.push({ text: kw, type: "keyword", subtitle: "Tag / Keyword" });
      }
    }

    for (const p of POPULAR_QUERIES) {
      if (list.length >= 8) break;
      if (p.includes(q) && !seen.has(p)) {
        seen.add(p);
        list.push({ text: p, type: "popular", subtitle: "Suggested" });
      }
    }

    return list;
  }, [query, searchHistory, dynamicKeywords]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions.length, query]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    onExecuteSearch(query.trim());
  };

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onExecuteSearch(text);
  };

  const handleClear = () => {
    setQuery("");
    onExecuteSearch("");
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const toggleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setQuery(transcript);
        onExecuteSearch(transcript);
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[highlightedIndex].text);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const hasSpeechSupport =
    typeof window !== "undefined" &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        role="search"
        className={`relative flex items-center gap-2 p-2 rounded-2xl border bg-[#0D0F0D] transition-colors ${
          isFocused ? "border-[#B7F36B]" : "border-[#30362E] hover:border-[#777E74]"
        }`}
      >
        <label htmlFor="snapfind-main-search-input" className="sr-only">
          Search screenshots by text, description, tags, or keywords
        </label>

        <div className="pl-2.5 flex items-center justify-center text-[#B7F36B]" aria-hidden="true">
          {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </div>

        <input
          id="snapfind-main-search-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls="snapfind-search-suggestions"
          aria-activedescendant={
            highlightedIndex >= 0 ? `search-suggestion-${highlightedIndex}` : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search OCR text, receipts, tags, dates, or descriptions..."
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm sm:text-base text-[#F7F8F5] placeholder-[#777E74] py-2"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search input"
            className="p-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {hasSpeechSupport && (
          <button
            type="button"
            onClick={toggleVoiceSearch}
            aria-label={isListening ? "Stop voice search" : "Start voice search"}
            className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isListening
                ? "bg-rose-950 border-rose-700 text-rose-200"
                : "bg-[#1B1F1A] hover:bg-[#222720] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5]"
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        <button
          type="submit"
          disabled={isSearching}
          className="px-4 sm:px-5 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
        >
          <span>{isSearching ? "Searching..." : "Search"}</span>
        </button>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          id="snapfind-search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-2 z-40 rounded-2xl border bg-[#141714] border-[#30362E] overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-[#30362E] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#777E74]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#B7F36B]" />
              {query.trim() ? "Matching Suggestions" : "Recent & Suggested Searches"}
            </span>
            <span className="font-mono text-[10px]">↑ ↓ to navigate</span>
          </div>

          <ul className="divide-y divide-[#222720] max-h-72 overflow-y-auto">
            {suggestions.map((sug, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <li
                  key={`${sug.type}-${sug.text}-${idx}`}
                  id={`search-suggestion-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 transition-colors ${
                    isHighlighted ? "bg-[#222720]" : "hover:bg-[#1B1F1A]"
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(sug.text);
                    }}
                    className="flex-1 flex items-center gap-3 text-left min-w-0 cursor-pointer"
                  >
                    <span className="text-[#B7F36B] shrink-0">
                      {sug.type === "recent" ? (
                        <Clock className="w-4 h-4 text-[#A5AAA1]" />
                      ) : sug.type === "keyword" ? (
                        <Tag className="w-4 h-4 text-[#B7F36B]" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-[#777E74]" />
                      )}
                    </span>
                    <span className="text-sm text-[#F7F8F5] font-medium truncate">{sug.text}</span>
                    {sug.subtitle && (
                      <span className="text-[11px] text-[#777E74] hidden sm:inline shrink-0">
                        {sug.subtitle}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {sug.type === "recent" && sug.id && onDeleteHistoryItem && (
                      <button
                        type="button"
                        aria-label={`Remove "${sug.text}" from recent searches`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteHistoryItem(sug.id!);
                        }}
                        className="p-1.5 rounded-lg text-[#777E74] hover:text-rose-400 hover:bg-[#0D0F0D] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-[#777E74]" aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
