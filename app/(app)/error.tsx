"use client";

import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="pt-10">
      <EmptyState
        title="Something went wrong"
        body="The page could not be loaded. Your votes and comments are only saved when the server confirms them, so nothing is lost silently."
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
