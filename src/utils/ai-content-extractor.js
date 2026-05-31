// AI Content Extractor - Analyzes scraped HTML and extracts sections

import { callWorkersAI, extractJSON } from './ai-content-generator.js';

/**
 * Extract sections from scraped HTML using AI
 * @param {string} html - Scraped HTML content
 * @param {object} env - Environment bindings (for AI)
 * @returns {Promise<array>} Array of sections with type and content
 */
export async function extractSectionsFromHTML(html, env) {
  // Truncate HTML to avoid token limits (keep first 8000 chars which is ~2000 tokens)
  const truncatedHTML = html.substring(0, 8000);

  const prompt = `
Analyze this website HTML and identify the main sections.

For each section found, return JSON with:
- type: one of [hero, about, services, features, pricing, stats, gallery, testimonials, cta, contact, footer]
- order: numerical order (0, 1, 2, etc.)
- content: extracted text/data for that section

Common section types:
- hero: Main landing section with headline and CTA
- about: About us, company info, story
- services: Services offered, what we do
- features: Product features, benefits
- pricing: Pricing plans, packages
- stats: Statistics, numbers, metrics
- gallery: Images, portfolio, work samples
- testimonials: Customer reviews, quotes
- cta: Call to action section
- contact: Contact form, contact info
- footer: Footer with links and info

HTML:
${truncatedHTML}

Return ONLY a JSON array, no explanation:
[
  {
    "type": "hero",
    "order": 0,
    "content": {
      "heading": "extracted heading",
      "subheading": "extracted subheading",
      "cta_text": "button text"
    }
  },
  ...
]
`.trim();

  try {
    const aiResponse = await callWorkersAI(env, prompt, {
      system_message: 'You are a website section analyzer. You ONLY output valid JSON arrays, never explanations.',
      temperature: 0.2,
      max_tokens: 2048,
    });

    let sections = extractJSON(aiResponse);

    // Ensure we got an array
    if (!Array.isArray(sections)) {
      // If AI returned object with sections property, extract it
      if (sections.sections && Array.isArray(sections.sections)) {
        sections = sections.sections;
      } else {
        throw new Error('AI did not return an array of sections');
      }
    }

    // Process each section to extract type-specific content
    return sections.map((section, index) => ({
      type: section.type,
      order: section.order !== undefined ? section.order : index,
      content: extractContentForType(section.type, section.content || {}),
    }));
  } catch (error) {
    console.error('AI section extraction failed:', error);
    // Return default sections as fallback
    return getDefaultSections();
  }
}

/**
 * Extract and normalize content based on section type
 * @param {string} type - Section type
 * @param {object} rawContent - Raw content from AI
 * @returns {object} Normalized content object
 */
