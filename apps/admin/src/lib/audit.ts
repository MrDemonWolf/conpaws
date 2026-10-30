/** An audit_log insert to put in the same batch as the change it records. */
export function auditStatement(
  database: D1Database,
  input: {
    actor: string;
    action: string;
    resourceType: string;
    resourceId: string;
    summary: string;
  },
) {
  return database
    .prepare(
      `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.actor,
      input.action,
      input.resourceType,
      input.resourceId,
      input.summary,
    );
}
