/**
 * ローカルストレージベースのデータストア
 * Supabaseが未設定の場合のフォールバック
 */
import type {
  Customer,
  Session,
  InterviewNote,
  ValueWorkAnswers,
  ValueMap,
  ProposalLetter,
  AISuggestion,
} from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function getStore<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// --- Customers ---
export function getCustomers(): Customer[] {
  return getStore<Customer>("ld_customers");
}

export function getCustomer(id: string): Customer | undefined {
  return getCustomers().find((c) => c.id === id);
}

export function createCustomer(
  data: Omit<Customer, "id" | "created_at" | "updated_at">
): Customer {
  const customer: Customer = {
    ...data,
    id: generateId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const customers = getCustomers();
  customers.push(customer);
  setStore("ld_customers", customers);
  return customer;
}

export function updateCustomer(
  id: string,
  data: Partial<Customer>
): Customer | undefined {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  customers[idx] = { ...customers[idx], ...data, updated_at: new Date().toISOString() };
  setStore("ld_customers", customers);
  return customers[idx];
}

// --- Sessions ---
export function getSessions(): Session[] {
  return getStore<Session>("ld_sessions");
}

export function getSession(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}

export function getSessionsByCustomer(customerId: string): Session[] {
  return getSessions().filter((s) => s.customer_id === customerId);
}

export function createSession(customerId: string): Session {
  const id = generateId();
  const session: Session = {
    id,
    customer_id: customerId,
    staff_url: `/s/${id}/staff`,
    client_url: `/s/${id}/client`,
    status: "準備中",
    started_at: null,
    ended_at: null,
    created_at: new Date().toISOString(),
  };
  const sessions = getSessions();
  sessions.push(session);
  setStore("ld_sessions", sessions);
  return session;
}

export function updateSession(
  id: string,
  data: Partial<Session>
): Session | undefined {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  sessions[idx] = { ...sessions[idx], ...data };
  setStore("ld_sessions", sessions);
  return sessions[idx];
}

// --- Interview Notes ---
export function getNotes(sessionId: string): InterviewNote[] {
  return getStore<InterviewNote>("ld_notes").filter(
    (n) => n.session_id === sessionId
  );
}

export function addNote(
  sessionId: string,
  content: string,
  category: InterviewNote["category"]
): InterviewNote {
  const note: InterviewNote = {
    id: generateId(),
    session_id: sessionId,
    content,
    category,
    created_at: new Date().toISOString(),
  };
  const notes = getStore<InterviewNote>("ld_notes");
  notes.push(note);
  setStore("ld_notes", notes);
  return note;
}

// --- AI Suggestions ---
export function getSuggestions(sessionId: string): AISuggestion[] {
  return getStore<AISuggestion>("ld_suggestions").filter(
    (s) => s.session_id === sessionId
  );
}

export function setSuggestions(
  sessionId: string,
  suggestions: Omit<AISuggestion, "id" | "session_id" | "created_at">[]
): AISuggestion[] {
  const allSuggestions = getStore<AISuggestion>("ld_suggestions");
  const others = allSuggestions.filter((s) => s.session_id !== sessionId);
  const newSuggestions: AISuggestion[] = suggestions.map((s) => ({
    ...s,
    id: generateId(),
    session_id: sessionId,
    created_at: new Date().toISOString(),
  }));
  setStore("ld_suggestions", [...others, ...newSuggestions]);
  return newSuggestions;
}

export function markSuggestionUsed(id: string): void {
  const suggestions = getStore<AISuggestion>("ld_suggestions");
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx !== -1) {
    suggestions[idx].used = true;
    setStore("ld_suggestions", suggestions);
  }
}

// --- Value Work Answers ---
export function getValueWork(sessionId: string): ValueWorkAnswers | undefined {
  return getStore<ValueWorkAnswers>("ld_valuework").find(
    (v) => v.session_id === sessionId
  );
}

export function saveValueWork(
  sessionId: string,
  data: Partial<ValueWorkAnswers>
): ValueWorkAnswers {
  const all = getStore<ValueWorkAnswers>("ld_valuework");
  const idx = all.findIndex((v) => v.session_id === sessionId);
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    setStore("ld_valuework", all);
    return all[idx];
  }
  const newWork: ValueWorkAnswers = {
    id: generateId(),
    session_id: sessionId,
    step1_priorities: {},
    step2_ideal_day: {
      morning_activity: "",
      evening_scene: "",
      weekend_activities: [],
    },
    step3_tradeoffs: [],
    step4_letter: "",
    step5_top_values: [],
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...data,
  };
  all.push(newWork);
  setStore("ld_valuework", all);
  return newWork;
}

// --- Value Map ---
export function getValueMap(sessionId: string): ValueMap | undefined {
  return getStore<ValueMap>("ld_valuemaps").find(
    (v) => v.session_id === sessionId
  );
}

export function saveValueMap(
  sessionId: string,
  data: Omit<ValueMap, "id" | "session_id" | "created_at">
): ValueMap {
  const all = getStore<ValueMap>("ld_valuemaps");
  const idx = all.findIndex((v) => v.session_id === sessionId);
  const map: ValueMap = {
    id: idx !== -1 ? all[idx].id : generateId(),
    session_id: sessionId,
    ...data,
    created_at: new Date().toISOString(),
  };
  if (idx !== -1) {
    all[idx] = map;
  } else {
    all.push(map);
  }
  setStore("ld_valuemaps", all);
  return map;
}

// --- Proposal Letter ---
export function getLetter(sessionId: string): ProposalLetter | undefined {
  return getStore<ProposalLetter>("ld_letters").find(
    (l) => l.session_id === sessionId
  );
}

export function saveLetter(
  sessionId: string,
  data: Partial<ProposalLetter>
): ProposalLetter {
  const all = getStore<ProposalLetter>("ld_letters");
  const idx = all.findIndex((l) => l.session_id === sessionId);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    setStore("ld_letters", all);
    return all[idx];
  }
  const letter: ProposalLetter = {
    id: generateId(),
    session_id: sessionId,
    ai_draft: "",
    edited_content: "",
    personal_note: "",
    sent_at: null,
    sent_via: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...data,
  };
  all.push(letter);
  setStore("ld_letters", all);
  return letter;
}

// --- Event Bus (for cross-tab sync simulation) ---
type Listener = (data: unknown) => void;
const listeners: Record<string, Listener[]> = {};

export function subscribe(channel: string, callback: Listener): () => void {
  if (!listeners[channel]) listeners[channel] = [];
  listeners[channel].push(callback);
  return () => {
    listeners[channel] = listeners[channel].filter((l) => l !== callback);
  };
}

export function emit(channel: string, data: unknown): void {
  if (listeners[channel]) {
    listeners[channel].forEach((l) => l(data));
  }
  // Also use BroadcastChannel for cross-tab
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    const bc = new BroadcastChannel(`ld_${channel}`);
    bc.postMessage(data);
    bc.close();
  }
}

export function subscribeBroadcast(
  channel: string,
  callback: Listener
): () => void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return () => {};
  }
  const bc = new BroadcastChannel(`ld_${channel}`);
  bc.onmessage = (e) => callback(e.data);
  return () => bc.close();
}
