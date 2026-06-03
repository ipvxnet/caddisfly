// AI Prompt Templates for Content Generation

/**
 * Build a prompt block that grounds copy in the business's real, scraped site
 * content. Returns '' when there's nothing, so prompts stay clean.
 * @param {string} sourceMaterial
 * @returns {string}
 */
function sourceMaterialBlock(sourceMaterial) {
  if (!sourceMaterial) return '';
  return `\n\nSOURCE MATERIAL from the business's existing website — base the copy on THIS so it reflects what they actually do. Do not invent a different business or generic filler:\n${sourceMaterial}`;
}

/**
 * Extract structured data from initial prompt
 * @param {string} userPrompt - User's initial website description
 * @returns {string} AI prompt
 */
export function extractInitialPromptData(userPrompt) {
  return `Extract key information from this website request and return ONLY valid JSON (no markdown, no explanation):

User request: "${userPrompt}"

Return this JSON structure:
{
  "business_type": "string (e.g., bakery, restaurant, portfolio, consulting)",
  "suggested_name": "string or null if not mentioned",
  "key_features": ["array", "of", "features/sections", "needed"],
  "industry": "string (e.g., food, tech, creative, health)",
  "tone": "string (professional, casual, friendly, elegant)"
}

Only JSON, no explanation.`;
}

/**
 * Extract target audience insights
 * @param {string} audienceDescription - User's audience description
 * @returns {string} AI prompt
 */
export function extractAudienceData(audienceDescription) {
  return `Analyze this target audience description and return ONLY valid JSON (no markdown, no explanation):

Audience: "${audienceDescription}"

Return this JSON structure:
{
  "age_range": "string (e.g., 18-35, 40-60, all ages)",
  "interests": ["array", "of", "interests"],
  "pain_points": ["array", "of", "problems", "they face"],
  "preferred_tone": "string (professional, casual, friendly)"
}

Only JSON, no explanation.`;
}

/**
 * Generate hero section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateHeroContent(context) {
  const { business_name, business_type, audience, tone, description, location, source_material } = context;
  const aboutLine = description ? `\nAbout this business: ${description}` : '';
  const locationLine = location ? `\nLocation: ${location}` : '';
  const sourceLine = sourceMaterialBlock(source_material);

  return `Generate hero section content for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}
Target Audience: ${audience}
Tone: ${tone}${aboutLine}${locationLine}${sourceLine}

Return this JSON structure:
{
  "heading": "string (powerful, attention-grabbing headline, max 60 chars)",
  "subheading": "string (compelling value proposition, max 120 chars)",
  "cta_text": "string (call-to-action button text, max 20 chars)",
  "cta_link": "#contact"
}

Only JSON, no explanation.`;
}

/**
 * Generate about section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateAboutContent(context) {
  const { business_name, business_type, audience, tone, description, source_material } = context;
  const aboutLine = description ? `\nAbout this business: ${description}. Base the story on this — do not invent contradicting facts.` : '';
  const sourceLine = sourceMaterialBlock(source_material);

  return `Generate about section content for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}
Target Audience: ${audience}
Tone: ${tone}${aboutLine}${sourceLine}

Return this JSON structure:
{
  "heading": "string (section heading, max 40 chars)",
  "subheading": "string (brief intro, max 80 chars)",
  "story": "string (compelling story/mission, 2-3 sentences, max 300 chars)",
  "values": ["value 1", "value 2", "value 3"]
}

Only JSON, no explanation.`;
}

/**
 * Generate services section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateServicesContent(context) {
  const { business_name, business_type, audience, tone, service_hints, source_material } = context;
  // When we scraped the real site, the ACTUAL services take priority over the
  // generic per-industry hints.
  const sourceLine = source_material
    ? `\n\nSOURCE MATERIAL from their existing website — extract the ACTUAL services/offerings named here and use them verbatim where possible (real service names, real descriptions). Do NOT invent generic services:\n${source_material}`
    : '';
  const hintLine = service_hints
    ? `\n${source_material ? 'If the source material is thin, ' : 'IMPORTANT: This is a ' + business_type + ' business. '}real services for this kind of business include: ${service_hints}. Never use generic placeholders like "Service 1".`
    : '';

  return `Generate services/products section for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}
Target Audience: ${audience}
Tone: ${tone}${sourceLine}${hintLine}

Return this JSON structure:
{
  "heading": "string (section heading, max 40 chars)",
  "subheading": "string (brief intro, max 100 chars)",
  "services": [
    {
      "title": "string (service name, max 30 chars)",
      "description": "string (brief description, max 120 chars)",
      "icon": "string (emoji or icon name)"
    },
    {
      "title": "string",
      "description": "string",
      "icon": "string"
    },
    {
      "title": "string",
      "description": "string",
      "icon": "string"
    }
  ]
}

Only JSON, no explanation.`;
}

/**
 * Generate testimonials section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateTestimonialsContent(context) {
  const { business_name, business_type, audience } = context;

  return `Generate realistic testimonials for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}
Target Audience: ${audience}

Return this JSON structure:
{
  "heading": "string (section heading, max 40 chars)",
  "subheading": "string (brief intro, max 100 chars)",
  "testimonials": [
    {
      "name": "string (realistic name)",
      "role": "string (job title or relation to business)",
      "text": "string (authentic testimonial, 1-2 sentences, max 200 chars)",
      "rating": 5
    },
    {
      "name": "string",
      "role": "string",
      "text": "string",
      "rating": 5
    },
    {
      "name": "string",
      "role": "string",
      "text": "string",
      "rating": 5
    }
  ]
}

Only JSON, no explanation.`;
}

/**
 * Generate contact section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateContactContent(context) {
  const { business_name, business_type } = context;

  return `Generate contact section content for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}

Return this JSON structure:
{
  "heading": "string (section heading, max 40 chars)",
  "subheading": "string (encouraging message, max 100 chars)",
  "form_fields": [
    { "name": "name", "label": "Your Name", "type": "text", "required": true },
    { "name": "email", "label": "Email Address", "type": "email", "required": true },
    { "name": "message", "label": "Message", "type": "textarea", "required": true }
  ],
  "button_text": "string (submit button text, max 20 chars)"
}

Only JSON, no explanation.`;
}

/**
 * Generate footer content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateFooterContent(context) {
  const { business_name, business_type } = context;

  return `Generate footer content for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}

Return this JSON structure:
{
  "tagline": "string (brief tagline, max 60 chars)",
  "copyright": "${business_name}. All rights reserved.",
  "links": [
    { "label": "About", "url": "#about" },
    { "label": "Services", "url": "#services" },
    { "label": "Contact", "url": "#contact" }
  ],
  "social": [
    { "platform": "facebook", "url": "#" },
    { "platform": "instagram", "url": "#" },
    { "platform": "twitter", "url": "#" }
  ]
}

Only JSON, no explanation.`;
}

/**
 * Generate gallery section content
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function generateGalleryContent(context) {
  const { business_name, business_type } = context;

  return `Generate gallery section content for a ${business_type} website. Return ONLY valid JSON (no markdown, no explanation):

Business: ${business_name}

Return this JSON structure:
{
  "heading": "string (section heading, max 40 chars)",
  "subheading": "string (brief intro, max 100 chars)",
  "images": [
    { "alt": "string (image description)", "caption": "string (optional caption)" },
    { "alt": "string", "caption": "string" },
    { "alt": "string", "caption": "string" },
    { "alt": "string", "caption": "string" }
  ]
}

Only JSON, no explanation.`;
}

/**
 * Get color scheme based on style and industry
 * @param {string} style - Visual style (modern, classic, minimal, bold)
 * @param {string} industry - Business industry
 * @returns {string} AI prompt
 */
