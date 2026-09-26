"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloudEnabled, cloudSession, onCloudAuth, cloudSignIn, cloudSignOut, cloudResetPassword, cloudUpdatePassword, onCloudStatus, type CloudStatus } from "@/lib/cloud";

type Props = { sync: () => Promise<{ pulled: number; pushed: number; removed: number }> };

/** ヘッダーのクラウド保存パネル: ログイン、同期状態、手動同期 */
export default function CloudPanel({ sync }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<CloudStatus>("idle");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [recovery, setRecovery] = useState(false);
  const enabled = cloudEnabled();

  useEffect(() => {
    if (!enabled) return;
    cloudSession().then(setSession);
    onCloudStatus((s, m) => {
      setStatus(s);
      setStatusMsg(m);
    });
    // パスワード再設定メールから戻ってきたとき
    if (typeof location !== "undefined" && location.hash.includes("type=recovery")) setRecovery(true);
    return onCloudAuth((s) => setSession(s));
  }, [enabled]);

  // ログイン直後に一度同期
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const r = await sync();
        if (!cancelled) setMsg(`同期しました（取得 ${r.pulled}・送信 ${r.pushed}・削除 ${r.removed}）`);
      } catch (e) {
        if (!cancelled) setMsg("同期エラー: " + (e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (!enabled) return null;

  const login = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await cloudSignIn(email.trim(), pw);
      setPw("");
      setOpen(false);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!email.trim()) {
      setMsg("メールアドレスを入れてください");
      return;
    }
    setBusy(true);
    try {
      await cloudResetPassword(email.trim());
      setMsg("パスワード再設定のメールを送りました（届くまで数分かかることがあります）");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const updatePw = async () => {
    setBusy(true);
    try {
      await cloudUpdatePassword(pw);
      setPw("");
      setRecovery(false);
      setMsg("パスワードを変えました");
      history.replaceState(null, "", location.pathname);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const manualSync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sync();
      setMsg(`同期しました（取得 ${r.pulled}・送信 ${r.pushed}・削除 ${r.removed}）`);
    } catch (e) {
      setMsg("同期エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dot = status === "saving" ? "bg-amber-400" : status === "error" ? "bg-red-500" : session ? "bg-emerald-500" : "bg-slate-300";
  const label = !session ? "クラウド未接続" : status === "saving" ? "保存中…" : status === "error" ? "保存エラー" : "クラウド保存中";

  return (
    <div className="relative text-xs">
      <button className="btn-ghost flex items-center gap-1.5" onClick={() => setOpen((o) => !o)} title={statusMsg ?? label}>
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {session ? session.user.email : "ログイン"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {session ? (
            <>
              <div className="font-medium">{label}</div>
              <div className="text-[11px] leading-relaxed text-slate-500">物件データは社内で共有され、どのPC・スマホからも同じものが開けます。変更は自動で保存されます。</div>
              {statusMsg && <div className="text-[11px] text-red-600">{statusMsg}</div>}
              <div className="flex gap-1">
                <button className="btn-primary px-2 py-1" disabled={busy} onClick={manualSync}>{busy ? "同期中…" : "今すぐ同期"}</button>
                <button className="btn-ghost px-2 py-1" disabled={busy} onClick={() => cloudSignOut().then(() => { setSession(null); setMsg(null); })}>ログアウト</button>
              </div>
              {recovery && (
                <div className="space-y-1 rounded bg-amber-50 p-2">
                  <div className="text-[11px]">新しいパスワード（8文字以上）</div>
                  <input type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} />
                  <button className="btn-primary px-2 py-1" disabled={busy || pw.length < 8} onClick={updatePw}>パスワードを変える</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-medium">クラウド保存にログイン</div>
              <div className="text-[11px] leading-relaxed text-slate-500">イチエン不動産のCRMと同じメールアドレス・パスワードです。ログインしなくてもこのブラウザの中には保存されます。</div>
              <input className="field" placeholder="メールアドレス" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input type="password" className="field" placeholder="パスワード" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
              <div className="flex items-center gap-2">
                <button className="btn-primary px-3 py-1" disabled={busy || !email || !pw} onClick={login}>{busy ? "…" : "ログイン"}</button>
                <button className="text-[11px] text-slate-500 underline" disabled={busy} onClick={reset}>パスワードを忘れた</button>
              </div>
            </>
          )}
          {msg && <div className={`text-[11px] ${msg.includes("エラー") || msg.includes("違います") || msg.includes("入っていません") ? "text-red-600" : "text-emerald-700"}`}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
