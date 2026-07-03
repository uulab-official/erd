import { useState, type FormEvent } from "react";
import { Button, Card, Input } from "@modelforge/ui";
import { useAuthStore } from "../store/useAuthStore.js";
import { isAppwriteConfigured } from "../lib/appwrite.js";

function Logomark() {
  return (
    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 shadow-sm">
      <div className="grid grid-cols-2 gap-0.5">
        <div className="h-2 w-2 rounded-[2px] bg-white" />
        <div className="h-2 w-2 rounded-[2px] bg-white/55" />
        <div className="h-2 w-2 rounded-[2px] bg-white/55" />
        <div className="h-2 w-2 rounded-[2px] bg-white" />
      </div>
    </div>
  );
}

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
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Card className="w-80 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <Logomark />
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">ModelForge</h1>
          <p className="mb-5 text-sm text-slate-500">{mode === "login" ? "로그인" : "회원가입"}</p>

          {!isAppwriteConfigured && (
            <p className="mb-4 rounded-md bg-amber-50 p-2.5 text-xs text-amber-700">
              Appwrite가 설정되지 않았습니다. apps/web/.env.example을 참고해 .env.local을
              구성하세요.
            </p>
          )}

          <label className="mb-3 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="mb-5 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Password
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "login" ? "로그인" : "회원가입"}
          </Button>

          <button
            type="button"
            className="mt-3 text-center text-xs text-slate-500 hover:text-slate-700 hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
          </button>
        </form>
      </Card>
    </div>
  );
}
