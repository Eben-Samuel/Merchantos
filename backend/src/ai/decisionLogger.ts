import { getDb } from '../config/database';
import { generateId, now } from '../utils/helpers';

export type Actor = 'ai' | 'customer' | 'merchant' | 'system' | 'policy';
export type ActionStatus = 'success' | 'failed' | 'pending' | 'blocked';

export interface AuditEventInput {
  order_id?: string;
  session_id: string;
  actor: Actor;
  action: string;
  reason: string;
  status: ActionStatus;
  details?: Record<string, any>;
}

/**
 * AuditAgent — Records every AI action as an audit event.
 * Provides the decision timeline for transparency and compliance.
 */
export class AuditAgent {
  async log(input: AuditEventInput): Promise<string> {
    const db = await getDb();
    const id = generateId('evt');
    await db.run(
      `INSERT INTO audit_events (id, order_id, session_id, actor, action, reason, status, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, input.order_id || null, input.session_id, input.actor, input.action,
      input.reason, input.status, JSON.stringify(input.details || {}), now()
    );
    return id;
  }

  async getTimeline(sessionId: string, orderId?: string): Promise<any[]> {
    const db = await getDb();
    const params = orderId
      ? { $1: sessionId, $2: orderId }
      : { $1: sessionId, $2: null };

    let rows;
    if (orderId) {
      rows = await db.all(
        `SELECT id, order_id, session_id, actor, action, reason, status, details_json, created_at
         FROM audit_events WHERE session_id = ? AND (order_id = ? OR order_id IS NULL)
         ORDER BY created_at ASC`,
        sessionId, orderId
      );
    } else {
      rows = await db.all(
        `SELECT id, order_id, session_id, actor, action, reason, status, details_json, created_at
         FROM audit_events WHERE session_id = ? ORDER BY created_at ASC`,
        sessionId
      );
    }

    return rows.map(r => ({
      id: r.id,
      order_id: r.order_id,
      actor: r.actor,
      action: r.action,
      reason: r.reason,
      status: r.status,
      details: r.details_json ? JSON.parse(r.details_json) : {},
      timestamp: r.created_at,
    }));
  }

  async logAIAction(sessionId: string, orderId: string | null, actionType: string, input: any, output: any, confidence: number, approved: boolean): Promise<string> {
    const db = await getDb();
    const id = generateId('ai');
    await db.run(
      `INSERT INTO ai_actions (id, session_id, order_id, action_type, input_json, output_json, confidence, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, sessionId, orderId, actionType, JSON.stringify(input), JSON.stringify(output), confidence, approved ? 1 : 0, now()
    );
    return id;
  }

  async getAIActionHistory(sessionId: string): Promise<any[]> {
    const db = await getDb();
    const rows = await db.all(
      `SELECT id, session_id, action_type, input_json, output_json, confidence, approved, created_at
       FROM ai_actions WHERE session_id = ? ORDER BY created_at ASC`,
      sessionId
    );
    return rows.map(r => ({
      id: r.id,
      action_type: r.action_type,
      input: r.input_json ? JSON.parse(r.input_json) : {},
      output: r.output_json ? JSON.parse(r.output_json) : {},
      confidence: r.confidence,
      approved: r.approved === 1,
      timestamp: r.created_at,
    }));
  }
}

export const auditAgent = new AuditAgent();
