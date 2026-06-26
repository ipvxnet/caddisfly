// Localized default section titles.
//
// New sections are created with empty content (`content_json: '{}'`), so the
// template renders its built-in defaults until the user edits. Those defaults
// were hardcoded in English, which made a freshly-added section show e.g.
// "Gallery" on a Portuguese site. `sectionDefault()` returns a heading/subhead
// in the site's language instead. Templates call it as the fallback for an
// empty `data.heading` / `data.subheading`.

const DEFAULTS = {
  en: {
    hero: ['Welcome', 'Your business tagline'],
    about: ['About Us', 'Our Story'],
    services: ['Our Services', 'What we offer'],
    features: ['Why Choose Us', 'What sets us apart'],
    gallery: ['Gallery', 'Our Work'],
    testimonials: ['What Our Customers Say', ''],
    pricing: ['Pricing', 'Simple, honest pricing'],
    stats: ['By the Numbers', ''],
    cta: ['Ready to get started?', ''],
    contact: ['Get in Touch', 'We’d love to hear from you'],
    instagram_feed: ["What's happening", 'Our latest posts'],
    members: ['Members', 'Sign in to access members-only content.'],
  },
  es: {
    hero: ['Bienvenido', 'El eslogan de tu negocio'],
    about: ['Sobre Nosotros', 'Nuestra Historia'],
    services: ['Nuestros Servicios', 'Lo que ofrecemos'],
    features: ['Por Qué Elegirnos', 'Lo que nos distingue'],
    gallery: ['Galería', 'Nuestro Trabajo'],
    testimonials: ['Lo Que Dicen Nuestros Clientes', ''],
    pricing: ['Precios', 'Precios simples y honestos'],
    stats: ['En Números', ''],
    cta: ['¿Listo para empezar?', ''],
    contact: ['Contáctanos', 'Nos encantaría saber de ti'],
    instagram_feed: ['Lo último', 'Nuestras publicaciones recientes'],
    members: ['Miembros', 'Inicia sesión para ver el contenido exclusivo.'],
  },
  pt: {
    hero: ['Bem-vindo', 'O slogan do seu negócio'],
    about: ['Sobre Nós', 'Nossa História'],
    services: ['Nossos Serviços', 'O que oferecemos'],
    features: ['Por Que Nos Escolher', 'O que nos diferencia'],
    gallery: ['Galeria', 'Nosso Trabalho'],
    testimonials: ['O Que Dizem Nossos Clientes', ''],
    pricing: ['Preços', 'Preços simples e honestos'],
    stats: ['Em Números', ''],
    cta: ['Pronto para começar?', ''],
    contact: ['Fale Conosco', 'Adoraríamos ouvir você'],
    instagram_feed: ['O que há de novo', 'Nossas publicações recentes'],
    members: ['Membros', 'Entre para acessar o conteúdo exclusivo.'],
  },
};

/**
 * Localized default title for a section type.
 * @param {string} lang - 'en' | 'es' | 'pt'
 * @param {string} type - section type (gallery, about, …)
 * @param {number} [idx] - 0 = heading, 1 = subheading
 * @returns {string}
 */
export function sectionDefault(lang, type, idx = 0) {
  const set = DEFAULTS[lang] || DEFAULTS.en;
  const pair = set[type] || DEFAULTS.en[type];
  return (pair && pair[idx]) || '';
}

// ---------------------------------------------------------------------------
// Localized micro-copy + default ITEM content.
//
// `sectionDefault()` above covers headings/subheadings. But when a section is
// added it's seeded with only those, so the template renders its built-in
// ITEM defaults (feature cards, stats, team, etc.) and small UI strings (CTA
// button text, footer labels). Those used to be hardcoded English — on an
// es/pt site that showed English placeholders under a localized heading.
// `uiText()` and `defaultItems()` give templates a localized fallback instead.
// Keep these in sync across en/es/pt.
// ---------------------------------------------------------------------------