export function generateColorScheme(style, industry) {
  return `Suggest a color scheme for a ${style} style website in the ${industry} industry. Return ONLY valid JSON (no markdown, no explanation):

Style: ${style}
Industry: ${industry}

Return this JSON structure:
{
  "primary_color": "string (hex color)",
  "secondary_color": "string (hex color)",
  "accent_color": "string (hex color)",
  "reasoning": "string (brief explanation why these colors work)"
}

Only JSON, no explanation.`;
}

/**
 * Get font pairing based on style
 * @param {string} style - Visual style (modern, classic, minimal, bold)
 * @returns {object} Font pairing (not AI-generated, predefined)
 */
export function getFontPairing(style) {
  const fontPairings = {
    modern: {
      heading: 'Poppins',
      body: 'Inter',
    },
    classic: {
      heading: 'Playfair Display',
      body: 'Lora',
    },
    minimal: {
      heading: 'Space Grotesk',
      body: 'Work Sans',
    },
    bold: {
      heading: 'Montserrat',
      body: 'Raleway',
    },
  };

  return fontPairings[style] || fontPairings.modern;
}

/**
 * Get content generation prompt for a specific section type
 * @param {string} sectionType - Section type
 * @param {object} context - Conversation context
 * @returns {string} AI prompt
 */
export function getContentPrompt(sectionType, context) {
  switch (sectionType) {
    case 'hero':
      return generateHeroContent(context);
    case 'about':
      return generateAboutContent(context);
    case 'services':
      return generateServicesContent(context);
    case 'features':
      // Features use the same {title, description, icon} shape as services.
      return generateServicesContent(context);
    case 'testimonials':
      return generateTestimonialsContent(context);
    case 'contact':
      return generateContactContent(context);
    case 'gallery':
      return generateGalleryContent(context);
    case 'footer':
      return generateFooterContent(context);
    default:
      throw new Error(`Unknown section type: ${sectionType}`);
  }
}
