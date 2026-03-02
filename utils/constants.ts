import { StatusInfo, StatusKey } from "@/types";

export const STATUS_MAP: Record<StatusKey, StatusInfo> = {
  S: {
    label: "S",
    meaning: "契約済み",
    color: "text-white",
    bgColor: "bg-status-s",
    frequency: "決済までフォロー",
  },
  A: {
    label: "A",
    meaning: "契約目前",
    color: "text-white",
    bgColor: "bg-status-a",
    frequency: "毎日〜2日に1回",
  },
  B: {
    label: "B",
    meaning: "提案中",
    color: "text-black",
    bgColor: "bg-status-b",
    frequency: "週1〜2回",
  },
  C: {
    label: "C",
    meaning: "ヒアリング済",
    color: "text-white",
    bgColor: "bg-status-c",
    frequency: "週1回",
  },
  D: {
    label: "D",
    meaning: "初回接触済",
    color: "text-white",
    bgColor: "bg-status-d",
    frequency: "2週に1回",
  },
  E: {
    label: "E",
    meaning: "リスト段階",
    color: "text-white",
    bgColor: "bg-status-e",
    frequency: "月1回",
  },
};

export const STATUS_ORDER: StatusKey[] = ["S", "A", "B", "C", "D", "E"];

export const CUSTOMER_TYPES = ["買主", "売主", "売買両方"] as const;

export const STAFF_LIST = ["トミー", "翼"] as const;

export const SOURCE_LIST = [
  "税理士紹介",
  "建築会社紹介",
  "自社反響",
  "既存顧客紹介",
  "その他",
] as const;

export const ACTION_TYPES = [
  "電話",
  "メール",
  "LINE",
  "物件紹介",
  "案内",
  "訪問",
  "契約手続き",
  "その他",
] as const;

export const REACTION_TYPES = [
  "気に入った",
  "検討中",
  "却下",
  "未確認",
] as const;

export const PROPERTY_TYPES = [
  "土地",
  "戸建",
  "マンション",
  "事業用",
] as const;

export const LOAN_STATUSES = [
  "未実施",
  "審査中",
  "承認済み",
  "現金",
] as const;

export const CURRENT_STATUSES = [
  "居住中",
  "空家",
  "更地",
  "賃貸中",
] as const;

export const SALE_REASONS = [
  "相続",
  "住替え",
  "資産整理",
  "その他",
] as const;

export const MEDIATION_TYPES = [
  "専属専任",
  "専任",
  "一般",
  "未締結",
] as const;
