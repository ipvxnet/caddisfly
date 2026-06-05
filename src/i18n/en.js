// English dictionary (source of truth). Keys are grouped by surface. {var}
// placeholders are interpolated by t(). Spanish/Portuguese mirror this shape.

export const en = {
  lang: { label: 'Language' },

  nav: {
    how_it_works: 'How it works',
    pricing: 'Pricing',
    features: 'Features',
    help: 'Help',
    dashboard: 'Dashboard',
    build: 'Build with AI',
    credits: '{n} credits',
  },

  footer: {
    tagline: 'Build a beautiful website with AI.',
    pricing: 'Pricing',
    help: 'Help',
    support: 'Support',
    terms: 'Terms',
    privacy: 'Privacy',
    billing: 'Billing',
    rights: '© {year} Caddisfly. All rights reserved.',
  },

  landing: {
    eyebrow: 'AI website builder',
    hero_h1_html: 'Launch a <span class="grad-text">beautiful website</span><br>in minutes — with AI.',
    hero_sub: 'Chat with AI to build a brand-new, multi-page site — or instantly refactor your existing website into a clean, modern design. On-brand, customizable, ready to publish.',
    trust: 'No code. No templates to wrestle with. Free preview.',
    cta_build: '✨ Build with AI',
    cta_refactor: 'Refactor my site',

    paths_title: 'Two ways to get a great site',
    paths_sub: 'Start from a conversation, or start from your current site. Either way you get a modern, editable result.',
    step1_t: 'Tell us about you', step1_d: 'Answer a few questions, or paste your existing site.',
    step2_t: 'AI builds your pages', step2_d: 'A full multi-page site with on-brand copy, layout & images.',
    step3_t: 'Customize & publish', step3_d: 'Tweak anything with live AI editing, then go live in one click.',
    build_tag: 'Showcase',
    build_title: 'Build with AI',
    build_lead: 'Describe your business in plain words. AI asks a few smart questions, then generates a full multi-page website — copy, layout, and real photos included.',
    build_li1: 'Conversational, no forms to fill in',
    build_li2: 'Multi-page with real navigation',
    build_li3: 'Live editing & AI tweaks per section',
    build_li4: 'Themes, fonts & colors in a click',
    build_li_seo: '🔎 Auto-SEO — titles, descriptions & markup written for you',
    build_cta: 'Start building →',
    build_note: 'Takes about a minute to first preview.',

    refactor_tag: 'Refactor',
    refactor_title: 'Refactor your site',
    refactor_lead: 'Already have a website? Paste your URL and we’ll rebuild it into a clean, modern design using your real business details — with SEO generated automatically.',
    refactor_email: 'Your email',
    refactor_url: 'Your website URL',
    refactor_agree: 'I agree to the {terms} and {privacy}.',
    refactor_btn: 'Get my free preview',
    refactor_note: 'We’ll email you a link to confirm and build your preview.',

    how_title: 'How it works',
    feats_title: 'Everything you need to ship',
    feat_multipage_t: 'Multi-page sites',
    feat_multipage_d: 'Home, About, Services, Contact & more — with real navigation.',
    feat_seo_t: 'Auto-SEO',
    feat_seo_d: 'Every site ships search-ready — page titles, meta descriptions, social cards, sitemaps & Google business markup, generated automatically. Tweak any page, or let it run on autopilot.',
    feat_aiedit_t: 'AI section editing',
    feat_aiedit_d: 'Chat to rewrite copy or generate new images, right in the editor.',
    feat_themes_t: 'Themes & fonts',
    feat_themes_d: 'Switch the whole look — light, dark, gold — in a single click.',
    feat_photos_t: 'Real photos',
    feat_photos_d: 'On-brand imagery pulled in automatically, or generate your own.',
    feat_responsive_t: 'Responsive',
    feat_responsive_d: 'Looks sharp on every screen, out of the box.',
    feat_publish_t: 'One-click publish',
    feat_publish_d: 'Push your site live to a shareable URL when you’re ready.',

    cta_band_title: 'Ready to build?',
    cta_band_sub: 'Start with AI in under a minute — completely free to preview.',
    cta_band_btn: '✨ Build with AI',
  },

  builder: {
    title: 'Build Your Website with AI',
    subtitle: 'Just describe your business. AI handles the rest — design, copy, and automatic SEO. Get a professional, search-ready website in minutes.',
    get_started: 'Get Started Now',
    email_label: 'Your Email',
    email_ph: 'you@example.com',
    prompt_label: 'What kind of website do you need?',
    prompt_ph: 'e.g., I need a website for my bakery with an online menu and contact form…',
    lang_label: 'Language of your website',
    submit: 'Start building →',
  },

  loading: {
    generating_title: '🎨 Creating Your Website',
    generating_sub: 'AI is generating your personalized website…',
    step_analyzing: 'Analyzing your requirements',
    step_generating: 'Generating content with AI',
    step_design: 'Creating design system',
    step_sections: 'Building website sections',
    step_seo: 'Optimizing for search (SEO)',
    step_finalizing: 'Finalizing your website',
    status_complete: 'Complete! Redirecting…',
    building_title: 'Building your site…',
    building_sub: 'We’re identifying your business, assembling your pages, and optimizing everything for search — AI writes your titles, descriptions & SEO automatically. Hang tight — this usually takes under a minute.',
    joke_label: '😄 A joke while you wait',
  },

  convo: {
    ui: {
      title: 'Create Your Website',
      step_of: 'Step {current} of {total}',
      generating: 'Generating content…',
      send: 'Send Answer →',
      continue: 'Continue →',
      sending: 'Sending…',
      type_answer: 'Type your answer…',
      err_enter: 'Please enter an answer',
      err_select: 'Please select at least one option',
    },
    q: {
      initial_prompt: 'What kind of website do you need? Describe your business or project.',
      business_info: 'What’s your business or project name?',
      features: 'Which sections would you like on your website?',
      audience: 'Who is your target audience?',
      style: 'Choose a visual style for your website',
      content_source: 'How would you like to provide content?',
      review: 'Great! Let me generate your website preview…',
    },
    ph: {
      initial_prompt: 'e.g., A bakery website with online ordering, a portfolio for my photography…',
      business_info: 'e.g., Sweet Delights Bakery',
      audience: 'e.g., Local customers looking for fresh baked goods, wedding planners…',
    },
    opt: {
      hero_l: 'Hero / Landing Section', hero_d: 'Eye-catching introduction with call-to-action',
      about_l: 'About Us', about_d: 'Tell your story and mission',
      services_l: 'Services / Products', services_d: 'Showcase what you offer',
      features_l: 'Features', features_d: 'Highlight key features and benefits',
      pricing_l: 'Pricing Plans', pricing_d: 'Display pricing options and plans',
      stats_l: 'Stats / Numbers', stats_d: 'Showcase impressive metrics',
      gallery_l: 'Photo Gallery', gallery_d: 'Visual showcase of your work',
      testimonials_l: 'Customer Reviews', testimonials_d: 'Social proof and testimonials',
      cta_l: 'Call-to-Action', cta_d: 'Conversion-focused banner',
      contact_l: 'Contact Form', contact_d: 'Let visitors get in touch',
      footer_l: 'Footer', footer_d: 'Contact info and social links',
      modern_l: 'Modern', modern_d: 'Clean lines, gradients, contemporary feel',
      classic_l: 'Classic', classic_d: 'Timeless, elegant, professional',
      minimal_l: 'Minimal', minimal_d: 'Simple, focused, lots of white space',
      bold_l: 'Bold', bold_d: 'Vibrant colors, strong typography, energetic',
      ai_generate_l: 'AI Generate', ai_generate_d: 'Let AI create content based on your answers (you can edit later)',
      upload_l: 'I’ll Upload', upload_d: 'Upload your own text and images',
      hybrid_l: 'Mix of Both', hybrid_d: 'AI generates some content, you upload specific items',
    },
  },

  pricing: {
    h1: 'Simple pricing.', h1_accent: 'More for less.',
    hero_p: 'AI builds your site — and you get far more storage for far less than the big builders. Start free, upgrade when you grow.',
    monthly: 'Monthly', annual: 'Annual',
    per_mo: '/mo', per_yr: '/yr', months_free: '2 months free', most_popular: 'Most popular',
    vs_big: '25 GB for $9',
    vs_small: '— where the big builders give you <strong>2 GB for $17</strong>. Built on Cloudflare R2, so storage is cheap and we pass it on.',
    note: 'All plans include the AI builder, multi-page sites, live editing, themes & one-click publish. Cancel anytime.',
    faq_title: 'Questions',
    cta_title: 'Start building — free', cta_sub: 'Your first site is a minute away.', cta_btn: '✨ Build with AI',
    free_name: 'Free', free_tag: 'Try it, ship a site.', free_cta: 'Start free',
    starter_name: 'Starter', starter_tag: 'For a polished personal or small-biz site.', starter_cta: 'Get Starter',
    pro_name: 'Pro', pro_tag: 'For freelancers & growing businesses.', pro_cta: 'Get Pro',
    agency_name: 'Agency', agency_tag: 'For studios building many sites.', agency_cta: 'Get Agency',
    features: {
      free: ['1 published site', '1 GB storage', '50 AI credits / mo', 'caddisfly.app subdomain', 'AI builder + 1 refactor', 'Community support'],
      starter: ['3 published sites', '<strong>25 GB</strong> storage', '500 AI credits / mo', '1 custom domain', 'Remove “Built with Caddisfly”', 'AI image generation', 'Email support'],
      pro: ['15 published sites', '<strong>100 GB</strong> storage', '2,000 AI credits / mo', '5 custom domains', 'Priority AI image generation', 'Everything in Starter', 'Priority support'],
      agency: ['Unlimited sites', '<strong>500 GB+</strong> storage', '8,000 AI credits / mo', 'Unlimited custom domains', 'Bulk refactor', 'Everything in Pro', 'Priority+ support'],
    },
    faqs: [
      ['What’s an “AI credit”?', 'Credits cover the AI work behind your site. Roughly: a full AI site build ≈ 20 credits, an AI text edit ≈ 1, an AI-generated image ≈ 5, refactoring an existing site ≈ 10. Your monthly allotment resets each cycle.'],
      ['Is there really a free plan?', 'Yes — build and publish 1 site on a caddisfly subdomain with a small monthly AI allotment, free forever. No card required.'],
      ['Can I use my own domain?', 'Custom domains are included on paid plans (1 on Starter, 5 on Pro, unlimited on Agency). Free sites get a caddisfly subdomain.'],
      ['How is this cheaper than Wix & co?', 'We’re AI-native and run on Cloudflare’s edge — storage and bandwidth cost us a fraction, so we give you more and charge less. We don’t bundle e-commerce add-ons you may not need.'],
      ['Can I cancel or switch plans?', 'Anytime — upgrade, downgrade, or cancel from your account. No long-term contracts.'],
    ],
  },

  dash: {
    meta_title: 'Dashboard — Caddisfly',
    title: 'Your websites',
    plan_billing: 'Plan & billing →',
    signed_in_as: 'Signed in as',
    support: 'Support', help: 'Help', sign_out: 'Sign out',
    no_sites: 'You have no websites yet.', build_one: 'Build one →',
    live: 'Live', not_published: 'Not published yet',
    customize: 'Customize', analytics: 'Analytics', inbox: 'Inbox', blog: 'Blog', open: 'Open ↗',
    custom_domain: 'Custom domain',
    shared_by: 'Websites shared by {owner}', no_sites_yet: 'No websites yet.',
    your_team: 'Your team', team_owned_by: 'Team · owned by {owner}',
    seats: '{seats} / {limit} seats',
    you_are_owner: 'You’re the <strong>owner</strong> (admin) of this team.',
    you_are_admin: 'You’re an <strong>admin</strong> of this team.',
    you_are_member: 'You’re a <strong>member</strong> of this team.',
    role_member: 'member', role_publisher: 'publisher', role_admin: 'admin', role_owner: 'owner',
    invited: 'invited', you: 'you', leave: 'Leave', remove: 'Remove',
    paid_feature: 'Team members are a paid feature.', upgrade: 'Upgrade',
    seat_caps: '(Starter 5 · Pro 15 · Agency 50)',
    invite_ph: 'teammate@example.com', invite_btn: 'Invite', inviting: 'Inviting…',
    seats_full: 'All seats are in use.', upgrade_more: 'Upgrade for more.',
    roles_legend: 'Roles — <strong>member</strong>: edit content · <strong>publisher</strong>: edit + publish · <strong>admin</strong>: manage team &amp; domains',
    remove_confirm: 'Remove {email} from the team?',
  },

  sup: {
    meta_title: 'Support — Caddisfly',
    title: 'Support', help_docs: 'Help & docs →',
    signed_in: 'Signed in as {email}. Open a ticket and we’ll reply by email.',
    sent: '✓ Your ticket was submitted — we’ll reply by email.',
    replied: '✓ Reply sent.',
    new_ticket: 'Open a new ticket',
    subject: 'Subject', subject_ph: 'Briefly, what’s going on?',
    type: 'Type', type_issue: 'Issue / bug', type_request: 'Feature request',
    details: 'Details', details_ph: 'Describe the issue or request. Include the site name / URL if relevant.',
    submit: 'Submit ticket',
    your_tickets: 'Your tickets', no_tickets: 'You have no tickets yet.', updated: 'updated {date}',
    not_found: 'Ticket not found.', back: 'Back to support', all_tickets: '← All tickets',
    staff: 'Caddisfly Support',
    closed_note: 'This ticket is closed. Replying will re-open it.',
    add_reply: 'Add a reply', reply_ph: 'Type your reply…', send_reply: 'Send reply',
    st_open: 'open', st_in_progress: 'in progress', st_closed: 'closed',
    ty_issue: 'issue', ty_request: 'request',
  },

  bill: {
    meta_title: 'Billing — Caddisfly',
    manage_billing: 'Manage billing',
    intent_plan: 'Sign in to continue to {plan} checkout. We’ll email you a one-time link — no password.',
    intent_default: 'Enter your email and we’ll send a one-time sign-in link — no password needed.',
    email_label: 'Email address', email_btn: 'Email me a sign-in link',
    same_email: 'Use the same email you used to build your site so your plan applies to it.',
    n_checkout_ok: '✓ Subscription active — thank you! It may take a few seconds to reflect below.',
    n_checkout_cancel: 'Checkout cancelled. No charge was made.',
    n_credits_ok: '✓ Credits purchased — thank you! Your balance updates below in a few seconds.',
    n_credits_cancel: 'Credit purchase cancelled. No charge was made.',
    n_sent: '✓ Check your email for a sign-in link (expires in 15 min).',
    n_expired: 'That sign-in link was invalid or expired. Request a new one below.',
    your_billing: 'Your billing',
    your_sites_team: '← Your websites & team', sign_out: 'Sign out',
    not_configured: 'Billing isn’t enabled in this environment yet. Plan changes are temporarily unavailable.',
    two_months_free: '(2 months free)', continue_checkout: 'Continue to checkout →',
    manage_sub: 'Manage subscription',
    manage_sub_sub: 'Update your card, switch plans, or cancel — in the secure Stripe portal.',
    open_portal: 'Open billing portal →',
    upgrade: 'Upgrade', upgrade_sub: 'Annual = 2 months free. Cancel anytime.',
    monthly: 'Monthly', annual: 'Annual',
    credits_label: '✨ Caddi Credits', available: 'available',
    credits_breakdown: '{m} of {a} monthly + {p} purchased', monthly_resets: ' · monthly resets {date}',
    buy_more: 'Buy more →', credits_unit: '{n} credits', buy: 'Buy',
    buy_credits: 'Buy Caddi Credits',
    buy_credits_sub: 'A one-time top-up for when you need more AI mid-build — purchased credits never expire (flat 50 credits / $1).',
    current_plan: 'Current plan', k_plan: 'Plan', k_status: 'Status', k_billing: 'Billing',
    renews_on: 'Renews on', cancels_on: 'Cancels on',
  },

  cust: {
    credits_title: 'Caddi Credits — {m} monthly + {p} purchased. Click to buy more.',
    dashboard: '🏠 Dashboard', dashboard_title: 'Your websites & team',
    analytics: '📊 Analytics', analytics_title: 'Traffic analytics for your published site',
    blog: '📝 Blog', blog_title: 'Write and publish blog posts with AI',
    full_preview: 'View Full Preview', deploy: 'Deploy Website',
    pages: 'Pages', add_page: '+ Page', add_page_title: 'Add a page',
    rename: 'Rename', delete_page: 'Delete page', home_page: 'Home page',
    sitewide: 'Site-wide', sitewide_note: '· shown on every page',
    sections_of: '{page} sections',
    sections_hint: 'Click a section to select it, then <strong>✨ Edit</strong> — drag to reorder, or move it to another page.',
    no_sections: 'No sections on this page yet.',
    add_section: '+ Add section', add_section_title: 'Add a new section to this page',
    design_summary: '🎨 Design — theme, colors & fonts',
    seo_summary: '🔎 SEO — Google & social preview',
    seo_hint: 'Auto-filled from your business info — every site is SEO-ready. Override this page below; changes apply next time you publish.',
    seo_page_title: 'Page title', seo_meta_desc: 'Meta description',
    seo_social: 'Social share image URL', seo_sitewide: '(site-wide)',
    seo_title_ph_suffix: 'Your business',
    seo_desc_ph: 'A short, compelling summary of this page for search results.',
    save_seo: 'Save SEO', saved: 'Saved ✓', could_not_save_seo: 'Could not save SEO.',
    drag_reorder: 'Drag to reorder', hide_section: 'Hide section', show_section: 'Show section',
    edit: '✨ Edit', edit_title: 'Edit this section with AI', layout_title: 'Layout / template variant',
    move_title: 'Move to another page', delete_section_title: 'Delete this section',
    choose_layout: 'Choose a {label} layout', back: '← Back', link_copied: 'Link copied!',
    site_live: 'Your site is live!', site_live_sub: 'It’s published and publicly accessible at:',
    open_site: 'Open site ↗', copy_link: 'Copy link', copied: 'Copied!', close: 'Close',
    err_network: 'Network error. Please try again.',
    err_add_page: 'Failed to add page: ', err_add_section: 'Failed to add section: ',
    err_del_section: 'Failed to delete section: ', err_rename: 'Failed to rename: ',
    err_del: 'Failed to delete: ', err_move: 'Failed to move section: ',
    err_order: 'Failed to update section order: ', err_visibility: 'Failed to toggle visibility: ',
    err_load_editor: 'Failed to load editor: ', err_switch_tpl: 'Failed to switch template: ',
    err_apply_tpl: 'Failed to apply template: ', err_deploy: 'Deployment failed: ',
  },

  ana: {
    meta_title: 'Analytics — {name}', sub: 'Traffic · last 30 days · cookieless & privacy-first',
    customize: '← Customize', view_site: 'View site ↗',
    page_views: 'Page views', visitors: 'Visitors', active_days: 'Active days',
    views_per_day: 'Views per day', top_pages: 'Top pages', referrers: 'Referrers', countries: 'Countries',
    no_visits: 'No visits in the last 30 days yet. Share your site to start seeing traffic here.',
    no_pages: 'No pages yet.', no_referrers: 'No referrers yet.', no_countries: 'No countries yet.',
    direct: '(direct)', unknown: 'Unknown',
    privacy_note: 'No cookies, no cross-site tracking, and no IP addresses are stored — visitor counts use a daily, per-site anonymous key. See our {privacy}.',
    privacy_link: 'Privacy Policy',
  },

  // Published-site contact-form widget. Status strings are baked into pages at
  // render time in the SITE's language; err_* come back from the submit API in
  // the visitor's language.
  formw: {
    sending: 'Sending…',
    success: '✓ Message sent — thank you!',
    error: 'Something went wrong. Please try again.',
    preview: 'The contact form becomes active when you publish your site.',
    err_fields: 'Please fill out your name, a valid email, and a message.',
    err_rate: 'Too many messages — please try again later.',
  },

  finbox: {
    meta_title: 'Inbox — {name}',
    sub: 'Messages from your site’s contact form',
    customize: '← Customize', analytics: 'Analytics', view_site: 'View site ↗',
    total: '{n} messages', unread: '{n} new', new: 'new',
    reply: 'Reply', delete: 'Delete', delete_confirm: 'Delete this message?',
    empty: 'No messages yet. When visitors submit the contact form on your published site, their messages appear here.',
  },

  // Published-site blog widget (baked in the SITE's language at render time).
  blogw: {
    nav_title: 'Blog',
    list_heading: 'Blog',
    read_more: 'Read more',
    back_to_blog: 'Blog',
    no_posts: 'No posts yet — check back soon!',
  },

  // Blog manager (app UI, viewer's language).
  snap: {
    summary: '🕘 Versions — save & restore',
    hint: 'Save a version of your site before big changes. Restoring replaces your current pages, sections & design (a backup of the current state is saved automatically first). The live site updates when you publish.',
    label_ph: 'Version name (optional)',
    save_btn: '💾 Save version', saving: 'Saving…',
    loading: 'Loading…', empty: 'No saved versions yet.', err: 'Could not load versions.',
    unnamed: 'Unnamed version', auto_backup: '⛑ Auto-backup (before restore)',
    auto_save: '⏱ Auto-save', auto_toggle: 'Auto-save hourly while I’m editing',
    restore: 'Restore', restoring: 'Restoring…',
    restore_confirm: 'Restore this version? Your current pages, sections and design will be replaced. (A backup of the current state is saved automatically, and your published site only changes when you publish.)',
    delete: 'Delete', delete_confirm: 'Delete this saved version? This cannot be undone.',
  },

  blogm: {
    meta_title: 'Blog — {name}',
    title_sub: 'Write with AI, publish to your site, share everywhere',
    customize: '← Customize', view_blog: 'View blog ↗',
    new_post: '✨ New post',
    brief_intro: 'Give the AI a few sentences about what the post should say — it drafts the full post in your site’s language. You edit and publish.',
    brief_label: 'What should the post be about?',
    brief_ph: 'e.g. We’re launching a Mother’s Day brunch special this Sunday — three courses, mimosa included, reservations recommended.',
    draft_ai: '✨ Draft with AI', drafting: 'Drafting…',
    brief_short: 'Tell the AI a bit more — a few sentences work best.',
    credits_note: 'Uses ~10 Caddi Credits per draft.',
    posts_heading: 'Posts',
    st_draft: 'draft', st_published: 'published',
    published_on: 'Published', updated_on: 'Updated',
    preview: 'Preview ↗', edit: 'Edit', publish: 'Publish', unpublish: 'Unpublish',
    social: '📣 Social', delete: 'Delete', delete_confirm: 'Delete this post? This cannot be undone.',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel',
    title_label: 'Title', excerpt_label: 'Excerpt', cover_label: 'Cover image URL',
    cover_ph: 'https://… (or paste an upload URL)',
    content_label: 'Content',
    content_hint: '— "## " for headings, "- " for bullets, **bold**, blank line between paragraphs',
    seo_title_label: 'SEO title (optional)', seo_desc_label: 'SEO description (optional)',
    republish_note: '✓ Saved. Republish your site (Deploy) so the change goes live on your published site.',
    republish_link: 'Open customize →',
    gen_cover: '🖼 AI cover', gen_cover_busy: 'Generating…',
    gen_cover_title: 'Generate a cover image with AI (~5 credits)',
    social_x: '𝕏 / Twitter', social_ig: 'Instagram', social_li: 'LinkedIn',
    copy: 'Copy', copied: 'Copied ✓', share: 'Share ↗',
    ig_note: 'Paste as your caption — Instagram has no pre-filled share link.',
    no_posts: 'No posts yet. Describe your first post above and let the AI draft it.',
  },

  sed: {
    edit_section: 'Edit section', edit_manual: '✏️ Edit fields manually', cancel: 'Cancel', save: 'Save Changes',
    saving: 'Saving…', updated: 'Section updated successfully!', save_failed: 'Failed to save changes', save_failed_p: 'Failed to save: ',
    uploading: 'Uploading…', upload_complete: 'Upload complete!', upload_failed: 'Upload failed', upload_failed_p: 'Upload failed: ',
    not_supported: 'Section type not supported for editing yet.',
    heading: 'Heading', hl_hint: 'Main headline (max 60 characters)',
    subheading: 'Subheading', sub_hint: 'Supporting text (max 120 characters)',
    button_text: 'Button Text', button_link: 'Button Link',
    bg_image: 'Background Image', click_upload: '📸 Click to upload image', img_formats: 'JPG, PNG, WebP (max 5MB)',
    section_heading: 'Section Heading', your_story: 'Your Story', story_hint: 'Tell your story (2-3 sentences)', image: 'Image',
    services_soon: 'Services (editing coming soon)', services_count: 'Currently showing {n} services. Full editing interface coming in next update.',
    testimonials_soon: 'Individual testimonial editing coming soon.', submit_button: 'Submit Button Text',
    photos: 'Photos', photos_hint: '· drag-free reorder, replace, or remove — no new AI images', add_photo: '＋ Add photo',
    business_name: 'Business Name', tagline: 'Tagline', copyright: 'Copyright Text',
    ph_about_us: 'About Us', ph_our_services: 'Our Services', ph_testimonials: 'Testimonials', ph_get_in_touch: 'Get In Touch',
    ph_send_message: 'Send Message', ph_gallery: 'Gallery', ph_get_started: 'Get Started',
    no_photos: 'No photos yet — click “Add photo”.', g_drag: 'Drag to reorder', g_alt_ph: 'Describe this photo (alt text)',
    g_replace: 'Replace', g_replace_t: 'Replace photo', g_remove_t: 'Remove photo',
  },

  aip: {
    title: '✨ AI Edit', sub: 'Tell the AI what to change — it’ll confirm before applying.', send: 'Send',
    own_summary: '📎 Use my own image (upload or URL)', own_summary_video: '📎 Use my own image / video (upload or URL)',
    upload_file: 'Upload a file', or_paste_url: '…or paste a URL', use: 'Use',
    remove_media: '🗑 Remove current image', remove_media_video: '🗑 Remove current image / video',
    thinking: 'Thinking…', failed: 'Failed', my_proposal: 'Here is my proposal.',
    nothing: 'I couldn’t find anything to change for that. Try rephrasing?',
    proposed: 'Proposed changes', will_generate: '🖼️ Will generate {n} image(s).',
    apply: 'Apply', discard: 'Discard', generating: 'Generating…', applying: 'Applying…',
    applied: '✓ Applied', done: 'Done — preview updated.', failed_apply: 'Failed to apply',
    section_updated: 'Section updated!', uploading: 'Uploading…', upload_failed: 'Upload failed',
    applied_your: '✓ Applied your {media}.', image: 'image', video: 'video',
    removing: 'Removing…', removed: '✓ Removed.', invalid_url: 'Enter a valid http(s) URL.', applied_dot: '✓ Applied.',
    ph_default: 'Describe what to change', ph_hero: 'Make the headline punchier', ph_hero_img: 'generate a new background image',
    ph_about: 'Rewrite the story to be warmer', ph_services: 'Add a service for emergency repairs',
    ph_features: 'Make the feature descriptions shorter', ph_testimonials: 'Fix the typo in the first quote',
    ph_contact: 'Change the button to “Book Now”', ph_gallery_img: 'Generate a new photo of the storefront',
    ph_gallery: 'Update the gallery heading', ph_footer: 'Update the tagline',
  },

  pick: {
    tpl_title: '🧩 Choose a Template', tpl_hint: 'Restyle the whole site at once. Your text and colors are kept.',
    font_title: '🔤 Fonts', font_hint: 'Swap the typeface. Sizes and layout stay the same.',
    fonts_updated: 'Fonts updated! Preview refreshing…', fonts_failed: 'Failed to update fonts',
    col_title: '🎨 Website Colors', primary_color: 'Primary Color', secondary_color: 'Secondary Color',
    preview_gradient: 'Preview Gradient', preset_palettes: 'Preset Palettes',
    reset_default: 'Reset to Default', apply_colors: 'Apply Colors', applying: 'Applying…',
    colors_updated: 'Colors updated! Preview refreshing…', colors_failed: 'Failed to save colors',
  },

  dom: {
    type: 'Type', name: 'Name', value: 'Value', copy: 'Copy', copied: 'Copied!',
    active: 'Active', pending: 'Pending', live_at: 'Live at',
    add_record: 'Add this DNS record at your domain provider:',
    and_verification: '…and this verification record:',
    ssl_note: '🔒 Your SSL certificate is issued automatically once the record is live — usually a few minutes. Then click <em>Check status</em>.',
    check_status: 'Check status', remove: 'Remove',
    none_yet: 'No custom domain connected yet.',
    not_enabled: 'Custom domains aren’t enabled in this environment yet — the form is here for setup.',
    connect: 'Connect domain',
    tip: 'Tip: use a subdomain like <code>www.</code> or <code>shop.</code> — these work at any DNS provider. A bare root domain (<code>yourbusiness.com</code>) needs ALIAS / CNAME-flattening, which some providers (e.g. GoDaddy, Namecheap) don’t support.',
    publish_first: 'Publish your site first — then you can point a domain at it.',
    could_not_connect: 'Could not connect that domain.', network_err: 'Network error. Please try again.',
    gate_default: 'Custom domains are available on paid plans.',
    gate_upgrade: 'Upgrade your plan', gate_dashboard: 'Go to dashboard',
    gate_note: 'Signed out or new here? Log in with your email on that page, choose a paid plan, then come back to connect your domain.',
    still_pending: 'Still pending — DNS and SSL can take a few minutes to validate after you add the records. Check again shortly.',
    could_not_check: 'Could not check status right now.',
    disconnect_confirm: 'Disconnect this domain from your site?',
    could_not_remove: 'Could not remove the domain.',
  },

  help: {
    meta_title: 'Help & Docs — Caddisfly',
    h1: 'Help & documentation',
    sub: 'Everything you need to build, customize, publish, and grow your site. Stuck? {support}.',
    open_ticket: 'Open a support ticket',
    cta_q: 'Didn’t find what you need?', cta_btn: 'Open a support ticket →',
    toc: [
      ['getting-started', 'Getting started'], ['customizing', 'Customizing your site'],
      ['publishing', 'Publishing'], ['seo', 'SEO & getting found'],
      ['custom-domains', 'Custom domains & DNS'], ['plans', 'Plans, credits & billing'],
      ['team', 'Team members'], ['faq', 'FAQ'],
    ],
    sections: [
      ['getting-started', 'Getting started', `
        <p>There are two ways to create a site:</p>
        <ul>
          <li><strong>Build with AI</strong> — describe your business and AI generates a complete, on-brand website. Start at <a href="/ai-builder">Build with AI</a>.</li>
          <li><strong>Refactor an existing site</strong> — enter your current website URL and we rebuild it cleaner. You’ll confirm your email, then we generate a preview.</li>
        </ul>
        <p>Both land you in the <strong>Customize</strong> editor with a live preview.</p>`],
      ['customizing', 'Customizing your site', `
        <ul>
          <li><strong>Sections</strong> — click a section to select it, then <strong>✨ Edit</strong> (text, images, or AI-assisted changes). Drag the ⋮⋮ handle to reorder.</li>
          <li><strong>Add / remove</strong> — <strong>+ Add section</strong> adds a section and lets you choose its layout; the 🗑 button removes one. Header &amp; footer are site-wide.</li>
          <li><strong>Pages</strong> — add pages with the <strong>+ Page</strong> tab and move sections between them.</li>
          <li><strong>Gallery</strong> — open a gallery’s editor to drag-reorder, replace, remove, or add individual photos (no AI re-roll needed).</li>
          <li><strong>Design</strong> — the 🎨 Design panel switches the whole-site theme, colors, and fonts at once.</li>
        </ul>`],
      ['publishing', 'Publishing', `
        <p>Click <strong>Deploy Website</strong> in Customize. Your site goes live on a free address like <code>yourbusiness.caddisfly.app</code>, and we show you a clickable link. Re-deploy any time after making changes — re-publishing on a paid plan also removes the “Built with Caddisfly” badge.</p>`],
      ['seo', 'SEO & getting found', `
        <p>Every site you publish is <strong>search-ready out of the box</strong> — no setup required. Caddisfly automatically adds:</p>
        <ul>
          <li><strong>Page titles &amp; meta descriptions</strong> for each page, drawn from your business name and content.</li>
          <li><strong>Social share cards</strong> (Open Graph / Twitter) so links look great when shared.</li>
          <li><strong>Google business markup</strong> (LocalBusiness structured data) using your name, description, phone, and address when available.</li>
          <li>A <strong>canonical URL</strong>, a per-site <code>robots.txt</code>, and a <code>sitemap.xml</code> so search engines can crawl every page. On a custom domain, your own domain is treated as the canonical one.</li>
        </ul>
        <p><strong>Fine-tune any page:</strong> open <strong>Customize</strong> → the <strong>🔎 SEO</strong> panel. Edit the page title and meta description (with a live Google-result preview), and set a site-wide social share image. Leave anything blank and we use the smart auto values. Changes apply the next time you publish.</p>
        <p>After publishing, submit your <code>sitemap.xml</code> in <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a> to get indexed faster.</p>`],
      ['custom-domains', 'Custom domains & DNS', `
        <p>On a paid plan you can point your own domain at your site. Open <strong>🌐 Custom domain</strong> (in Customize or on your <a href="/dashboard">Dashboard</a>) and enter a domain.</p>
        <ol>
          <li><strong>Use a subdomain</strong> like <code>www.yourbusiness.com</code> — it works at any DNS provider.</li>
          <li>Add the single <strong>CNAME</strong> record we show you at your DNS provider (GoDaddy, Namecheap, Route 53, Cloudflare, etc.): <br><code>www</code> &nbsp;→&nbsp; <code>sites.caddisfly.app</code></li>
          <li>That’s it — your <strong>SSL certificate is issued automatically</strong> once the record is live (usually a few minutes). Click <strong>Check status</strong>; when it reads <strong>Active</strong>, you’re live over HTTPS.</li>
        </ol>
        <p><strong>Root domains:</strong> a bare <code>yourbusiness.com</code> can’t use a CNAME by DNS rules. If your provider supports ALIAS/ANAME or CNAME-flattening (Cloudflare, Route 53, DNSimple) you can use it; otherwise point <code>www</code> to us and redirect the root to <code>www</code> at your registrar.</p>`],
      ['plans', 'Plans, credits & billing', `
        <ul>
          <li><strong>Plans</strong> — Free, Starter, Pro, Agency. Higher tiers add sites, AI credits, custom domains, and team seats. See <a href="/pricing">Pricing</a>.</li>
          <li><strong>Caddi Credits</strong> — spent on AI actions. Each plan includes a monthly allotment (resets monthly); one-time top-ups never expire.</li>
          <li><strong>Manage</strong> — upgrade, change plan, or cancel anytime from <a href="/billing">Billing</a>.</li>
        </ul>`],
      ['team', 'Team members', `
        <p>Invite teammates from your <a href="/dashboard">Dashboard</a> → <strong>Team</strong>. They get an email link that signs them in and joins your team, where they can work on your websites.</p>
        <ul>
          <li><strong>Roles</strong> — the owner is admin; admins can invite, promote (member ↔ admin), and remove members.</li>
          <li><strong>Seats</strong> (including you): Starter 5 · Pro 15 · Agency 50.</li>
        </ul>`],
    ],
    faqs: [
      ['Is Caddisfly free to use?', 'Yes — you can build and preview a site for free, and publish one site on a free <code>*.caddisfly.app</code> subdomain. Paid plans add more sites, AI credits, custom domains, and team seats.'],
      ['How do I edit the text and images on my site?', 'Open <strong>Customize</strong> on your site, click a section, then <strong>✨ Edit</strong>. You can edit text directly, upload your own images, or describe a change and let AI apply it. Gallery photos can be reordered (drag), replaced, or removed individually.'],
      ['Can I add or remove sections?', 'Yes. In Customize, use <strong>+ Add section</strong> to add a new section (and pick its layout), or select a section and use the 🗑 button to remove it. Header and footer are shared across pages and can’t be removed.'],
      ['How do I connect my own domain?', 'On a published site, open <strong>🌐 Custom domain</strong> (in Customize or on your Dashboard), enter a subdomain like <code>www.yourbusiness.com</code>, and add the single <strong>CNAME</strong> record we show you at your DNS provider. Your SSL certificate is issued automatically — see <a href="#custom-domains">Custom domains &amp; DNS</a>.'],
      ['Why should I use a subdomain (www) instead of my root domain?', 'A subdomain (<code>www.</code>, <code>shop.</code>, etc.) works at every DNS provider with a simple CNAME. A bare root domain (<code>yourbusiness.com</code>) can’t use a CNAME by DNS rules — it needs ALIAS/CNAME-flattening, which some providers (e.g. GoDaddy, Namecheap) don’t offer. If you only have the root, point <code>www</code> to us and set a redirect from the root to <code>www</code>.'],
      ['How long until my custom domain works?', 'After you add the CNAME, DNS propagation and SSL issuance usually take a few minutes. Click <strong>Check status</strong> in the domain panel; once it shows <strong>Active</strong>, your site is live over HTTPS.'],
      ['What are Caddi Credits?', 'Credits are spent on AI actions (generating content, AI image creation, AI edits). Each plan includes a monthly allotment that resets every month, plus you can buy one-time top-up credits that never expire.'],
      ['How do team members work?', 'Invite teammates by email from your <strong>Dashboard</strong>. They get a link that signs them in and joins your team, where they can access your websites. You (the owner) and any admins can invite, promote, or remove members. Seat limits: Starter 5, Pro 15, Agency 50 (including you).'],
      ['Is my site good for SEO? Do I need to set anything up?', 'Every published site is search-ready automatically — page titles, meta descriptions, social share cards, Google business (LocalBusiness) markup, a canonical URL, <code>robots.txt</code>, and a <code>sitemap.xml</code>, all generated for you. To customize a page, open <strong>Customize → 🔎 SEO</strong> and edit the title and description with a live Google-result preview. See <a href="#seo">SEO &amp; getting found</a>.'],
      ['Can I get a refund?', 'Subscriptions can be cancelled anytime from <strong>Billing</strong> (you keep access until the period ends). For-convenience terminations are pro-rated per our <a href="/terms">Terms</a>.'],
      ['I need help or found a bug.', 'Open a ticket from <a href="/support">Support</a> — describe the issue or request and we’ll get back to you by email.'],
    ],
  },
};
