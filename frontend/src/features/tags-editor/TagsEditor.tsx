import { useState, useEffect, useMemo } from "react";
import { businessCardApi } from "@/entities/business-card/model/api";
import type { BusinessCard } from "@/entities/business-card";
import { TagInput, extractTagsFromBio, useDebounce } from "@/shared";

interface SuggestedTag {
  name: string;
  category: string;
  confidence: number;
  reason: string;
}

export interface TagsEditorProps {
  /** The business card to work with */
  card: BusinessCard;
  /** Owner user ID */
  userId: string;
  /** Current tags value */
  value: string[];
  /** Called when tags change */
  onChange: (tags: string[]) => void;
  /** Optional bio text override for fallback suggestions (e.g. when bio is being edited live) */
  bioText?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Max number of tags */
  maxTags?: number;
  /** Disable the input */
  disabled?: boolean;
  /** Called when AI suggestions loading state changes */
  onLoadingChange?: (loading: boolean) => void;
  /** Called when AI suggestions are received */
  onSuggestionsReceived?: (suggestions: string[]) => void;
}

/**
 * Reusable tags editor with AI suggestions and bio-based fallback suggestions.
 * Used in both the card editor and onboarding flow.
 */
export function TagsEditor({
  card,
  userId,
  value,
  onChange,
  bioText: bioTextOverride,
  placeholder,
  maxTags = 15,
  disabled = false,
  onLoadingChange,
  onSuggestionsReceived,
}: TagsEditorProps) {
  const [aiTagSuggestions, setAiTagSuggestions] = useState<string[]>([]);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

  // Bio text for fallback tag extraction
  const bioText = bioTextOverride ?? card.ai_generated_bio ?? card.bio ?? "";
  const debouncedBioText = useDebounce(bioText, 500);

  // Reset AI suggestions when bio text changes (outdated)
  useEffect(() => {
    setAiTagSuggestions([]);
    setHasFetchedSuggestions(false);
  }, [bioText]);

  // Quick local suggestions extracted from debounced bio text
  const quickSuggestions = useMemo(() => {
    return extractTagsFromBio(debouncedBioText, 12);
  }, [debouncedBioText]);

  // Notify parent about loading state changes
  useEffect(() => {
    onLoadingChange?.(isGeneratingTags);
  }, [isGeneratingTags, onLoadingChange]);

  // Auto-fetch AI suggestions
  useEffect(() => {
    const text = card.ai_generated_bio || card.bio || "";
    if (text.trim().length < 20 || hasFetchedSuggestions || isGeneratingTags) {
      return;
    }

    setHasFetchedSuggestions(true);
    let cancelled = false;

    (async () => {
      setIsGeneratingTags(true);
      try {
        const result = await businessCardApi.suggestTags(card.id, userId);
        if (!cancelled) {
          const names = result.suggestions.map((t: SuggestedTag) => t.name);
          setAiTagSuggestions(names);
          onSuggestionsReceived?.(names);
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) setIsGeneratingTags(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, card.ai_generated_bio, card.bio, userId, hasFetchedSuggestions]);

  return (
    <TagInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      suggestions={aiTagSuggestions}
      fallbackSuggestions={quickSuggestions}
      isLoadingSuggestions={isGeneratingTags}
      maxTags={maxTags}
      disabled={disabled}
    />
  );
}
