"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  type DashboardGggOAuthStatus,
  startDashboardGggOAuthLink,
} from "../lib/read-api";

export function GggOAuthLinkPanel({
  status,
  apiBaseUrl,
  defaultAccount = "example",
}: {
  status: DashboardGggOAuthStatus;
  apiBaseUrl: string;
  defaultAccount?: string;
}) {
  const [account, setAccount] = useState(defaultAccount);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canLink = status.features.accountLinking;

  useEffect(() => {
    setAccount(resolveInitialGggAccount(defaultAccount, window.location.search));
  }, [defaultAccount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAccount = account.trim();

    if (!canLink || !trimmedAccount) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const started = await startDashboardGggOAuthLink(
        trimmedAccount,
        apiBaseUrl,
      );
      window.location.assign(started.authorizationUrl);
    } catch {
      setMessage("GGG account linking is not available from this API yet.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-3 rounded-md border border-base-300/70 bg-base-100/45 p-3">
        <p className="text-xs uppercase text-base-content/55">Hosted OAuth</p>
        <p
          className={`mt-1 text-sm font-semibold ${
            status.configured ? "text-success" : "text-warning"
          }`}
        >
          {status.configured ? "Ready to link" : "Hosted setup pending"}
        </p>
      </div>
      <form className="space-y-2" onSubmit={handleSubmit}>
        <label
          className="text-xs font-medium uppercase text-base-content/55"
          htmlFor="ggg-account"
        >
          Account
        </label>
        <input
          id="ggg-account"
          name="account"
          className="input input-sm w-full"
          value={account}
          onChange={(event) => setAccount(event.currentTarget.value)}
          disabled={!canLink || isSubmitting}
        />
        <button
          className="btn btn-primary btn-sm w-full"
          type="submit"
          disabled={!canLink || !account.trim() || isSubmitting}
        >
          {isSubmitting ? "Opening GGG OAuth" : "Link GGG account"}
        </button>
      </form>
      {message ? (
        <p className="mt-3 rounded-md border border-error/35 bg-error/10 p-3 text-sm text-error">
          {message}
        </p>
      ) : null}
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-md bg-base-100/45 p-2">
          <span className="text-base-content/60">Account link</span>
          <span className="font-medium text-base-content">
            {formatBooleanReady(status.features.accountLinking)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-base-100/45 p-2">
          <span className="text-base-content/60">Snapshot capture</span>
          <span className="font-medium text-base-content">
            {formatBooleanReady(status.features.snapshotCapture)}
          </span>
        </div>
      </div>
      <p className="mt-3 break-all rounded-md border border-base-300/70 bg-base-100/45 p-3 text-xs text-base-content/70">
        {status.redirectUri.replace("https://calandra.pages.dev", "")}
      </p>
      <p className="mt-3 rounded-md border border-base-300/70 bg-base-100/45 p-3 text-xs text-base-content/70">
        {status.requiredScopes.join(", ")}
      </p>
      <p className="mt-3 rounded-md border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
        Stash OAuth: pending GGG support
      </p>
    </>
  );
}

function formatBooleanReady(value: boolean) {
  return value ? "Ready" : "Pending";
}

export function resolveInitialGggAccount(
  defaultAccount: string,
  search: string | undefined,
) {
  const account = new URLSearchParams(search).get("account")?.trim();

  return account || defaultAccount;
}
