/** Kinds produzidos pelo cron (mesmos do relativeDay em handlers/cron.ts). */
export type NotificationKind = "due_in_3d" | "due_in_1d" | "due_today" | "overdue";

/**
 * Nome AppNotification (e não Notification) de propósito: `Notification` já é um
 * tipo global do DOM (Web Notifications API) e o shadowing confunde.
 *
 * Espelha 1:1 as colunas de farm_notifications. Não há criação pelo app: quem
 * produz é o cron (service_role). O usuário só lê, marca lida e limpa.
 */
export interface AppNotification {
  id: string;
  organization_id: string;
  user_id: string;
  /** NotificationKind hoje; text no banco pra não travar kinds futuros. */
  kind: string;
  title: string;
  body: string | null;
  /** Origem: uma das duas (conta OU tarefa). */
  receipt_id: string | null;
  task_id: string | null;
  read_at: string | null;
  created_at: string;
}
