"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, Check } from "lucide-react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      onClick={handleCopy}
      variant="outline"
      className="w-full border-2 border-foreground font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Link className="h-4 w-4 mr-2" />
          Copy Event Link
        </>
      )}
    </Button>
  );
}