function extractContentForType(type, rawContent) {
  switch (type) {
    case 'hero':
      return {
        heading: rawContent.heading || rawContent.title || 'Welcome',
        subheading: rawContent.subheading || rawContent.subtitle || rawContent.description || 'Your business tagline',
        cta_text: rawContent.cta_text || rawContent.button || rawContent.cta || 'Get Started',
        cta_link: rawContent.cta_link || rawContent.link || '#contact',
      };

    case 'about':
      return {
        heading: rawContent.heading || rawContent.title || 'About Us',
        story: rawContent.story || rawContent.description || rawContent.text || 'Our story and mission.',
        values: rawContent.values || [],
      };

    case 'services':
    case 'features':
      return {
        heading: rawContent.heading || rawContent.title || (type === 'services' ? 'Our Services' : 'Features'),
        description: rawContent.description || rawContent.subtitle || '',
        items: Array.isArray(rawContent.items)
          ? rawContent.items
          : Array.isArray(rawContent.services)
          ? rawContent.services
          : Array.isArray(rawContent.features)
          ? rawContent.features
          : [
              { title: 'Service 1', description: 'Description 1', icon: '⚡' },
              { title: 'Service 2', description: 'Description 2', icon: '🎯' },
              { title: 'Service 3', description: 'Description 3', icon: '🚀' },
            ],
      };

    case 'testimonials':
      return {
        heading: rawContent.heading || rawContent.title || 'What Our Clients Say',
        testimonials: Array.isArray(rawContent.testimonials)
          ? rawContent.testimonials
          : Array.isArray(rawContent.items)
          ? rawContent.items
          : [
              { quote: 'Great service!', author: 'Client Name', role: 'Company' },
              { quote: 'Highly recommended!', author: 'Client Name', role: 'Company' },
            ],
      };

    case 'contact':
      return {
        heading: rawContent.heading || rawContent.title || 'Get In Touch',
        email: rawContent.email || 'contact@example.com',
        phone: rawContent.phone || '',
        address: rawContent.address || '',
      };

    case 'footer':
      return {
        company_name: rawContent.company_name || rawContent.name || 'Company Name',
        description: rawContent.description || '',
        social_links: rawContent.social_links || [],
        links: Array.isArray(rawContent.links) ? rawContent.links : [],
      };

    case 'pricing':
      return {
        heading: rawContent.heading || rawContent.title || 'Pricing Plans',
        plans: Array.isArray(rawContent.plans)
          ? rawContent.plans
          : [
              { name: 'Basic', price: '$29', features: ['Feature 1', 'Feature 2'] },
              { name: 'Pro', price: '$99', features: ['Feature 1', 'Feature 2', 'Feature 3'] },
            ],
      };

    case 'stats':
      return {
        heading: rawContent.heading || rawContent.title || 'Our Impact',
        stats: Array.isArray(rawContent.stats)
          ? rawContent.stats
          : [
              { number: '1000+', label: 'Clients' },
              { number: '50+', label: 'Projects' },
              { number: '99%', label: 'Satisfaction' },
            ],
      };

    case 'gallery':
      return {
        heading: rawContent.heading || rawContent.title || 'Gallery',
        images: Array.isArray(rawContent.images) ? rawContent.images : [],
      };

    case 'cta':
      return {
        heading: rawContent.heading || rawContent.title || 'Ready to Get Started?',
        description: rawContent.description || rawContent.text || '',
        cta_text: rawContent.cta_text || rawContent.button || 'Contact Us',
        cta_link: rawContent.cta_link || rawContent.link || '#contact',
      };

    default:
      return rawContent;
  }
}

/**
 * Get default sections as fallback
 * @returns {array} Default section configuration
 */
function getDefaultSections() {
  return [
    {
      type: 'hero',
      order: 0,
      content: {
        heading: 'Welcome to Our Website',
        subheading: 'We provide excellent services',
        cta_text: 'Get Started',
        cta_link: '#contact',
      },
    },
    {
      type: 'about',
      order: 1,
      content: {
        heading: 'About Us',
        story: 'Learn more about our company and what we do.',
        values: [],
      },
    },
    {
      type: 'services',
      order: 2,
      content: {
        heading: 'Our Services',
        description: 'What we offer',
        items: [
          { title: 'Service 1', description: 'First service', icon: '⚡' },
          { title: 'Service 2', description: 'Second service', icon: '🎯' },
          { title: 'Service 3', description: 'Third service', icon: '🚀' },
        ],
      },
    },
    {
      type: 'contact',
      order: 3,
      content: {
        heading: 'Get In Touch',
        email: 'contact@example.com',
        phone: '',
        address: '',
      },
    },
    {
      type: 'footer',
      order: 4,
      content: {
        company_name: 'Company Name',
        description: '',
        social_links: [],
        links: [],
      },
    },
  ];
}

/**
 * Get default template variant for a section type
 * @param {string} sectionType - Section type
 * @returns {string} Default variant name
 */
export function getDefaultVariant(sectionType) {
  const defaults = {
    hero: 'centered',
    about: 'text-image',
    services: 'icon-grid',
    features: 'grid',
    testimonials: 'cards',
    gallery: 'masonry',
    contact: 'form',
    footer: 'multi-column',
    pricing: 'tables',
    stats: 'numbers',
    cta: 'banner',
  };

  return defaults[sectionType] || 'default';
}
