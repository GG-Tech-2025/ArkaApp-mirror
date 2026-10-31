// Input checks and the temporary-password generator for provision-organization.
// Kept free of any Supabase or Deno-server code so it is easy to read and reuse.

export interface ProvisionInput {
  organizationName: string;
  slug: string;
  branchName: string;
  branchCode: string;
  adminEmail: string;
  adminPhone: string;
  contactEmail: string | null;
  /** First renewal date of the new client's first branch, YYYY-MM-DD. */
  renewalDate: string;
  /** Optional: when they last paid (already paid at sign-up), YYYY-MM-DD. */
  lastPaymentDate: string | null;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{7,20}$/;

/** A real calendar date in YYYY-MM-DD form (2026-02-30 is not one). */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Returns the cleaned input, or the first problem found, written for the person using the screen. */
export function validateInput(body: unknown): { ok: true; value: ProvisionInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const organizationName = text(b.organizationName);
  const slug = text(b.slug, 60);
  const branchName = text(b.branchName);
  const branchCode = text(b.branchCode, 20);
  const adminEmail = text(b.adminEmail).toLowerCase();
  const adminPhone = text(b.adminPhone, 20);
  const contactEmail = text(b.contactEmail) || null;
  const renewalDate = text(b.renewalDate, 10);
  const lastPaymentDate = text(b.lastPaymentDate, 10) || null;

  if (!organizationName) return { ok: false, error: "Organization name is required" };
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters and numbers, with single hyphens between words" };
  }
  if (!branchName) return { ok: false, error: "Branch name is required" };
  if (!branchCode) return { ok: false, error: "Branch code is required" };
  if (!EMAIL_RE.test(adminEmail)) return { ok: false, error: "Admin email is not a valid email address" };
  if (!PHONE_RE.test(adminPhone)) return { ok: false, error: "Admin phone must be 7 to 20 digits" };
  if (contactEmail && !EMAIL_RE.test(contactEmail)) return { ok: false, error: "Contact email is not a valid email address" };
  if (!isIsoDate(renewalDate)) return { ok: false, error: "Renewal date is required" };
  if (lastPaymentDate && !isIsoDate(lastPaymentDate)) return { ok: false, error: "Last payment date is not a valid date" };

  return {
    ok: true,
    value: { organizationName, slug, branchName, branchCode, adminEmail, adminPhone, contactEmail, renewalDate, lastPaymentDate },
  };
}

// No 0/O, 1/l/I: the password is read out or copied by a person.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

/** Uniform random index below `n`, without modulo bias. */
function randomIndex(n: number): number {
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** 16 characters with at least one upper-case letter, one lower-case letter and one digit. */
export function generateTemporaryPassword(length = 16): string {
  while (true) {
    let pw = "";
    for (let i = 0; i < length; i++) pw += ALL[randomIndex(ALL.length)];
    if ([...pw].some((c) => UPPER.includes(c)) && [...pw].some((c) => LOWER.includes(c)) && [...pw].some((c) => DIGITS.includes(c))) {
      return pw;
    }
  }
}
