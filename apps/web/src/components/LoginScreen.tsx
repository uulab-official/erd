import { useState, type FormEvent } from "react";
import { Button } from "@modelforge/ui";
import { useAuthStore } from "../store/useAuthStore.js";
import { isAppwriteConfigured } from "../lib/appwrite.js";

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, signup, loading, error } = useAuthStore();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "login") {
      void login(email, password);
    } else {
      void signup(email, password);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="w-80 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold">ModelForge</h1>
        <p className="mb-4 text-sm text-neutral-500">{mode === "login" ? "로그인" : "회원가입"}</p>

        {!isAppwriteConfigured && (
          <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-700">
            Appwrite가 설정되지 않았습니다. apps/web/.env.example을 참고해 .env.local을 구성하세요.
          </p>
        )}

        <label className="mb-2 block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "..." : mode === "login" ? "로그인" : "회원가입"}
        </Button>

        <button
          type="button"
          className="mt-3 w-full text-center text-xs text-neutral-500 underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
      </form>
    </div>
  );
}
