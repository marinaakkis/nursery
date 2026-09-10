"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/ui";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";

/** Запись cookie живёт вне компонента: менять внешнее состояние из тела нельзя. */
function remember(): void {
  document.cookie = `${ONBOARDING_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

export function OnboardingDismiss() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        remember();
        startTransition(() => router.refresh());
      }}
    >
      Понятно
    </Button>
  );
}
