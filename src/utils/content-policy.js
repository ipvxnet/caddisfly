// Acceptable Use screening for AI-builder input. Deliberately CONSERVATIVE:
// it targets clearly-prohibited, high-severity categories so it doesn't block
// legitimate businesses (e.g. a licensed pharmacy, a bar, an addiction clinic).
// Nuance is also enforced model-side via POLICY_INSTRUCTION in the system prompt.
// Mirrors the Acceptable Use Policy on /terms.

const PATTERNS = [
  {
    category: 'child_exploitation',
    severity: 'critical',
    re: /(child\s*(porn|sexual|abuse|exploitation)|under\s*age\s*(sex|porn|nude|naked)|underage\s*(sex|porn|nude|naked)|pedophil|lolicon|cp\s*porn|minors?\s*(nude|naked|sexual|porn))/i,
  },
  {
    category: 'sexual_explicit',
    severity: 'high',
    // NOTE: bare "xxx" is intentionally NOT matched alone — AI product copy uses
    // "XXX" as a spec placeholder ("up to XXX HP", "Part #XXX"), which falsely
    // flagged a turbocharger description. Only match "xxx" in a porn context.
    re: /(pornograph|pornhub|xxx[\s.-]*(porn|sex|video|adult|rated|hub|cam)|(porn|hardcore|adult)[\s.-]*xxx|hardcore\s*sex|sex\s*cam|adult\s*(video|webcam|cam\s*site)|escort\s*service|prostitut|nude\s*model|onlyfans)/i,
  },
  {
    category: 'illegal_drugs',
    severity: 'high',
    re: /\b(buy|sell|sale|order|shop|store|purchase|cheap)\b[^.?!\n]{0,40}\b(cocaine|heroin|meth(amphetamine)?|mdma|ecstasy|lsd|fentanyl|crack\s*cocaine|illegal\s*drugs?|controlled\s*substances?)\b/i,
  },
  {
    category: 'weapons',
    severity: 'high',
    // NOTE: bare "explosive(s)" is intentionally NOT here — it's a common
    // marketing adjective ("explosive power/growth/acceleration") that caused
    // false positives on legit products (e.g. a diesel turbocharger). Match
    // specific explosive DEVICES instead.
    re: /\b(buy|sell|order|purchase|unlicensed|untraceable|ghost|illegal)\b[^.?!\n]{0,30}\b(guns?|firearms?|ammunition|grenades?|silencers?|detonators?|dynamite|pipe\s*bombs?)\b/i,
  },
  {
    category: 'malware_fraud',
    severity: 'high',
    re: /(phishing\s*(kit|site|page)|ransomware|spyware|keylogger|carding|stolen\s*credit\s*cards?|fake\s*ids?|counterfeit\s*(money|currency|cash))/i,
  },
];

/**
 * Strip an echoed POLICY_INSTRUCTION that weak models sometimes parrot into
 * their OUTPUT. Without this the generated text screens against itself — the
 * policy wording contains "pornographic"/"sexually explicit"/"weapons" — and
 * legit copy gets false-blocked. Apply to AI output before screening/storing.
 * @param {string} text
 * @returns {string}
 */
export function stripPolicyEcho(text) {
  return String(text == null ? '' : text).split(/\n+\s*CONTENT POLICY\b/i)[0].trim();
}

/**
 * Screen free-text user input against the Acceptable Use Policy.
 * @param {string} text
 * @returns {{allowed:boolean, category?:string, severity?:string, message?:string}}
 */
export function screenContent(text) {
  if (!text || typeof text !== 'string') return { allowed: true };
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      return { allowed: false, category: p.category, severity: p.severity, message: messageFor(p.category) };
    }
  }
  return { allowed: true };
}

function messageFor(category) {
  if (category === 'child_exploitation') {
    return 'This request involves content that exploits or endangers minors, which is strictly prohibited and may be reported to authorities. The request was blocked.';
  }
  return "This request appears to involve content prohibited by our Acceptable Use Policy (such as sexually explicit material, illegal drugs or weapons, or fraud). Please revise your request — see /terms.";
}

/** Standard error body for a blocked request (HTTP 422). */
export function policyError(screen) {
  return {
    success: false,
    error: screen.message,
    policy_violation: true,
    category: screen.category,
    terms_url: '/terms',
  };
}

// Appended to AI generation/edit system prompts so the model itself refuses
// prohibited content even when input screening doesn't catch it.
export const POLICY_INSTRUCTION =
  'CONTENT POLICY (strict, non-negotiable): Never generate website content that is sexually explicit or pornographic; that sexualizes, exploits, or endangers minors; that sells or promotes illegal drugs or unlicensed weapons; that promotes hate, harassment, violence, or terrorism; or that facilitates fraud, malware, or other illegal activity. If the request calls for such content, do NOT produce it — instead return neutral, generic placeholder business content.';
