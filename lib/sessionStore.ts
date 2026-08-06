import type { Session, Customer, ValueWork, ValueMap, ProposalLetter, InterviewNote } from "@/types";
import { getSessions as getMockSessions } from "./mockData";

const STORAGE_KEY = "ichien-sessions";

function getStore(): Session[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = getMockSessions();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}

function saveStore(sessions: Session[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getAllSessions(): Session[] {
  return getStore();
}

export function getSession(id: string): Session | undefined {
  return getStore().find((s) => s.id === id);
}

export function createSession(data: {
  name: string;
  age: number;
  spouseName?: string;
  spouseAge?: number;
  children: { name: string; age: number }[];
  purchasePurpose: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredArea?: string;
  isPairMode?: boolean;
}): Session {
  const id = `s-${Date.now()}`;
  const customerId = `c-${Date.now()}`;

  const customer: Customer = {
    id: customerId,
    name: data.name,
    age: data.age || 0,
    family: {
      spouse: data.spouseName
        ? { name: data.spouseName, age: data.spouseAge || 0 }
        : undefined,
      children: data.children.filter((c) => c.name),
    },
    purchasePurpose: data.purchasePurpose as Customer["purchasePurpose"],
    budget:
      data.budgetMin && data.budgetMax
        ? { min: data.budgetMin, max: data.budgetMax }
        : undefined,
    preferredArea: data.preferredArea || undefined,
    createdAt: new Date().toISOString(),
    status: "事前準備",
  };

  const session: Session = {
    id,
    customerId,
    customer,
    status: "準備中",
    createdAt: new Date().toISOString(),
  };

  const sessions = getStore();
  sessions.unshift(session);
  saveStore(sessions);
  return session;
}

export function updateSessionStatus(id: string, status: Session["status"]): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx].status = status;
  saveStore(sessions);
}

export function saveValueWork(sessionId: string, valueWork: ValueWork): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx].valueWork = valueWork;
  saveStore(sessions);
}

export function saveValueMap(sessionId: string, valueMap: ValueMap): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx].valueMap = valueMap;
  sessions[idx].status = "分析中";
  saveStore(sessions);
}

export function saveProposalLetter(sessionId: string, letter: ProposalLetter): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx].proposalLetter = letter;
  saveStore(sessions);
}

export function saveInterviewNotes(sessionId: string, notes: InterviewNote[]): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  if (!sessions[idx].interview) {
    sessions[idx].interview = {
      id: `i-${Date.now()}`,
      customerId: sessions[idx].customerId,
      date: new Date().toISOString(),
      duration: 0,
      notes: [],
      aiSuggestions: [],
    };
  }
  sessions[idx].interview!.notes = notes;
  saveStore(sessions);
}

export function markLetterSent(sessionId: string, via: string): void {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  if (sessions[idx].proposalLetter) {
    sessions[idx].proposalLetter!.sentAt = new Date().toISOString();
    sessions[idx].proposalLetter!.sentVia = via;
  }
  sessions[idx].customer.status = "レター送付済み";
  sessions[idx].status = "完了";
  saveStore(sessions);
}
