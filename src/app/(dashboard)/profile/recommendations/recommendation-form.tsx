"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/copy";
import { addRecommendationAction } from "@/lib/profile/actions";

/**
 * Add a received recommendation (peer proof) as a testimonial. The user pastes
 * their OWN recommendation text and, ideally, a verification link (e.g. the
 * LinkedIn recommendation URL) so it can be traced back and trusted. Nothing is
 * fetched or scraped. Same double-submit convention as the rest of the app.
 */
export function RecommendationForm() {
  const router = useRouter();
  const copy = t().recommendations;
  const [recommender, setRecommender] = useState("");
  const [relationship, setRelationship] = useState("");
  const [organization, setOrganization] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const busyProps = {
    "aria-busy": busy || undefined,
    className: busy ? "pointer-events-none opacity-60" : undefined,
  } as const;

  async function submit() {
    if (inFlightRef.current) return;
    if (!recommender.trim() || !text.trim()) {
      setError(copy.form.required);
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await addRecommendationAction({
        recommender,
        relationship: relationship.trim() || undefined,
        organization: organization.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        text,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecommender("");
      setRelationship("");
      setOrganization("");
      setSourceUrl("");
      setText("");
      router.refresh();
    } catch {
      setError(copy.error);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="rec-recommender">{copy.form.recommender}</Label>
          <Input
            id="rec-recommender"
            value={recommender}
            onChange={(e) => setRecommender(e.target.value)}
            maxLength={200}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rec-relationship">{copy.form.relationship}</Label>
          <Input
            id="rec-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            maxLength={200}
            placeholder={copy.form.relationshipPlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rec-organization">{copy.form.organization}</Label>
          <Input
            id="rec-organization"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rec-source">{copy.form.sourceUrl}</Label>
          <Input
            id="rec-source"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            maxLength={1000}
            placeholder="https://www.linkedin.com/in/…"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{copy.form.sourceNote}</p>

      <Label htmlFor="rec-text">{copy.form.text}</Label>
      <textarea
        id="rec-text"
        className="border-input bg-background min-h-32 w-full min-w-0 rounded-lg border p-3 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={5000}
        required
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" {...busyProps}>
          {copy.form.submit}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
