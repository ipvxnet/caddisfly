// Per-vertical SEO landing content.
//
// Drives the programmatic "/website-builder/:vertical" pages that target queries
// like "AI website builder for restaurants" / "free dentist website builder".
// Each entry carries the genuinely vertical-specific copy (H1, intro, benefits,
// FAQs) that gives every page unique value — generic chrome (header, CTA band,
// cross-links) is shared in vertical-landing.js. `industry` maps to the keys used
// by site-themes.js so templatesForIndustry() can show real, relevant designs.
//
// Localized fields are { en, es, pt }. Arrays are [title, desc] / [question, answer].

export const VERTICALS = {
  restaurants: {
    industry: 'food',
    label: { en: 'Restaurants', es: 'Restaurantes', pt: 'Restaurantes' },
    keyword: { en: 'restaurant website builder', es: 'creador de webs para restaurantes', pt: 'criador de sites para restaurantes' },
    h1: {
      en: 'The free AI website builder for restaurants',
      es: 'El creador de webs con IA gratis para restaurantes',
      pt: 'O criador de sites com IA grátis para restaurantes',
    },
    sub: {
      en: 'Describe your restaurant and AI builds a mouth-watering website — menu, photos, hours, and reservations — ready to publish in minutes. No code, no designer.',
      es: 'Describe tu restaurante y la IA crea una web irresistible — menú, fotos, horarios y reservas — lista para publicar en minutos. Sin código ni diseñador.',
      pt: 'Descreva seu restaurante e a IA cria um site irresistível — cardápio, fotos, horários e reservas — pronto para publicar em minutos. Sem código nem designer.',
    },
    intro: {
      en: 'Most diners check your website before they book a table. Caddisfly gives your restaurant a polished, mobile-first site with your menu front and center — generated from a short description and editable in plain English.',
      es: 'La mayoría de los comensales revisan tu web antes de reservar mesa. Caddisfly le da a tu restaurante un sitio pulido y mobile-first con tu menú en primer plano — generado a partir de una breve descripción y editable en lenguaje natural.',
      pt: 'A maioria dos clientes vê seu site antes de reservar uma mesa. O Caddisfly dá ao seu restaurante um site impecável e mobile-first com o cardápio em destaque — gerado a partir de uma breve descrição e editável em linguagem simples.',
    },
    benefits: {
      en: [
        ['Your menu, beautifully laid out', 'Sections for starters, mains, drinks and specials — with prices and photos that make every dish look its best.'],
        ['Reservations & ordering links', 'Send diners straight to your booking or delivery platform with prominent call-to-action buttons.'],
        ['Looks great on every phone', 'Diners search on mobile. Your site loads fast and looks sharp on any screen, automatically.'],
        ['Hours, location & map', 'Opening hours, address and a one-tap map so guests can find you without calling.'],
      ],
      es: [
        ['Tu menú, bellamente presentado', 'Secciones para entrantes, platos principales, bebidas y especiales — con precios y fotos que lucen cada plato.'],
        ['Enlaces de reservas y pedidos', 'Lleva a los comensales directo a tu plataforma de reservas o delivery con botones destacados.'],
        ['Se ve genial en cualquier móvil', 'La gente busca desde el móvil. Tu sitio carga rápido y se ve impecable en cualquier pantalla, automáticamente.'],
        ['Horario, ubicación y mapa', 'Horarios, dirección y un mapa con un toque para que te encuentren sin llamar.'],
      ],
      pt: [
        ['Seu cardápio, lindamente apresentado', 'Seções para entradas, pratos principais, bebidas e especiais — com preços e fotos que valorizam cada prato.'],
        ['Links de reserva e pedidos', 'Leve os clientes direto à sua plataforma de reservas ou delivery com botões em destaque.'],
        ['Ótimo em qualquer celular', 'As pessoas pesquisam no celular. Seu site carrega rápido e fica perfeito em qualquer tela, automaticamente.'],
        ['Horários, endereço e mapa', 'Horário de funcionamento, endereço e um mapa com um toque para te encontrarem sem ligar.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a restaurant website for free?', 'Yes. Generate and customize your restaurant site for free, then publish on a free caddisfly.app subdomain or connect your own domain on a paid plan.'],
        ['Can I put my full menu online?', 'Absolutely. The AI builds menu sections with dishes, descriptions, prices and photos, and you can edit any item by chatting in plain English.'],
        ['Can guests book a table or order online?', 'Yes — add buttons that link to your reservation system or delivery platform, front and center on the page.'],
        ['Do I need any design or coding skills?', 'None. Describe your restaurant, the AI builds the site, and you refine it with simple instructions or a visual editor.'],
      ],
      es: [
        ['¿Puedo crear una web de restaurante gratis?', 'Sí. Genera y personaliza la web de tu restaurante gratis, y publícala en un subdominio gratuito de caddisfly.app o conecta tu propio dominio con un plan de pago.'],
        ['¿Puedo poner mi menú completo online?', 'Por supuesto. La IA crea secciones de menú con platos, descripciones, precios y fotos, y puedes editar cualquier elemento conversando en lenguaje natural.'],
        ['¿Los clientes pueden reservar o pedir online?', 'Sí — añade botones que enlacen a tu sistema de reservas o plataforma de delivery, bien visibles en la página.'],
        ['¿Necesito saber de diseño o programación?', 'Nada. Describe tu restaurante, la IA crea el sitio y tú lo ajustas con instrucciones sencillas o un editor visual.'],
      ],
      pt: [
        ['Posso criar um site de restaurante grátis?', 'Sim. Gere e personalize o site do seu restaurante de graça e publique em um subdomínio gratuito caddisfly.app ou conecte seu próprio domínio em um plano pago.'],
        ['Posso colocar meu cardápio completo online?', 'Com certeza. A IA cria seções de cardápio com pratos, descrições, preços e fotos, e você edita qualquer item conversando em linguagem simples.'],
        ['Os clientes podem reservar ou pedir online?', 'Sim — adicione botões que levam ao seu sistema de reservas ou plataforma de delivery, em destaque na página.'],
        ['Preciso saber de design ou programação?', 'Nada. Descreva seu restaurante, a IA cria o site e você ajusta com instruções simples ou um editor visual.'],
      ],
    },
  },

  photographers: {
    industry: 'photography',
    label: { en: 'Photographers', es: 'Fotógrafos', pt: 'Fotógrafos' },
    keyword: { en: 'photography website builder', es: 'creador de webs para fotógrafos', pt: 'criador de sites para fotógrafos' },
    h1: {
      en: 'The free AI website builder for photographers',
      es: 'El creador de webs con IA gratis para fotógrafos',
      pt: 'O criador de sites com IA grátis para fotógrafos',
    },
    sub: {
      en: 'Turn your portfolio into a stunning website. AI builds galleries, an about page and a contact form — so your work takes center stage and clients can book you.',
      es: 'Convierte tu portafolio en una web impactante. La IA crea galerías, una página sobre ti y un formulario de contacto — para que tu trabajo brille y los clientes te reserven.',
      pt: 'Transforme seu portfólio em um site impressionante. A IA cria galerias, uma página sobre você e um formulário de contato — para seu trabalho brilhar e os clientes te contratarem.',
    },
    intro: {
      en: 'Your photos deserve a frame as good as the work. Caddisfly builds an image-forward portfolio site with fast-loading galleries and a clear path for clients to enquire — generated from a short brief, no design tools required.',
      es: 'Tus fotos merecen un marco a la altura del trabajo. Caddisfly crea un sitio de portafolio centrado en la imagen, con galerías de carga rápida y un camino claro para que los clientes te contacten — generado a partir de un breve resumen, sin herramientas de diseño.',
      pt: 'Suas fotos merecem uma moldura à altura do trabalho. O Caddisfly cria um site de portfólio focado na imagem, com galerias de carregamento rápido e um caminho claro para os clientes entrarem em contato — gerado a partir de um breve resumo, sem ferramentas de design.',
    },
    benefits: {
      en: [
        ['Galleries that show off your work', 'Clean, full-bleed image grids with lightbox viewing that keep the focus on your photography.'],
        ['Fast-loading, high-quality images', 'Photos are optimized and served in modern formats so your portfolio loads quickly without losing quality.'],
        ['Organized by category', 'Separate pages or sections for weddings, portraits, events or commercial work — whatever you shoot.'],
        ['A built-in enquiry form', 'Clients reach you through a contact form that lands straight in your inbox — no third-party tools.'],
      ],
      es: [
        ['Galerías que lucen tu trabajo', 'Cuadrículas de imágenes a sangre completa con visor lightbox que mantienen el foco en tu fotografía.'],
        ['Imágenes rápidas y de alta calidad', 'Las fotos se optimizan y se sirven en formatos modernos para que tu portafolio cargue rápido sin perder calidad.'],
        ['Organizado por categoría', 'Páginas o secciones separadas para bodas, retratos, eventos o trabajo comercial — lo que fotografíes.'],
        ['Formulario de contacto integrado', 'Los clientes te escriben con un formulario que llega directo a tu bandeja — sin herramientas externas.'],
      ],
      pt: [
        ['Galerias que exibem seu trabalho', 'Grades de imagens em tela cheia com visualização em lightbox que mantêm o foco na sua fotografia.'],
        ['Imagens rápidas e de alta qualidade', 'As fotos são otimizadas e entregues em formatos modernos para o portfólio carregar rápido sem perder qualidade.'],
        ['Organizado por categoria', 'Páginas ou seções separadas para casamentos, retratos, eventos ou trabalho comercial — o que você fotografar.'],
        ['Formulário de contato integrado', 'Os clientes falam com você por um formulário que chega direto na sua caixa de entrada — sem ferramentas externas.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a photography portfolio for free?', 'Yes. Build and customize your portfolio for free and publish it on a free subdomain, or use a custom domain on a paid plan.'],
        ['Will my images stay sharp?', 'Yes. Caddisfly serves optimized, modern image formats that keep your photos crisp while loading fast on any device.'],
        ['Can I have separate galleries?', 'Definitely. Create multiple gallery pages or sections — e.g. weddings, portraits, commercial — and organize them however you like.'],
        ['How do clients get in touch?', 'Every site includes a contact form; submissions arrive in your dashboard and inbox so you never miss an enquiry.'],
      ],
      es: [
        ['¿Puedo crear un portafolio de fotografía gratis?', 'Sí. Crea y personaliza tu portafolio gratis y publícalo en un subdominio gratuito, o usa un dominio propio con un plan de pago.'],
        ['¿Mis imágenes se verán nítidas?', 'Sí. Caddisfly sirve formatos de imagen modernos y optimizados que mantienen tus fotos nítidas y de carga rápida en cualquier dispositivo.'],
        ['¿Puedo tener galerías separadas?', 'Claro. Crea varias páginas o secciones de galería — por ejemplo bodas, retratos, comercial — y organízalas como quieras.'],
        ['¿Cómo me contactan los clientes?', 'Cada sitio incluye un formulario de contacto; los mensajes llegan a tu panel y tu bandeja para que no pierdas ninguna consulta.'],
      ],
      pt: [
        ['Posso criar um portfólio de fotografia grátis?', 'Sim. Crie e personalize seu portfólio de graça e publique em um subdomínio gratuito, ou use um domínio próprio em um plano pago.'],
        ['Minhas imagens vão ficar nítidas?', 'Sim. O Caddisfly entrega formatos de imagem modernos e otimizados que mantêm suas fotos nítidas e com carregamento rápido em qualquer dispositivo.'],
        ['Posso ter galerias separadas?', 'Com certeza. Crie várias páginas ou seções de galeria — por exemplo casamentos, retratos, comercial — e organize como quiser.'],
        ['Como os clientes entram em contato?', 'Todo site inclui um formulário de contato; as mensagens chegam ao seu painel e à sua caixa de entrada para você não perder nenhuma consulta.'],
      ],
    },
  },

  fitness: {
    industry: 'fitness',
    label: { en: 'Gyms & Fitness', es: 'Gimnasios y fitness', pt: 'Academias e fitness' },
    keyword: { en: 'gym website builder', es: 'creador de webs para gimnasios', pt: 'criador de sites para academias' },
    h1: {
      en: 'The free AI website builder for gyms & fitness',
      es: 'El creador de webs con IA gratis para gimnasios y fitness',
      pt: 'O criador de sites com IA grátis para academias e fitness',
    },
    sub: {
      en: 'Fill your classes and sign up new members. AI builds a high-energy site with your schedule, programs and membership calls-to-action — ready in minutes.',
      es: 'Llena tus clases y consigue nuevos socios. La IA crea un sitio lleno de energía con tu horario, programas y llamadas a la acción de membresía — listo en minutos.',
      pt: 'Lote suas aulas e conquiste novos alunos. A IA cria um site cheio de energia com sua grade de horários, programas e chamadas para matrícula — pronto em minutos.',
    },
    intro: {
      en: 'People decide where to train in seconds. Caddisfly builds a bold, fast fitness site that shows your classes, trainers and results — with clear buttons to book a session or start a membership.',
      es: 'La gente decide dónde entrenar en segundos. Caddisfly crea un sitio fitness audaz y rápido que muestra tus clases, entrenadores y resultados — con botones claros para reservar una sesión o iniciar una membresía.',
      pt: 'As pessoas decidem onde treinar em segundos. O Caddisfly cria um site fitness ousado e rápido que mostra suas aulas, treinadores e resultados — com botões claros para agendar uma sessão ou começar uma matrícula.',
    },
    benefits: {
      en: [
        ['Class & program showcase', 'Lay out your classes, programs and training styles so prospects know exactly what you offer.'],
        ['Membership calls-to-action', 'Prominent "Join now" and "Free trial" buttons that turn visitors into members.'],
        ['Trainer profiles & results', 'Introduce your coaches and show transformations and testimonials that build trust.'],
        ['Bookings built in', 'Let people request a session or class slot right from your site, with no extra software.'],
      ],
      es: [
        ['Vitrina de clases y programas', 'Presenta tus clases, programas y estilos de entrenamiento para que los interesados sepan exactamente qué ofreces.'],
        ['Llamadas a la acción de membresía', 'Botones destacados de "Únete ahora" y "Prueba gratis" que convierten visitantes en socios.'],
        ['Perfiles de entrenadores y resultados', 'Presenta a tus coaches y muestra transformaciones y testimonios que generan confianza.'],
        ['Reservas integradas', 'Permite que reserven una sesión o clase directamente desde tu sitio, sin software extra.'],
      ],
      pt: [
        ['Vitrine de aulas e programas', 'Apresente suas aulas, programas e estilos de treino para que os interessados saibam exatamente o que você oferece.'],
        ['Chamadas para matrícula', 'Botões em destaque de "Matricule-se" e "Aula grátis" que transformam visitantes em alunos.'],
        ['Perfis de treinadores e resultados', 'Apresente seus treinadores e mostre transformações e depoimentos que geram confiança.'],
        ['Agendamento integrado', 'Deixe as pessoas agendarem uma sessão ou aula direto do seu site, sem software extra.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a gym website for free?', 'Yes. Generate and customize your fitness site for free, publish on a free subdomain, and upgrade for a custom domain.'],
        ['Can members book classes?', 'Yes — add booking buttons so people can request a class slot or training session directly from your site.'],
        ['Can I show my class schedule?', 'Absolutely. The AI builds schedule and program sections you can edit by chatting in plain English.'],
        ['Can I feature trainers and testimonials?', 'Yes. Add trainer profiles, member transformations and reviews to build credibility and convert visitors.'],
      ],
      es: [
        ['¿Puedo crear una web de gimnasio gratis?', 'Sí. Genera y personaliza tu sitio fitness gratis, publícalo en un subdominio gratuito y mejora a un dominio propio.'],
        ['¿Los socios pueden reservar clases?', 'Sí — añade botones de reserva para que pidan un lugar en una clase o sesión directamente desde tu sitio.'],
        ['¿Puedo mostrar mi horario de clases?', 'Por supuesto. La IA crea secciones de horario y programas que puedes editar conversando en lenguaje natural.'],
        ['¿Puedo destacar entrenadores y testimonios?', 'Sí. Añade perfiles de entrenadores, transformaciones de socios y reseñas para dar credibilidad y convertir visitantes.'],
      ],
      pt: [
        ['Posso criar um site de academia grátis?', 'Sim. Gere e personalize seu site fitness de graça, publique em um subdomínio gratuito e faça upgrade para um domínio próprio.'],
        ['Os alunos podem agendar aulas?', 'Sim — adicione botões de agendamento para pedirem uma vaga em aula ou sessão direto do seu site.'],
        ['Posso mostrar minha grade de aulas?', 'Com certeza. A IA cria seções de grade e programas que você edita conversando em linguagem simples.'],
        ['Posso destacar treinadores e depoimentos?', 'Sim. Adicione perfis de treinadores, transformações de alunos e avaliações para gerar credibilidade e converter visitantes.'],
      ],
    },
  },

  salons: {
    industry: 'beauty',
    label: { en: 'Hair & Beauty Salons', es: 'Salones de belleza', pt: 'Salões de beleza' },
    keyword: { en: 'salon website builder', es: 'creador de webs para salones de belleza', pt: 'criador de sites para salões de beleza' },
    h1: {
      en: 'The free AI website builder for salons',
      es: 'El creador de webs con IA gratis para salones de belleza',
      pt: 'O criador de sites com IA grátis para salões de beleza',
    },
    sub: {
      en: 'Get booked solid. AI builds an elegant salon website with your services, prices, gallery and online booking — ready to publish in minutes.',
      es: 'Llena tu agenda. La IA crea una web de salón elegante con tus servicios, precios, galería y reservas online — lista para publicar en minutos.',
      pt: 'Lote sua agenda. A IA cria um site de salão elegante com seus serviços, preços, galeria e agendamento online — pronto para publicar em minutos.',
    },
    intro: {
      en: 'Clients want to see your work and book in a tap. Caddisfly builds a refined, mobile-first salon site with a service menu, a gallery of your best looks and a clear booking button — generated from a short description.',
      es: 'Los clientes quieren ver tu trabajo y reservar con un toque. Caddisfly crea un sitio de salón refinado y mobile-first con un menú de servicios, una galería de tus mejores looks y un botón de reserva claro — generado a partir de una breve descripción.',
      pt: 'Os clientes querem ver seu trabalho e agendar com um toque. O Caddisfly cria um site de salão refinado e mobile-first com um menu de serviços, uma galeria dos seus melhores looks e um botão de agendamento claro — gerado a partir de uma breve descrição.',
    },
    benefits: {
      en: [
        ['Service menu with prices', 'List cuts, color, styling and treatments with clear pricing so clients know what to expect.'],
        ['Online booking', 'A prominent booking button or link sends clients straight to your scheduler.'],
        ['Gallery of your work', 'Show before-and-afters and signature styles in a gallery that sells your skill.'],
        ['Reviews that build trust', 'Feature client testimonials to win over first-time bookers.'],
      ],
      es: [
        ['Menú de servicios con precios', 'Lista cortes, color, peinado y tratamientos con precios claros para que los clientes sepan qué esperar.'],
        ['Reservas online', 'Un botón o enlace de reserva destacado lleva a los clientes directo a tu agenda.'],
        ['Galería de tu trabajo', 'Muestra antes y después y tus estilos insignia en una galería que vende tu talento.'],
        ['Reseñas que generan confianza', 'Destaca testimonios de clientes para convencer a quienes reservan por primera vez.'],
      ],
      pt: [
        ['Menu de serviços com preços', 'Liste cortes, coloração, finalização e tratamentos com preços claros para os clientes saberem o que esperar.'],
        ['Agendamento online', 'Um botão ou link de agendamento em destaque leva os clientes direto à sua agenda.'],
        ['Galeria do seu trabalho', 'Mostre antes e depois e seus estilos marcantes em uma galeria que vende seu talento.'],
        ['Avaliações que geram confiança', 'Destaque depoimentos de clientes para conquistar quem agenda pela primeira vez.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a salon website for free?', 'Yes. Create and customize your salon site for free and publish on a free subdomain, with custom domains on paid plans.'],
        ['Can clients book online?', 'Yes — add a booking button that links to your scheduling tool, or use Caddisfly bookings on supported plans.'],
        ['Can I list my services and prices?', 'Absolutely. The AI builds a service menu with prices that you can edit anytime in plain English.'],
        ['Can I show a gallery of my work?', 'Yes. Add a gallery of your styles and before-and-afters to showcase your craft and attract new clients.'],
      ],
      es: [
        ['¿Puedo crear una web de salón gratis?', 'Sí. Crea y personaliza tu sitio de salón gratis y publícalo en un subdominio gratuito, con dominios propios en planes de pago.'],
        ['¿Los clientes pueden reservar online?', 'Sí — añade un botón de reserva que enlace a tu herramienta de agenda, o usa las reservas de Caddisfly en planes compatibles.'],
        ['¿Puedo listar mis servicios y precios?', 'Por supuesto. La IA crea un menú de servicios con precios que puedes editar cuando quieras en lenguaje natural.'],
        ['¿Puedo mostrar una galería de mi trabajo?', 'Sí. Añade una galería de tus estilos y antes/después para lucir tu talento y atraer nuevos clientes.'],
      ],
      pt: [
        ['Posso criar um site de salão grátis?', 'Sim. Crie e personalize seu site de salão de graça e publique em um subdomínio gratuito, com domínios próprios em planos pagos.'],
        ['Os clientes podem agendar online?', 'Sim — adicione um botão de agendamento que leva à sua ferramenta de agenda, ou use o agendamento do Caddisfly em planos compatíveis.'],
        ['Posso listar meus serviços e preços?', 'Com certeza. A IA cria um menu de serviços com preços que você edita quando quiser em linguagem simples.'],
        ['Posso mostrar uma galeria do meu trabalho?', 'Sim. Adicione uma galeria dos seus estilos e antes/depois para exibir seu talento e atrair novos clientes.'],
      ],
    },
  },

  barbershops: {
    industry: 'barbershop',
    label: { en: 'Barbershops', es: 'Barberías', pt: 'Barbearias' },
    keyword: { en: 'barbershop website builder', es: 'creador de webs para barberías', pt: 'criador de sites para barbearias' },
    h1: {
      en: 'The free AI website builder for barbershops',
      es: 'El creador de webs con IA gratis para barberías',
      pt: 'O criador de sites com IA grátis para barbearias',
    },
    sub: {
      en: 'Look as sharp online as your cuts. AI builds a bold barbershop website with your services, gallery, hours and booking — ready in minutes.',
      es: 'Luce tan afilado online como tus cortes. La IA crea una web de barbería con estilo, con tus servicios, galería, horarios y reservas — lista en minutos.',
      pt: 'Fique tão afiado online quanto seus cortes. A IA cria um site de barbearia com estilo, com seus serviços, galeria, horários e agendamento — pronto em minutos.',
    },
    intro: {
      en: 'A great barbershop earns walk-ins and regulars. Caddisfly builds a bold, dark-styled site that shows your cuts, prices and location — with a booking button so clients can reserve their chair.',
      es: 'Una buena barbería gana clientes de paso y habituales. Caddisfly crea un sitio audaz de estilo oscuro que muestra tus cortes, precios y ubicación — con un botón de reserva para que aparten su silla.',
      pt: 'Uma boa barbearia conquista quem passa e os fiéis. O Caddisfly cria um site ousado de estilo escuro que mostra seus cortes, preços e localização — com um botão de agendamento para os clientes reservarem a cadeira.',
    },
    benefits: {
      en: [
        ['Bold, masculine design', 'Dark, high-contrast layouts that match the energy of your shop.'],
        ['Cuts & pricing', 'List your services and prices so clients know the deal before they sit down.'],
        ['Booking & walk-in info', 'A booking link plus clear hours and location for walk-in traffic.'],
        ['Gallery of your work', 'Show off your best fades and styles to bring in new clients.'],
      ],
      es: [
        ['Diseño audaz y con carácter', 'Diseños oscuros y de alto contraste que combinan con la energía de tu barbería.'],
        ['Cortes y precios', 'Lista tus servicios y precios para que los clientes sepan el trato antes de sentarse.'],
        ['Reservas e info de paso', 'Un enlace de reserva más horarios y ubicación claros para el tráfico de paso.'],
        ['Galería de tu trabajo', 'Luce tus mejores fades y estilos para atraer nuevos clientes.'],
      ],
      pt: [
        ['Design ousado e marcante', 'Layouts escuros e de alto contraste que combinam com a energia da sua barbearia.'],
        ['Cortes e preços', 'Liste seus serviços e preços para os clientes saberem o combinado antes de sentar.'],
        ['Agendamento e info para quem passa', 'Um link de agendamento mais horários e localização claros para o movimento de rua.'],
        ['Galeria do seu trabalho', 'Mostre seus melhores fades e estilos para atrair novos clientes.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a barbershop website for free?', 'Yes. Build and customize your barbershop site for free and publish on a free subdomain; add a custom domain on a paid plan.'],
        ['Can clients book a chair online?', 'Yes — add a booking button linking to your scheduler so clients can reserve a slot.'],
        ['Can I show prices and services?', 'Absolutely. List cuts, beard trims and styling with prices, editable anytime in plain English.'],
        ['Will it look good on phones?', 'Yes. Your site is mobile-first and loads fast, so clients can find and book you on the go.'],
      ],
      es: [
        ['¿Puedo crear una web de barbería gratis?', 'Sí. Crea y personaliza tu sitio de barbería gratis y publícalo en un subdominio gratuito; añade un dominio propio con un plan de pago.'],
        ['¿Los clientes pueden reservar silla online?', 'Sí — añade un botón de reserva que enlace a tu agenda para que aparten su turno.'],
        ['¿Puedo mostrar precios y servicios?', 'Por supuesto. Lista cortes, arreglo de barba y peinado con precios, editables cuando quieras en lenguaje natural.'],
        ['¿Se verá bien en el móvil?', 'Sí. Tu sitio es mobile-first y carga rápido, para que te encuentren y reserven sobre la marcha.'],
      ],
      pt: [
        ['Posso criar um site de barbearia grátis?', 'Sim. Crie e personalize seu site de barbearia de graça e publique em um subdomínio gratuito; adicione um domínio próprio em um plano pago.'],
        ['Os clientes podem agendar a cadeira online?', 'Sim — adicione um botão de agendamento que leva à sua agenda para reservarem o horário.'],
        ['Posso mostrar preços e serviços?', 'Com certeza. Liste cortes, barba e finalização com preços, editáveis quando quiser em linguagem simples.'],
        ['Vai ficar bom no celular?', 'Sim. Seu site é mobile-first e carrega rápido, para te encontrarem e agendarem na hora.'],
      ],
    },
  },

  dentists: {
    industry: 'dental',
    label: { en: 'Dentists & Clinics', es: 'Dentistas y clínicas', pt: 'Dentistas e clínicas' },
    keyword: { en: 'dentist website builder', es: 'creador de webs para dentistas', pt: 'criador de sites para dentistas' },
    h1: {
      en: 'The free AI website builder for dentists',
      es: 'El creador de webs con IA gratis para dentistas',
      pt: 'O criador de sites com IA grátis para dentistas',
    },
    sub: {
      en: 'Win new patients with a clean, trustworthy website. AI builds your services, team and appointment requests — professional and ready in minutes.',
      es: 'Gana nuevos pacientes con una web limpia y confiable. La IA crea tus servicios, equipo y solicitudes de cita — profesional y lista en minutos.',
      pt: 'Conquiste novos pacientes com um site limpo e confiável. A IA cria seus serviços, equipe e solicitações de consulta — profissional e pronto em minutos.',
    },
    intro: {
      en: 'Patients judge a practice by its website. Caddisfly builds a calm, professional dental site that lists your services, introduces your team and makes booking an appointment effortless — no agency required.',
      es: 'Los pacientes juzgan una clínica por su web. Caddisfly crea un sitio dental sereno y profesional que lista tus servicios, presenta a tu equipo y hace que pedir cita sea muy fácil — sin necesidad de una agencia.',
      pt: 'Os pacientes avaliam uma clínica pelo site. O Caddisfly cria um site odontológico tranquilo e profissional que lista seus serviços, apresenta sua equipe e torna o agendamento muito fácil — sem precisar de agência.',
    },
    benefits: {
      en: [
        ['Clear services & treatments', 'List cleanings, implants, orthodontics and more so patients understand what you offer.'],
        ['Appointment requests', 'A prominent "Request an appointment" form or button that fills your calendar.'],
        ['Trust & credibility', 'Introduce your dentists, show credentials and patient reviews to reassure new patients.'],
        ['Professional, accessible design', 'A clean, calm look that reads well on every device and inspires confidence.'],
      ],
      es: [
        ['Servicios y tratamientos claros', 'Lista limpiezas, implantes, ortodoncia y más para que los pacientes entiendan qué ofreces.'],
        ['Solicitudes de cita', 'Un formulario o botón destacado de "Solicitar cita" que llena tu agenda.'],
        ['Confianza y credibilidad', 'Presenta a tus dentistas, muestra credenciales y reseñas de pacientes para dar tranquilidad.'],
        ['Diseño profesional y accesible', 'Un aspecto limpio y sereno que se ve bien en cualquier dispositivo e inspira confianza.'],
      ],
      pt: [
        ['Serviços e tratamentos claros', 'Liste limpezas, implantes, ortodontia e mais para os pacientes entenderem o que você oferece.'],
        ['Solicitação de consultas', 'Um formulário ou botão em destaque de "Agendar consulta" que lota sua agenda.'],
        ['Confiança e credibilidade', 'Apresente seus dentistas, mostre credenciais e avaliações de pacientes para dar segurança.'],
        ['Design profissional e acessível', 'Um visual limpo e tranquilo que fica bom em qualquer dispositivo e inspira confiança.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a dental website for free?', 'Yes. Generate and customize your clinic site for free, publish on a free subdomain, and add a custom domain on a paid plan.'],
        ['Can patients request appointments?', 'Yes — add an appointment request form or button that delivers enquiries straight to your inbox.'],
        ['Can I list services and insurance info?', 'Absolutely. The AI builds service sections you can edit in plain English, including treatments and accepted plans.'],
        ['Is the site mobile-friendly and fast?', 'Yes. Every site is mobile-first, fast-loading and built with SEO basics so patients can find you.'],
      ],
      es: [
        ['¿Puedo crear una web dental gratis?', 'Sí. Genera y personaliza el sitio de tu clínica gratis, publícalo en un subdominio gratuito y añade un dominio propio con un plan de pago.'],
        ['¿Los pacientes pueden pedir cita?', 'Sí — añade un formulario o botón de solicitud de cita que envía las consultas directo a tu bandeja.'],
        ['¿Puedo listar servicios e información de seguros?', 'Por supuesto. La IA crea secciones de servicios que editas en lenguaje natural, incluyendo tratamientos y planes aceptados.'],
        ['¿El sitio es rápido y apto para móvil?', 'Sí. Cada sitio es mobile-first, de carga rápida y con SEO básico para que los pacientes te encuentren.'],
      ],
      pt: [
        ['Posso criar um site odontológico grátis?', 'Sim. Gere e personalize o site da sua clínica de graça, publique em um subdomínio gratuito e adicione um domínio próprio em um plano pago.'],
        ['Os pacientes podem solicitar consultas?', 'Sim — adicione um formulário ou botão de solicitação de consulta que entrega as mensagens direto na sua caixa de entrada.'],
        ['Posso listar serviços e convênios?', 'Com certeza. A IA cria seções de serviços que você edita em linguagem simples, incluindo tratamentos e convênios aceitos.'],
        ['O site é rápido e adaptado ao celular?', 'Sim. Todo site é mobile-first, de carregamento rápido e com SEO básico para os pacientes te encontrarem.'],
      ],
    },
  },

  'real-estate': {
    industry: 'realestate',
    label: { en: 'Real Estate Agents', es: 'Agentes inmobiliarios', pt: 'Corretores de imóveis' },
    keyword: { en: 'real estate website builder', es: 'creador de webs inmobiliarias', pt: 'criador de sites imobiliários' },
    h1: {
      en: 'The free AI website builder for real estate',
      es: 'El creador de webs con IA gratis para inmobiliarias',
      pt: 'O criador de sites com IA grátis para imobiliárias',
    },
    sub: {
      en: 'Showcase listings and capture leads. AI builds a polished real estate website with featured properties, your bio and a contact form — ready in minutes.',
      es: 'Muestra propiedades y capta clientes. La IA crea una web inmobiliaria pulida con propiedades destacadas, tu perfil y un formulario de contacto — lista en minutos.',
      pt: 'Mostre imóveis e capte clientes. A IA cria um site imobiliário impecável com imóveis em destaque, seu perfil e um formulário de contato — pronto em minutos.',
    },
    intro: {
      en: 'Buyers and sellers want a credible agent they can reach fast. Caddisfly builds a sharp real estate site with featured listings, your story and a lead-capture form — so you look established from day one.',
      es: 'Compradores y vendedores quieren un agente creíble y fácil de contactar. Caddisfly crea un sitio inmobiliario nítido con propiedades destacadas, tu historia y un formulario de captación — para que te veas consolidado desde el primer día.',
      pt: 'Compradores e vendedores querem um corretor confiável e fácil de contatar. O Caddisfly cria um site imobiliário nítido com imóveis em destaque, sua história e um formulário de captação — para você parecer estabelecido desde o primeiro dia.',
    },
    benefits: {
      en: [
        ['Featured property listings', 'Highlight your best listings with photos, details and a clear enquiry path.'],
        ['Lead-capture forms', 'Turn visitors into buyers and sellers with contact forms that land in your inbox.'],
        ['Agent bio that builds trust', 'Tell your story and show results so clients choose you over the competition.'],
        ['Fast & SEO-ready', 'A fast, search-friendly site that helps local buyers find you online.'],
      ],
      es: [
        ['Propiedades destacadas', 'Resalta tus mejores propiedades con fotos, detalles y un camino claro de consulta.'],
        ['Formularios de captación', 'Convierte visitantes en compradores y vendedores con formularios que llegan a tu bandeja.'],
        ['Perfil que genera confianza', 'Cuenta tu historia y muestra resultados para que te elijan a ti.'],
        ['Rápido y listo para SEO', 'Un sitio rápido y amigable con buscadores que ayuda a que los compradores locales te encuentren.'],
      ],
      pt: [
        ['Imóveis em destaque', 'Destaque seus melhores imóveis com fotos, detalhes e um caminho claro de contato.'],
        ['Formulários de captação', 'Transforme visitantes em compradores e vendedores com formulários que chegam na sua caixa de entrada.'],
        ['Perfil que gera confiança', 'Conte sua história e mostre resultados para os clientes escolherem você.'],
        ['Rápido e pronto para SEO', 'Um site rápido e amigável aos buscadores que ajuda compradores locais a te encontrarem.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a real estate website for free?', 'Yes. Build and customize your agent site for free and publish on a free subdomain, with custom domains on paid plans.'],
        ['Can I feature property listings?', 'Yes. The AI builds featured-listing sections with photos and details that you can edit anytime.'],
        ['Can I capture leads?', 'Absolutely. Every site includes contact and enquiry forms so leads arrive in your dashboard and inbox.'],
        ['Will it help me rank locally?', 'Sites ship with SEO basics — clean titles, meta tags and structured data — to help local buyers find you.'],
      ],
      es: [
        ['¿Puedo crear una web inmobiliaria gratis?', 'Sí. Crea y personaliza tu sitio de agente gratis y publícalo en un subdominio gratuito, con dominios propios en planes de pago.'],
        ['¿Puedo destacar propiedades?', 'Sí. La IA crea secciones de propiedades destacadas con fotos y detalles que puedes editar cuando quieras.'],
        ['¿Puedo captar clientes?', 'Por supuesto. Cada sitio incluye formularios de contacto y consulta para que los clientes lleguen a tu panel y bandeja.'],
        ['¿Me ayudará a posicionar localmente?', 'Los sitios incluyen SEO básico — títulos limpios, metaetiquetas y datos estructurados — para que los compradores locales te encuentren.'],
      ],
      pt: [
        ['Posso criar um site imobiliário grátis?', 'Sim. Crie e personalize seu site de corretor de graça e publique em um subdomínio gratuito, com domínios próprios em planos pagos.'],
        ['Posso destacar imóveis?', 'Sim. A IA cria seções de imóveis em destaque com fotos e detalhes que você edita quando quiser.'],
        ['Posso captar clientes?', 'Com certeza. Todo site inclui formulários de contato e consulta para os clientes chegarem ao seu painel e caixa de entrada.'],
        ['Vai me ajudar a ranquear localmente?', 'Os sites já vêm com SEO básico — títulos limpos, meta tags e dados estruturados — para compradores locais te encontrarem.'],
      ],
    },
  },

  'law-firms': {
    industry: 'legal',
    label: { en: 'Law Firms', es: 'Bufetes de abogados', pt: 'Escritórios de advocacia' },
    keyword: { en: 'law firm website builder', es: 'creador de webs para abogados', pt: 'criador de sites para advogados' },
    h1: {
      en: 'The free AI website builder for law firms',
      es: 'El creador de webs con IA gratis para abogados',
      pt: 'O criador de sites com IA grátis para advogados',
    },
    sub: {
      en: 'Project authority and win clients. AI builds a professional law firm website with your practice areas, attorney profiles and consultation requests — ready in minutes.',
      es: 'Proyecta autoridad y gana clientes. La IA crea una web profesional para tu bufete con tus áreas de práctica, perfiles de abogados y solicitudes de consulta — lista en minutos.',
      pt: 'Transmita autoridade e conquiste clientes. A IA cria um site profissional para seu escritório com áreas de atuação, perfis de advogados e solicitações de consulta — pronto em minutos.',
    },
    intro: {
      en: 'Clients hire lawyers they trust. Caddisfly builds an authoritative, professional firm website that lays out your practice areas, introduces your attorneys and invites consultations — credible from the first visit.',
      es: 'Los clientes contratan a abogados en los que confían. Caddisfly crea una web de bufete profesional y con autoridad que presenta tus áreas de práctica, a tus abogados e invita a consultas — creíble desde la primera visita.',
      pt: 'Os clientes contratam advogados em quem confiam. O Caddisfly cria um site de escritório profissional e com autoridade que apresenta suas áreas de atuação, seus advogados e convida a consultas — confiável desde a primeira visita.',
    },
    benefits: {
      en: [
        ['Practice areas, clearly laid out', 'Present your areas of law so prospective clients quickly find the help they need.'],
        ['Attorney profiles', 'Introduce your team with bios and credentials that build authority and trust.'],
        ['Consultation requests', 'A clear "Request a consultation" form or button that turns visitors into clients.'],
        ['Professional, credible design', 'A clean, serious look that reflects the standards of your firm.'],
      ],
      es: [
        ['Áreas de práctica, bien presentadas', 'Presenta tus áreas de derecho para que los clientes encuentren rápido la ayuda que necesitan.'],
        ['Perfiles de abogados', 'Presenta a tu equipo con biografías y credenciales que dan autoridad y confianza.'],
        ['Solicitudes de consulta', 'Un formulario o botón claro de "Solicitar consulta" que convierte visitantes en clientes.'],
        ['Diseño profesional y creíble', 'Un aspecto limpio y serio que refleja los estándares de tu bufete.'],
      ],
      pt: [
        ['Áreas de atuação bem apresentadas', 'Apresente suas áreas do direito para os clientes encontrarem rápido a ajuda que precisam.'],
        ['Perfis de advogados', 'Apresente sua equipe com biografias e credenciais que geram autoridade e confiança.'],
        ['Solicitações de consulta', 'Um formulário ou botão claro de "Solicitar consulta" que transforma visitantes em clientes.'],
        ['Design profissional e confiável', 'Um visual limpo e sério que reflete os padrões do seu escritório.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a law firm website for free?', 'Yes. Create and customize your firm site for free and publish on a free subdomain; add a custom domain on a paid plan.'],
        ['Can clients request consultations?', 'Yes — add a consultation request form or button so enquiries arrive directly in your inbox.'],
        ['Can I list practice areas and attorneys?', 'Absolutely. The AI builds practice-area and attorney-profile sections you can edit in plain English.'],
        ['Does it look professional?', 'Yes. Choose from refined, professional templates designed to convey authority and trust.'],
      ],
      es: [
        ['¿Puedo crear una web de bufete gratis?', 'Sí. Crea y personaliza el sitio de tu bufete gratis y publícalo en un subdominio gratuito; añade un dominio propio con un plan de pago.'],
        ['¿Los clientes pueden pedir consultas?', 'Sí — añade un formulario o botón de solicitud de consulta para que las consultas lleguen directo a tu bandeja.'],
        ['¿Puedo listar áreas de práctica y abogados?', 'Por supuesto. La IA crea secciones de áreas de práctica y perfiles de abogados que editas en lenguaje natural.'],
        ['¿Se ve profesional?', 'Sí. Elige entre plantillas refinadas y profesionales diseñadas para transmitir autoridad y confianza.'],
      ],
      pt: [
        ['Posso criar um site de advocacia grátis?', 'Sim. Crie e personalize o site do seu escritório de graça e publique em um subdomínio gratuito; adicione um domínio próprio em um plano pago.'],
        ['Os clientes podem solicitar consultas?', 'Sim — adicione um formulário ou botão de solicitação de consulta para as mensagens chegarem direto na sua caixa de entrada.'],
        ['Posso listar áreas de atuação e advogados?', 'Com certeza. A IA cria seções de áreas de atuação e perfis de advogados que você edita em linguagem simples.'],
        ['Fica com aparência profissional?', 'Sim. Escolha entre modelos refinados e profissionais feitos para transmitir autoridade e confiança.'],
      ],
    },
  },

  contractors: {
    industry: 'construction',
    label: { en: 'Contractors & Trades', es: 'Contratistas y oficios', pt: 'Empreiteiros e serviços' },
    keyword: { en: 'contractor website builder', es: 'creador de webs para contratistas', pt: 'criador de sites para empreiteiros' },
    h1: {
      en: 'The free AI website builder for contractors',
      es: 'El creador de webs con IA gratis para contratistas',
      pt: 'O criador de sites com IA grátis para empreiteiros',
    },
    sub: {
      en: 'Win more jobs. AI builds a rugged, trustworthy website with your services, project gallery and quote requests — ready to publish in minutes.',
      es: 'Consigue más trabajos. La IA crea una web sólida y confiable con tus servicios, galería de proyectos y solicitudes de presupuesto — lista para publicar en minutos.',
      pt: 'Feche mais obras. A IA cria um site robusto e confiável com seus serviços, galeria de projetos e pedidos de orçamento — pronto para publicar em minutos.',
    },
    intro: {
      en: 'Homeowners hire contractors who look reliable and show their work. Caddisfly builds a solid, trustworthy site with your services, a gallery of finished projects and an easy quote-request form — so you book more jobs.',
      es: 'Los propietarios contratan a contratistas que parecen fiables y muestran su trabajo. Caddisfly crea un sitio sólido y confiable con tus servicios, una galería de proyectos terminados y un formulario fácil de presupuesto — para que consigas más trabajos.',
      pt: 'Os clientes contratam empreiteiros que parecem confiáveis e mostram seu trabalho. O Caddisfly cria um site sólido e confiável com seus serviços, uma galeria de projetos concluídos e um formulário fácil de orçamento — para você fechar mais obras.',
    },
    benefits: {
      en: [
        ['Project gallery', 'Show finished work and before-and-afters that prove your quality.'],
        ['Quote requests', 'A clear "Get a free quote" form that turns visitors into jobs.'],
        ['Services & areas served', 'List what you do and where you work so the right customers reach out.'],
        ['Reviews & trust signals', 'Feature customer reviews and credentials to win confidence fast.'],
      ],
      es: [
        ['Galería de proyectos', 'Muestra trabajos terminados y antes/después que demuestran tu calidad.'],
        ['Solicitudes de presupuesto', 'Un formulario claro de "Pide presupuesto gratis" que convierte visitantes en trabajos.'],
        ['Servicios y zonas de trabajo', 'Lista lo que haces y dónde trabajas para que te contacten los clientes adecuados.'],
        ['Reseñas y señales de confianza', 'Destaca reseñas de clientes y credenciales para ganar confianza rápido.'],
      ],
      pt: [
        ['Galeria de projetos', 'Mostre trabalhos concluídos e antes/depois que comprovam sua qualidade.'],
        ['Pedidos de orçamento', 'Um formulário claro de "Peça um orçamento grátis" que transforma visitantes em obras.'],
        ['Serviços e regiões atendidas', 'Liste o que você faz e onde atua para os clientes certos entrarem em contato.'],
        ['Avaliações e sinais de confiança', 'Destaque avaliações de clientes e credenciais para ganhar confiança rápido.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a contractor website for free?', 'Yes. Build and customize your trade site for free and publish on a free subdomain, with custom domains on paid plans.'],
        ['Can customers request a quote?', 'Yes — add a quote-request form so enquiries land directly in your inbox.'],
        ['Can I show a project gallery?', 'Absolutely. Add galleries of finished projects and before-and-afters to prove your work.'],
        ['Can I list my service areas?', 'Yes. List your services and the areas you cover, editable anytime in plain English.'],
      ],
      es: [
        ['¿Puedo crear una web de contratista gratis?', 'Sí. Crea y personaliza tu sitio de oficio gratis y publícalo en un subdominio gratuito, con dominios propios en planes de pago.'],
        ['¿Los clientes pueden pedir presupuesto?', 'Sí — añade un formulario de presupuesto para que las consultas lleguen directo a tu bandeja.'],
        ['¿Puedo mostrar una galería de proyectos?', 'Por supuesto. Añade galerías de proyectos terminados y antes/después para demostrar tu trabajo.'],
        ['¿Puedo indicar mis zonas de servicio?', 'Sí. Lista tus servicios y las zonas que cubres, editable cuando quieras en lenguaje natural.'],
      ],
      pt: [
        ['Posso criar um site de empreiteiro grátis?', 'Sim. Crie e personalize seu site de serviços de graça e publique em um subdomínio gratuito, com domínios próprios em planos pagos.'],
        ['Os clientes podem pedir orçamento?', 'Sim — adicione um formulário de orçamento para as mensagens chegarem direto na sua caixa de entrada.'],
        ['Posso mostrar uma galeria de projetos?', 'Com certeza. Adicione galerias de projetos concluídos e antes/depois para comprovar seu trabalho.'],
        ['Posso indicar minhas regiões de atendimento?', 'Sim. Liste seus serviços e as regiões que atende, editável quando quiser em linguagem simples.'],
      ],
    },
  },

  coaches: {
    industry: 'coaching',
    label: { en: 'Coaches & Consultants', es: 'Coaches y consultores', pt: 'Coaches e consultores' },
    keyword: { en: 'coaching website builder', es: 'creador de webs para coaches', pt: 'criador de sites para coaches' },
    h1: {
      en: 'The free AI website builder for coaches',
      es: 'El creador de webs con IA gratis para coaches',
      pt: 'O criador de sites com IA grátis para coaches',
    },
    sub: {
      en: 'Grow your coaching practice. AI builds a personal, persuasive website with your programs, story and a way to book a call — ready in minutes.',
      es: 'Haz crecer tu práctica de coaching. La IA crea una web personal y persuasiva con tus programas, tu historia y una forma de reservar una llamada — lista en minutos.',
      pt: 'Faça seu coaching crescer. A IA cria um site pessoal e persuasivo com seus programas, sua história e uma forma de agendar uma conversa — pronto em minutos.',
    },
    intro: {
      en: 'Clients buy coaching from people they connect with. Caddisfly builds a warm, persuasive site that tells your story, presents your programs and makes it easy to book a discovery call — no tech headaches.',
      es: 'Los clientes contratan coaching de personas con quienes conectan. Caddisfly crea un sitio cálido y persuasivo que cuenta tu historia, presenta tus programas y facilita reservar una llamada de descubrimiento — sin dolores de cabeza técnicos.',
      pt: 'Os clientes contratam coaching de pessoas com quem se conectam. O Caddisfly cria um site acolhedor e persuasivo que conta sua história, apresenta seus programas e facilita agendar uma conversa inicial — sem dor de cabeça técnica.',
    },
    benefits: {
      en: [
        ['Programs & offers', 'Lay out your packages and programs so clients understand exactly how you help.'],
        ['Book a discovery call', 'A clear booking button or form that turns interest into conversations.'],
        ['Your story, front and center', 'A personal about section that builds the connection coaching depends on.'],
        ['Testimonials that convert', 'Feature client results and reviews to overcome hesitation.'],
      ],
      es: [
        ['Programas y ofertas', 'Presenta tus paquetes y programas para que los clientes entiendan cómo ayudas.'],
        ['Reserva una llamada', 'Un botón o formulario de reserva claro que convierte el interés en conversaciones.'],
        ['Tu historia en primer plano', 'Una sección personal sobre ti que crea la conexión de la que depende el coaching.'],
        ['Testimonios que convierten', 'Destaca resultados y reseñas de clientes para vencer dudas.'],
      ],
      pt: [
        ['Programas e ofertas', 'Apresente seus pacotes e programas para os clientes entenderem como você ajuda.'],
        ['Agende uma conversa', 'Um botão ou formulário de agendamento claro que transforma interesse em conversas.'],
        ['Sua história em destaque', 'Uma seção pessoal sobre você que cria a conexão de que o coaching depende.'],
        ['Depoimentos que convertem', 'Destaque resultados e avaliações de clientes para vencer hesitações.'],
      ],
    },
    faqs: {
      en: [
        ['Can I build a coaching website for free?', 'Yes. Build and customize your coaching site for free and publish on a free subdomain; add a custom domain on a paid plan.'],
        ['Can clients book a call?', 'Yes — add a booking button or form so prospects can request a discovery call directly.'],
        ['Can I sell or list programs?', 'Absolutely. Present your packages and offers, editable in plain English, with clear calls-to-action.'],
        ['Do I need any tech skills?', 'None. Describe your practice, the AI builds the site, and you refine it by chatting or with a visual editor.'],
      ],
      es: [
        ['¿Puedo crear una web de coaching gratis?', 'Sí. Crea y personaliza tu sitio de coaching gratis y publícalo en un subdominio gratuito; añade un dominio propio con un plan de pago.'],
        ['¿Los clientes pueden reservar una llamada?', 'Sí — añade un botón o formulario de reserva para que pidan una llamada de descubrimiento directamente.'],
        ['¿Puedo vender o listar programas?', 'Por supuesto. Presenta tus paquetes y ofertas, editables en lenguaje natural, con llamadas a la acción claras.'],
        ['¿Necesito conocimientos técnicos?', 'Ninguno. Describe tu práctica, la IA crea el sitio y tú lo ajustas conversando o con un editor visual.'],
      ],
      pt: [
        ['Posso criar um site de coaching grátis?', 'Sim. Crie e personalize seu site de coaching de graça e publique em um subdomínio gratuito; adicione um domínio próprio em um plano pago.'],
        ['Os clientes podem agendar uma conversa?', 'Sim — adicione um botão ou formulário de agendamento para pedirem uma conversa inicial diretamente.'],
        ['Posso vender ou listar programas?', 'Com certeza. Apresente seus pacotes e ofertas, editáveis em linguagem simples, com chamadas para ação claras.'],
        ['Preciso de conhecimento técnico?', 'Nenhum. Descreva seu trabalho, a IA cria o site e você ajusta conversando ou com um editor visual.'],
      ],
    },
  },
};

/** Stable, ordered list of vertical slugs (controls hub + sitemap order). */
export const VERTICAL_SLUGS = Object.keys(VERTICALS);

/** A vertical entry by slug, or null. */
export function getVertical(slug) {
  return Object.prototype.hasOwnProperty.call(VERTICALS, slug) ? VERTICALS[slug] : null;
}

/** Lightweight list for hubs/cross-links: [{ slug, industry, label, keyword }]. */
export function listVerticals(lang = 'en') {
  return VERTICAL_SLUGS.map((slug) => {
    const v = VERTICALS[slug];
    return {
      slug,
      industry: v.industry,
      label: (v.label && (v.label[lang] || v.label.en)) || slug,
      keyword: (v.keyword && (v.keyword[lang] || v.keyword.en)) || '',
    };
  });
}

/** Pick a localized field ({en,es,pt}) with English fallback. */
export function vt(field, lang = 'en') {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.en || '';
}