const UI = {
  en: {
    cta: 'Get Started', scroll: 'Scroll Down', follow_us: 'Follow Us', quick_links: 'Quick Links',
    rights: 'All rights reserved', role_customer: 'Customer', role_founder: 'Founder & Owner',
    nav_about: 'About', nav_services: 'Services', nav_contact: 'Contact',
    business: 'Your Business', tagline: 'Making a difference',
    meet_team: 'Meet the Team', our_journey: 'Our Journey',
    estimate: 'Get a Free Estimate', rated: 'Rated 5.0', trusted_homeowners: 'Trusted by local homeowners',
    per_month: 'per month', most_popular: 'Most Popular',
  },
  es: {
    cta: 'Comenzar', scroll: 'Desplázate', follow_us: 'Síguenos', quick_links: 'Enlaces',
    rights: 'Todos los derechos reservados', role_customer: 'Cliente', role_founder: 'Fundador y Propietario',
    nav_about: 'Nosotros', nav_services: 'Servicios', nav_contact: 'Contacto',
    business: 'Tu Negocio', tagline: 'Marcando la diferencia',
    meet_team: 'Conoce al Equipo', our_journey: 'Nuestra Trayectoria',
    estimate: 'Solicita un Presupuesto', rated: 'Calificación 5.0', trusted_homeowners: 'La confianza de los vecinos',
    per_month: 'al mes', most_popular: 'Más Popular',
  },
  pt: {
    cta: 'Começar', scroll: 'Role para baixo', follow_us: 'Siga-nos', quick_links: 'Links',
    rights: 'Todos os direitos reservados', role_customer: 'Cliente', role_founder: 'Fundador e Proprietário',
    nav_about: 'Sobre', nav_services: 'Serviços', nav_contact: 'Contato',
    business: 'Seu Negócio', tagline: 'Fazendo a diferença',
    meet_team: 'Conheça a Equipe', our_journey: 'Nossa Jornada',
    estimate: 'Solicite um Orçamento', rated: 'Nota 5.0', trusted_homeowners: 'A confiança dos moradores locais',
    per_month: 'por mês', most_popular: 'Mais Popular',
  },
};

/** Localized micro-copy used as a template default (cta button, footer labels…). */
export function uiText(lang, key) {
  const set = UI[lang] || UI.en;
  return set[key] || UI.en[key] || '';
}

