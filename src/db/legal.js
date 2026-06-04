// Editable legal documents (Terms, Privacy). One row per slug; absence means
// the public page uses the built-in default. See migrations/016_legal_documents.sql.

/** Fetch a stored legal doc, or null if none (→ caller uses the default). */
export async function getLegalDoc(db, slug) {
  return db
    .prepare('SELECT slug, body, updated_by, updated_at FROM legal_documents WHERE slug = ?')
    .bind(slug)
    .first();
}

/** Create or replace the stored body for a slug. */
export async function upsertLegalDoc(db, slug, { body, updatedBy }) {
  await db
    .prepare(
      `INSERT INTO legal_documents (slug, body, updated_by, updated_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(slug) DO UPDATE SET
         body = excluded.body,
         updated_by = excluded.updated_by,
         updated_at = unixepoch()`
    )
    .bind(slug, body, updatedBy || null)
    .run();
  return getLegalDoc(db, slug);
}

/** Remove the override so the public page reverts to the built-in default. */
export async function deleteLegalDoc(db, slug) {
  await db.prepare('DELETE FROM legal_documents WHERE slug = ?').bind(slug).run();
}
