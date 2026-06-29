-- Optional contact-form fields (Company, Phone, Subject, Address, Preferred
-- contact method). The owner toggles which show in the contact section's
-- content_json.form_fields; the visitor's answers are stored here as a small
-- JSON object keyed by field key (NULL when no optional fields were filled).
ALTER TABLE form_submissions ADD COLUMN extra_json TEXT;
