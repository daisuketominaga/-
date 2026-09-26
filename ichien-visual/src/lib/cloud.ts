"use client";
/**
 * クラウド保存（Supabase）。環境変数が無ければ何もしない（ブラウザ保存だけで動く）。
 * テーブル: public.visual_projects（id, name, data, updated_at, updated_by, deleted_at）
 * 行レベルセキュリティ: 社内の許可メール一覧（public.visual_allowed_emails）に載っているログインユーザーだけが
 * 全件を読み書きできる。許可一覧の管理は Supabase 側（管理画面）で行う。
 */
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import type { Project } from "./types";

let client: SupabaseClient | null | undefined;

export function cloudClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}

export const cloudEnabled = () => cloudClient() !== null;

export async function cloudSession(): Promise<Session | null> {
  const c = cloudClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

export function onCloudAuth(cb: (s: Session | null) => void) {
  const c = cloudClient();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
}

export async function cloudSignIn(email: string, password: string) {
  const c = cloudClient();
  if (!c) throw new Error("クラウド保存が設定されていません");
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "メールアドレスかパスワードが違います" : error.message);
}

export async function cloudResetPassword(email: string) {
  const c = cloudClient();
  if (!c) throw new Error("クラウド保存が設定されていません");
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: typeof location !== "undefined" ? location.origin : undefined });
  if (error) throw new Error(error.message);
}

export async function cloudUpdatePassword(password: string) {
  const c = cloudClient();
  if (!c) throw new Error("クラウド保存が設定されていません");
  const { error } = await c.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function cloudSignOut() {
  await cloudClient()?.auth.signOut();
}

export type RemoteRow = { id: string; name: string; data: Project; updated_at: string; updated_by: string | null; deleted_at: string | null };

export async function cloudList(): Promise<RemoteRow[]> {
  const c = cloudClient();
  if (!c) return [];
  const { data, error } = await c.from("visual_projects").select("id,name,data,updated_at,updated_by,deleted_at").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message.includes("row-level security") || error.code === "42501" ? "このアカウントは社内の許可一覧に入っていません" : error.message);
  return (data ?? []) as RemoteRow[];
}

export async function cloudUpsert(id: string, p: Project, email: string | null) {
  const c = cloudClient();
  if (!c) return;
  const { error } = await c.from("visual_projects").upsert({ id, name: p.name, data: p, updated_at: p.updatedAt || new Date().toISOString(), updated_by: email, deleted_at: null });
  if (error) throw new Error(error.message);
}

export async function cloudDelete(id: string, email: string | null) {
  const c = cloudClient();
  if (!c) return;
  // 物理削除はせず、削除日時を入れる（他の端末で復活しないように）
  const { error } = await c.from("visual_projects").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: email }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** 保存のたびに呼ぶ。少し待ってからまとめて送る（連打対策） */
const pending = new Map<string, Project>();
let timer: ReturnType<typeof setTimeout> | null = null;
export type CloudStatus = "idle" | "saving" | "saved" | "error";
let statusCb: ((s: CloudStatus, msg?: string) => void) | null = null;
export function onCloudStatus(cb: typeof statusCb) {
  statusCb = cb;
}
export function queueCloudUpsert(id: string, p: Project) {
  if (!cloudClient()) return;
  pending.set(id, p);
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    const s = await cloudSession();
    if (!s) {
      pending.clear();
      return;
    }
    const items = Array.from(pending.entries());
    pending.clear();
    statusCb?.("saving");
    try {
      for (const [id, p] of items) await cloudUpsert(id, p, s.user.email ?? null);
      statusCb?.("saved");
    } catch (e) {
      statusCb?.("error", (e as Error).message);
    }
  }, 1500);
}
