"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    HSStaticMethods?: {
      autoInit: () => void;
    };
  }
}

export function FlyonuiScript() {
  const pathname = usePathname();

  useEffect(() => {
    void import("flyonui/flyonui").then(() => {
      window.HSStaticMethods?.autoInit();
    });
  }, [pathname]);

  return null;
}