const ITEMS = {
  en: {
    'features-grid': [
      { icon: '⚡', title: 'Lightning Fast', description: 'Optimized for speed and performance' },
      { icon: '🔒', title: 'Secure', description: 'Enterprise-grade security built-in' },
      { icon: '📱', title: 'Responsive', description: 'Works perfectly on all devices' },
      { icon: '🎨', title: 'Customizable', description: 'Tailor everything to your brand' },
      { icon: '📈', title: 'Scalable', description: 'Grows with your business needs' },
      { icon: '🛟', title: '24/7 Support', description: 'Always here when you need us' },
    ],
    'features-actions': [
      { icon: '📅', title: 'Book Appointment', description: 'Schedule online in seconds', link: '#contact' },
      { icon: '📞', title: 'Call Us', description: 'We’re happy to help', link: '#contact' },
      { icon: '📍', title: 'Find Us', description: 'Get directions', link: '#contact' },
    ],
    'features-steps': [
      { icon: '💬', title: 'Reach Out', description: 'Book a free, no-pressure consultation to share what’s on your mind.' },
      { icon: '🤝', title: 'First Session', description: 'We get to know each other and shape a plan that fits your goals.' },
      { icon: '🌱', title: 'Ongoing Support', description: 'Regular sessions and steady progress, at a pace that feels right.' },
    ],
    stats: [
      { number: '10K+', label:'Happy Customers' },
      { number: '50K+', label:'Projects Completed' },
      { number: '99.9%', label: 'Uptime Guarantee' },
      { number: '24/7', label: 'Customer Support' },
    ],
    services: [
      { title: 'Consulting', description: 'Expert advice tailored to your unique needs and goals', icon: '💡' },
      { title: 'Implementation', description: 'Seamless execution from planning to deployment', icon: '⚙️' },
      { title: 'Support', description: '24/7 assistance to keep your operations running smoothly', icon: '🛟' },
      { title: 'Training', description: 'Comprehensive training programs for your team', icon: '📚' },
    ],
    'services-placeholder': [
      { title: 'Service 1', description: 'Description of service 1', icon: '🚀' },
      { title: 'Service 2', description: 'Description of service 2', icon: '💡' },
      { title: 'Service 3', description: 'Description of service 3', icon: '⭐' },
    ],
    'about-values': ['Quality', 'Innovation', 'Customer Focus'],
    'about-story': 'We are passionate about what we do.',
    'founder-story': 'We built this around a simple belief: do great work, and treat people right.',
    'about-team': [
      { name: 'Sarah Johnson', role: 'CEO & Founder', bio: 'Visionary leader with 15 years of industry experience' },
      { name: 'Michael Chen', role: 'CTO', bio: 'Technology expert driving innovation and excellence' },
      { name: 'Emily Rodriguez', role: 'Head of Design', bio: 'Creative director crafting exceptional user experiences' },
      { name: 'David Park', role: 'Head of Operations', bio: 'Operations specialist ensuring seamless execution' },
    ],
    'about-timeline': [
      { title: 'Founded', description: 'Started with a vision to make a difference' },
      { title: 'First Milestone', description: 'Reached 100 satisfied customers' },
      { title: 'Growth', description: 'Expanded our team and services' },
      { title: 'Today', description: 'Leading the industry with innovation' },
    ],
    'hero-quote-badges': ['Licensed & Insured', 'Free Estimates', '24/7 Emergency'],
    'gallery-captions': ['Modern workspace', 'Collaborative environment', 'Innovation hub', 'Creative space'],
    pricing: [
      { name: 'Starter', price: '$29', features: ['5 Projects', '10 GB Storage', 'Email Support', 'Basic Analytics'], highlighted: false },
      { name: 'Professional', price: '$79', features: ['Unlimited Projects', '100 GB Storage', 'Priority Support', 'Advanced Analytics', 'Custom Domain'], highlighted: true },
      { name: 'Enterprise', price: '$199', features: ['Unlimited Everything', '1 TB Storage', '24/7 Phone Support', 'White Label', 'Dedicated Account Manager'], highlighted: false },
    ],
  },
  es: {
    'features-grid': [
      { icon: '⚡', title: 'Ultrarrápido', description: 'Optimizado para velocidad y rendimiento' },
      { icon: '🔒', title: 'Seguro', description: 'Seguridad de nivel empresarial integrada' },
      { icon: '📱', title: 'Adaptable', description: 'Funciona perfectamente en todos los dispositivos' },
      { icon: '🎨', title: 'Personalizable', description: 'Adapta todo a tu marca' },
      { icon: '📈', title: 'Escalable', description: 'Crece con las necesidades de tu negocio' },
      { icon: '🛟', title: 'Soporte 24/7', description: 'Siempre aquí cuando lo necesitas' },
    ],
    'features-actions': [
      { icon: '📅', title: 'Reservar Cita', description: 'Agenda en línea en segundos', link: '#contact' },
      { icon: '📞', title: 'Llámanos', description: 'Con gusto te ayudamos', link: '#contact' },
      { icon: '📍', title: 'Cómo Llegar', description: 'Obtén indicaciones', link: '#contact' },
    ],
    'features-steps': [
      { icon: '💬', title: 'Contáctanos', description: 'Reserva una consulta gratuita y sin compromiso para contarnos lo que te preocupa.' },
      { icon: '🤝', title: 'Primera Sesión', description: 'Nos conocemos y creamos un plan a la medida de tus objetivos.' },
      { icon: '🌱', title: 'Apoyo Continuo', description: 'Sesiones regulares y progreso constante, a un ritmo que te resulte cómodo.' },
    ],
    stats: [
      { number: '10K+', label:'Clientes Satisfechos' },
      { number: '50K+', label:'Proyectos Completados' },
      { number: '99.9%', label: 'Tiempo de Actividad' },
      { number: '24/7', label: 'Atención al Cliente' },
    ],
    services: [
      { title: 'Consultoría', description: 'Asesoría experta adaptada a tus necesidades y objetivos', icon: '💡' },
      { title: 'Implementación', description: 'Ejecución impecable desde la planificación hasta la puesta en marcha', icon: '⚙️' },
      { title: 'Soporte', description: 'Asistencia 24/7 para mantener tus operaciones funcionando', icon: '🛟' },
      { title: 'Capacitación', description: 'Programas de formación integrales para tu equipo', icon: '📚' },
    ],
    'services-placeholder': [
      { title: 'Servicio 1', description: 'Descripción del servicio 1', icon: '🚀' },
      { title: 'Servicio 2', description: 'Descripción del servicio 2', icon: '💡' },
      { title: 'Servicio 3', description: 'Descripción del servicio 3', icon: '⭐' },
    ],
    'about-values': ['Calidad', 'Innovación', 'Enfoque en el Cliente'],
    'about-story': 'Nos apasiona lo que hacemos.',
    'founder-story': 'Construimos esto sobre una idea simple: hacer un gran trabajo y tratar bien a las personas.',
    'about-team': [
      { name: 'Sarah Johnson', role: 'Directora General y Fundadora', bio: 'Líder visionaria con 15 años de experiencia en el sector' },
      { name: 'Michael Chen', role: 'Director de Tecnología', bio: 'Experto en tecnología que impulsa la innovación y la excelencia' },
      { name: 'Emily Rodriguez', role: 'Directora de Diseño', bio: 'Directora creativa que crea experiencias excepcionales' },
      { name: 'David Park', role: 'Director de Operaciones', bio: 'Especialista en operaciones que garantiza una ejecución impecable' },
    ],
    'about-timeline': [
      { title: 'Fundación', description: 'Comenzamos con la visión de marcar la diferencia' },
      { title: 'Primer Hito', description: 'Alcanzamos 100 clientes satisfechos' },
      { title: 'Crecimiento', description: 'Ampliamos nuestro equipo y servicios' },
      { title: 'Hoy', description: 'Liderando el sector con innovación' },
    ],
    'hero-quote-badges': ['Con Licencia y Asegurado', 'Presupuestos Gratis', 'Emergencias 24/7'],
    'gallery-captions': ['Espacio de trabajo moderno', 'Ambiente colaborativo', 'Centro de innovación', 'Espacio creativo'],
    pricing: [
      { name: 'Inicial', price: '$29', features: ['5 Proyectos', '10 GB de Almacenamiento', 'Soporte por Correo', 'Analíticas Básicas'], highlighted: false },
      { name: 'Profesional', price: '$79', features: ['Proyectos Ilimitados', '100 GB de Almacenamiento', 'Soporte Prioritario', 'Analíticas Avanzadas', 'Dominio Personalizado'], highlighted: true },
      { name: 'Empresarial', price: '$199', features: ['Todo Ilimitado', '1 TB de Almacenamiento', 'Soporte Telefónico 24/7', 'Marca Blanca', 'Gerente de Cuenta Dedicado'], highlighted: false },
    ],
  },
  pt: {
    'features-grid': [
      { icon: '⚡', title: 'Ultrarrápido', description: 'Otimizado para velocidade e desempenho' },
      { icon: '🔒', title: 'Seguro', description: 'Segurança de nível empresarial integrada' },
      { icon: '📱', title: 'Responsivo', description: 'Funciona perfeitamente em todos os dispositivos' },
      { icon: '🎨', title: 'Personalizável', description: 'Adapte tudo à sua marca' },
      { icon: '📈', title: 'Escalável', description: 'Cresce com as necessidades do seu negócio' },
      { icon: '🛟', title: 'Suporte 24/7', description: 'Sempre aqui quando você precisa' },
    ],
    'features-actions': [
      { icon: '📅', title: 'Agendar', description: 'Agende online em segundos', link: '#contact' },
      { icon: '📞', title: 'Ligue para Nós', description: 'Teremos prazer em ajudar', link: '#contact' },
      { icon: '📍', title: 'Como Chegar', description: 'Ver direções', link: '#contact' },
    ],
    'features-steps': [
      { icon: '💬', title: 'Fale Conosco', description: 'Agende uma consulta gratuita e sem compromisso para compartilhar o que está sentindo.' },
      { icon: '🤝', title: 'Primeira Sessão', description: 'Nos conhecemos e montamos um plano sob medida para seus objetivos.' },
      { icon: '🌱', title: 'Apoio Contínuo', description: 'Sessões regulares e progresso constante, no ritmo certo para você.' },
    ],
    stats: [
      { number: '10K+', label:'Clientes Satisfeitos' },
      { number: '50K+', label:'Projetos Concluídos' },
      { number: '99,9%', label: 'Disponibilidade' },
      { number: '24/7', label: 'Suporte ao Cliente' },
    ],
    services: [
      { title: 'Consultoria', description: 'Aconselhamento especializado sob medida para suas necessidades e objetivos', icon: '💡' },
      { title: 'Implementação', description: 'Execução impecável do planejamento à entrega', icon: '⚙️' },
      { title: 'Suporte', description: 'Assistência 24/7 para manter suas operações funcionando', icon: '🛟' },
      { title: 'Treinamento', description: 'Programas de treinamento completos para sua equipe', icon: '📚' },
    ],
    'services-placeholder': [
      { title: 'Serviço 1', description: 'Descrição do serviço 1', icon: '🚀' },
      { title: 'Serviço 2', description: 'Descrição do serviço 2', icon: '💡' },
      { title: 'Serviço 3', description: 'Descrição do serviço 3', icon: '⭐' },
    ],
    'about-values': ['Qualidade', 'Inovação', 'Foco no Cliente'],
    'about-story': 'Somos apaixonados pelo que fazemos.',
    'founder-story': 'Construímos isto a partir de uma crença simples: fazer um ótimo trabalho e tratar bem as pessoas.',
    'about-team': [
      { name: 'Sarah Johnson', role: 'CEO e Fundadora', bio: 'Líder visionária com 15 anos de experiência no setor' },
      { name: 'Michael Chen', role: 'Diretor de Tecnologia', bio: 'Especialista em tecnologia que impulsiona inovação e excelência' },
      { name: 'Emily Rodriguez', role: 'Diretora de Design', bio: 'Diretora criativa que cria experiências excepcionais' },
      { name: 'David Park', role: 'Diretor de Operações', bio: 'Especialista em operações que garante execução impecável' },
    ],
    'about-timeline': [
      { title: 'Fundação', description: 'Começamos com a visão de fazer a diferença' },
      { title: 'Primeiro Marco', description: 'Alcançamos 100 clientes satisfeitos' },
      { title: 'Crescimento', description: 'Ampliamos nossa equipe e serviços' },
      { title: 'Hoje', description: 'Liderando o setor com inovação' },
    ],
    'hero-quote-badges': ['Licenciado e Segurado', 'Orçamento Grátis', 'Emergência 24/7'],
    'gallery-captions': ['Espaço de trabalho moderno', 'Ambiente colaborativo', 'Polo de inovação', 'Espaço criativo'],
    pricing: [
      { name: 'Inicial', price: '$29', features: ['5 Projetos', '10 GB de Armazenamento', 'Suporte por E-mail', 'Análises Básicas'], highlighted: false },
      { name: 'Profissional', price: '$79', features: ['Projetos Ilimitados', '100 GB de Armazenamento', 'Suporte Prioritário', 'Análises Avançadas', 'Domínio Personalizado'], highlighted: true },
      { name: 'Empresarial', price: '$199', features: ['Tudo Ilimitado', '1 TB de Armazenamento', 'Suporte Telefônico 24/7', 'Marca Branca', 'Gerente de Conta Dedicado'], highlighted: false },
    ],
  },
};

/**
 * Localized default ITEM content for a section, used when the section was added
 * without items (so the template doesn't fall back to English). Returns a fresh
 * copy so callers can mutate safely.
 * @param {string} lang
 * @param {string} key - e.g. 'features-grid', 'stats', 'services', 'about-team'
 * @returns {Array|string} localized default (array of items, or a string for story/values)
 */
export function defaultItems(lang, key) {
  const set = ITEMS[lang] || ITEMS.en;
  const val = set[key] != null ? set[key] : ITEMS.en[key];
  if (Array.isArray(val)) return val.map((it) => (typeof it === 'object' ? { ...it } : it));
  return val;
}
