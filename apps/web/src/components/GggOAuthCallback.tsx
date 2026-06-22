"use client";

import { useEffect, useState } from "react";
import {
  completeDashboardGggOAuthLink,
  defaultApiBaseUrl,
} from "../lib/read-api";

type CompletionState =
  | { status: "pending" }
  | {
      status: "completed";
      account: string;
      objectKey: string;
      scopes: string[];
    }
  | { status: "error"; message: string };

export function GggOAuthCallback({
  apiBaseUrl = defaultApiBaseUrl,
}: {
  apiBaseUrl?: string;
}) {
  const [completion, setCompletion] = useState<CompletionState>({
    status: "pending",
  });

  useEffect(() => {
    const request = getGggOAuthCallbackRequest(window.location.search);

    if (!request) {
      setCompletion({
        status: "error",
        message: "GGG OAuth callback is missing a state or code value.",
      });
      return;
    }

    completeDashboardGggOAuthLink(request, apiBaseUrl)
      .then((result) => {
        setCompletion({
          status: "completed",
          account: result.account,
          objectKey: result.objectKey,
          scopes: result.token.scope,
        });
      })
      .catch(() => {
        setCompletion({
          status: "error",
          message: "GGG account linking could not be completed.",
        });
      });
  }, [apiBaseUrl]);

  if (completion.status === "completed") {
    return (
      <section className="rounded-lg border border-success/35 bg-success/10 p-5 text-success">
        <h1 className="text-xl font-semibold">GGG account linked</h1>
        <p className="mt-2 text-sm">Account: {completion.account}</p>
        <p className="mt-2 break-all text-xs">{completion.objectKey}</p>
        <p className="mt-2 text-xs">{completion.scopes.join(", ")}</p>
      </section>
    );
  }

  if (completion.status === "error") {
    return (
      <section className="rounded-lg border border-error/35 bg-error/10 p-5 text-error">
        <h1 className="text-xl font-semibold">GGG account link failed</h1>
        <p className="mt-2 text-sm">{completion.message}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-base-300/70 bg-base-200/72 p-5">
      <h1 className="text-xl font-semibold text-base-content">
        Completing GGG account link
      </h1>
      <p className="mt-2 text-sm text-base-content/70">
        calandra.pages.dev is storing the encrypted token metadata.
      </p>
    </section>
  );
}

export function getGggOAuthCallbackRequest(search: string) {
  const params = new URLSearchParams(search);
  const state = params.get("state")?.trim();
  const code = params.get("code")?.trim();

  return state && code ? { state, code } : null;
}
