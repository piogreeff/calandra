import { GggOAuthCallback } from "../../../../components/GggOAuthCallback";

export default function GggOAuthCallbackPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-base-100 p-4">
      <div className="w-full max-w-lg">
        <GggOAuthCallback />
      </div>
    </main>
  );
}
