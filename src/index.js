// Caddisfly - Main Entry Point
// Phase 1: Foundation Setup

import { Router } from './router.js';
import { handleError } from './middleware/error-handler.js';
import { handleCorsPrelight, applyCorsHeaders } from './middleware/cors.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import { notFound } from './utils/response.js';

// Import route handlers
import { handleLanding } from './routes/public/landing.js';
import { handlePricing } from './routes/public/pricing.js';
import { handleTerms } from './routes/public/terms.js';
import { handlePrivacy } from './routes/public/privacy.js';
import { handleLogin } from './routes/admin/login.js';
import { handleGoogleCallback } from './routes/api/auth/google-callback.js';
import { handleLogout } from './routes/admin/logout.js';
import { handleAdminDashboard } from './routes/admin/dashboard.js';
import { handlePreviewCreate } from './routes/api/preview/create.js';
import { handleManualProfile } from './routes/api/preview/manual.js';
import { handlePreviewStatus } from './routes/api/preview/status.js';
import { handleRunBuild } from './routes/api/preview/run-build.js';
import { handleJoke } from './routes/api/fun.js';
import { handlePreviewView } from './routes/public/preview.js';
import { handlePreviewHtml } from './routes/public/preview-html.js';
import { handlePreviewAsset } from './routes/public/preview-asset.js';
import { handleVerify } from './routes/public/verify.js';

// AI Builder route handlers
import { handleAIBuilderLanding } from './routes/public/ai-builder-landing.js';
import { handleAIBuilderChat } from './routes/public/ai-builder-chat.js';
import { handleAIBuilderGenerating } from './routes/public/ai-builder-generating.js';
import { handleAIBuilderCustomize } from './routes/public/ai-builder-customize.js';
import { handleAIPreview } from './routes/public/ai-preview.js';
import { handlePublishedSite } from './routes/public/published-site.js';
import { handleStaticAsset, handleWebmanifest, handleOgImage, handleRobots, handleSitemap } from './routes/public/static-assets.js';
import { handleSetLang } from './routes/public/lang.js';
import { handleAIBuilderCreate } from './routes/api/ai-builder/create.js';
import { handleAIBuilderRespond } from './routes/api/ai-builder/respond.js';
import { handleAIBuilderGenerate } from './routes/api/ai-builder/generate.js';
import { handleAIBuilderUpload } from './routes/api/ai-builder/upload.js';
import { handleAIBuilderSectionUpdate } from './routes/api/ai-builder/sections.js';
import { handleSectionsReorder } from './routes/api/ai-builder/sections-reorder.js';
import { handleGetSectionEditor } from './routes/api/ai-builder/section-editor.js';
import { handleAddSection, handleDeleteSection } from './routes/api/ai-builder/section-create.js';
import { handleUpdateColors } from './routes/api/ai-builder/config-colors.js';
import { handleApplyTemplate } from './routes/api/ai-builder/apply-template.js';
import { handleUpdateFonts } from './routes/api/ai-builder/config-fonts.js';
import { handleAIEditPropose, handleAIEditApply } from './routes/api/ai-builder/ai-edit.js';
import { handleListPages, handleCreatePage, handleReorderPages, handleUpdatePage, handleDeletePage } from './routes/api/ai-builder/pages.js';
import { handleAIBuilderDeploy } from './routes/api/ai-builder/deploy.js';
import { handleUpdateSeo } from './routes/api/ai-builder/seo.js';
import { handleAddDomain, handleDomainStatus, handleRemoveDomain } from './routes/api/ai-builder/domains.js';

// Billing (Stripe + magic-link) route handlers
import { handleBilling, handleBillingVerify, handleBillingLogout } from './routes/public/billing.js';
import { handleBillingLogin, handleBillingCheckout, handleBillingPortal, handleCreditCheckout } from './routes/api/billing.js';
import { handleDashboard } from './routes/public/dashboard.js';
import { handleTeamAccept } from './routes/public/team-accept.js';
import { handleTeamInvite, handleTeamRole, handleTeamRemove } from './routes/api/team.js';
import { handleHelp } from './routes/public/help.js';
import { handleSupport } from './routes/public/support.js';
import { handleCreateTicket, handleReplyTicket } from './routes/api/support.js';
import { handleAdminTickets, handleAdminTicketReply, handleAdminTicketStatus } from './routes/admin/tickets.js';
import { handleAdminLegal, handleAdminLegalSave } from './routes/admin/legal.js';
import { handleStripeWebhook } from './routes/api/stripe-webhook.js';
import { billingAuth } from './middleware/billing-auth.js';
import { projectAccess } from './middleware/project-access.js';
import { handleTrack } from './routes/api/track.js';
import { handleSiteAnalytics } from './routes/public/analytics.js';
import { handleFormSubmit, handleFormDelete } from './routes/api/forms.js';
import { handleFormsInbox } from './routes/public/forms-inbox.js';
import { handleAIPreviewBlog } from './routes/public/ai-preview-blog.js';
import { handleAIPreviewShop } from './routes/public/ai-preview-shop.js';
import { handleBlogManager } from './routes/public/blog-manager.js';
import {
  handleBlogList, handleBlogCreate, handleBlogAIDraft, handleBlogUpdate,
  handleBlogPublish, handleBlogSocial, handleBlogCover, handleBlogDelete,
} from './routes/api/ai-builder/blog.js';
import {
  handleSnapshotList, handleSnapshotCreate, handleSnapshotRestore, handleSnapshotDelete,
  handleSnapshotAutoToggle,
} from './routes/api/ai-builder/snapshots.js';
import { autoSnapshotAfterEdit } from './utils/site-snapshot.js';
import { handleSiteExport } from './routes/api/ai-builder/export.js';
import {
  handleStoreStripeStatus, handleStoreStripeConnect, handleStoreStripeDisconnect,
  handleStripeConnectCallback,
  handleProductList, handleProductCreate, handleProductUpdate, handleProductDelete,
  handleProductAIDescribe, handleProductImage, handleStoreCheckout,
  handleStoreWebhook, handleOrderList, handleProductImport,
} from './routes/api/ai-builder/store.js';
import { handleStoreManager } from './routes/public/store-manager.js';
import { handleStoreReceipt } from './routes/public/store-receipt.js';
import { handleBuyerOrders, handleBuyerOrdersSend, handleBuyerOrdersAuth } from './routes/public/store-orders.js';

// Hourly auto-save, edit-driven: wrap state-changing project routes so a
// successful edit kicks maybeAutoSnapshot off the response path (waitUntil).
// "Changes were made" is implicit — it only ever fires from a real edit.
const autoSnap = (handler) => async (ctx) => {
  const res = await handler(ctx);
  try {
    if (res && res.status >= 200 && res.status < 300 && ctx.params && ctx.params.project_id && ctx.ctx && typeof ctx.ctx.waitUntil === 'function') {
      ctx.ctx.waitUntil(autoSnapshotAfterEdit(ctx.env, ctx.params.project_id).catch((e) => console.error('auto-snapshot:', e.message)));
    }
  } catch { /* never block the response */ }
  return res;
};

// Initialize router
const router = new Router();

// Public routes
router.get('/', handleLanding);
router.get('/pricing', handlePricing);
router.get('/terms', handleTerms);
router.get('/privacy', handlePrivacy);

// Brand static assets (favicons + manifest + OG image)
router.get('/favicon.ico', handleStaticAsset);
router.get('/favicon-16x16.png', handleStaticAsset);
router.get('/favicon-32x32.png', handleStaticAsset);
router.get('/favicon-48x48.png', handleStaticAsset);
router.get('/favicon-96x96.png', handleStaticAsset);
router.get('/apple-touch-icon.png', handleStaticAsset);
router.get('/android-chrome-192x192.png', handleStaticAsset);
router.get('/android-chrome-512x512.png', handleStaticAsset);
router.get('/site.webmanifest', handleWebmanifest);
router.get('/og.png', handleOgImage);
router.get('/robots.txt', handleRobots);
router.get('/sitemap.xml', handleSitemap);
router.get('/api/lang', handleSetLang);
router.get('/login', handleLogin);
router.get('/auth/google/callback', handleGoogleCallback);
router.get('/preview/:preview_id', handlePreviewView);
router.get('/preview/:preview_id/html/:page_index/:type', handlePreviewHtml);
router.get('/verify/:token', handleVerify);
router.get('/preview-asset/:preview_id/:filename', handlePreviewAsset);

// AI Builder public routes
router.get('/ai-builder', handleAIBuilderLanding);
router.get('/ai-builder/chat/:project_id', handleAIBuilderChat, [billingAuth, projectAccess]);
router.get('/ai-builder/generating/:project_id', handleAIBuilderGenerating, [billingAuth, projectAccess]);
router.get('/ai-builder/customize/:project_id', handleAIBuilderCustomize, [billingAuth, projectAccess]);
router.get('/ai-builder/analytics/:project_id', handleSiteAnalytics);
// Blog/shop preview routes MUST register before the generic :page_slug routes
// (the router is first-match; "blog"/"shop" would otherwise resolve as page slugs).
router.get('/ai-preview/:project_id/blog/:post_slug', handleAIPreviewBlog);
router.get('/ai-preview/:project_id/blog', handleAIPreviewBlog);
router.get('/ai-preview/:project_id/shop/:product_slug', handleAIPreviewShop);
router.get('/ai-preview/:project_id/shop', handleAIPreviewShop);
router.get('/ai-preview/:project_id', handleAIPreview);
router.get('/ai-preview/:project_id/:page_slug', handleAIPreview);
router.get('/site/:project_id/blog/:post_slug', handlePublishedSite);
router.get('/site/:project_id/shop/:product_slug', handlePublishedSite);
router.get('/site/:project_id', handlePublishedSite);
router.get('/site/:project_id/:page_slug', handlePublishedSite);

// Billing (magic-link auth; billingAuth sets ctx.billingEmail, never blocks)
router.get('/billing', handleBilling, [billingAuth]);
router.get('/billing/verify/:token', handleBillingVerify);
router.get('/billing/logout', handleBillingLogout);

// Customer dashboard (websites + team) and team management
router.get('/dashboard', handleDashboard, [billingAuth]);
router.get('/team/accept/:token', handleTeamAccept);

// Help/docs (public) + support tickets (customer, magic-link auth)
router.get('/help', handleHelp);
router.get('/support', handleSupport, [billingAuth]);
router.post('/api/support/ticket', handleCreateTicket, [billingAuth]);
router.post('/api/support/ticket/:public_id/reply', handleReplyTicket, [billingAuth]);

// API routes
router.post('/api/preview/create', handlePreviewCreate);
router.post('/api/preview/manual/:token', handleManualProfile);
router.get('/api/preview/:preview_id/status', handlePreviewStatus);
// Build executor for the refactor flow — called by the /verify building page;
// the build runs inside this (long-lived) request, not via waitUntil.
router.post('/api/preview/run-build/:token', handleRunBuild);
router.get('/api/fun/joke', handleJoke);

// Analytics beacon (public, cookieless)
router.post('/api/track', handleTrack);

// Contact-form submissions from published sites (public, cross-origin like /api/track)
router.post('/api/forms/submit', handleFormSubmit);
// Store checkout — public, called cross-origin by the mini cart on shop pages
router.post('/api/store/checkout', handleStoreCheckout);
// Buyer receipt page (Stripe success_url) + Connect webhook (order backstop)
router.get('/store/receipt', handleStoreReceipt);
router.post('/api/store/webhook', handleStoreWebhook);
// Buyer purchase history (magic-link, per site; first-match: specific before generic)
router.get('/store/orders/auth', handleBuyerOrdersAuth);
router.post('/store/orders/send', handleBuyerOrdersSend);
router.get('/store/orders', handleBuyerOrders);

// AI Builder API routes
router.post('/api/ai-builder/create', handleAIBuilderCreate);
// All project-scoped editing routes are gated [billingAuth, projectAccess]:
// signed-in non-members are blocked (cross-account); deploy/domains additionally
// check ctx.projectRole inside their handlers.
const PROJ = [billingAuth, projectAccess];
router.post('/api/ai-builder/:project_id/respond', handleAIBuilderRespond, PROJ);
router.post('/api/ai-builder/:project_id/generate-preview', handleAIBuilderGenerate, PROJ);
router.post('/api/ai-builder/:project_id/upload', handleAIBuilderUpload, PROJ);
router.get('/api/ai-builder/:project_id/sections/:section_id/editor', handleGetSectionEditor, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit', handleAIEditPropose, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit/apply', autoSnap(handleAIEditApply), PROJ);
router.put('/api/ai-builder/:project_id/sections/:section_id', autoSnap(handleAIBuilderSectionUpdate), PROJ);
router.put('/api/ai-builder/:project_id/sections/reorder', autoSnap(handleSectionsReorder), PROJ);
router.post('/api/ai-builder/:project_id/sections', autoSnap(handleAddSection), PROJ);
router.delete('/api/ai-builder/:project_id/sections/:section_id', autoSnap(handleDeleteSection), PROJ);
router.put('/api/ai-builder/:project_id/config/colors', autoSnap(handleUpdateColors), PROJ);
router.put('/api/ai-builder/:project_id/config/fonts', autoSnap(handleUpdateFonts), PROJ);
router.post('/api/ai-builder/:project_id/template', autoSnap(handleApplyTemplate), PROJ);
router.get('/api/ai-builder/:project_id/pages', handleListPages, PROJ);
router.post('/api/ai-builder/:project_id/pages', autoSnap(handleCreatePage), PROJ);
router.put('/api/ai-builder/:project_id/pages/reorder', autoSnap(handleReorderPages), PROJ);
router.put('/api/ai-builder/:project_id/pages/:page_id', autoSnap(handleUpdatePage), PROJ);
router.delete('/api/ai-builder/:project_id/pages/:page_id', autoSnap(handleDeletePage), PROJ);
router.put('/api/ai-builder/:project_id/seo', autoSnap(handleUpdateSeo), PROJ);
router.post('/api/ai-builder/:project_id/deploy', handleAIBuilderDeploy, PROJ);
router.post('/api/ai-builder/:project_id/domains', handleAddDomain, PROJ);
router.get('/api/ai-builder/:project_id/domains/:id/status', handleDomainStatus, PROJ);
router.delete('/api/ai-builder/:project_id/domains/:id', handleRemoveDomain, PROJ);

// Contact-form inbox (owner-facing; same access model as customize)
router.get('/ai-builder/forms/:project_id', handleFormsInbox, PROJ);
router.delete('/api/ai-builder/:project_id/forms/:id', handleFormDelete, PROJ);

// Blog manager + API (owner-facing; same access model as customize)
router.get('/ai-builder/blog/:project_id', handleBlogManager, PROJ);
router.get('/api/ai-builder/:project_id/blog', handleBlogList, PROJ);
router.post('/api/ai-builder/:project_id/blog', handleBlogCreate, PROJ);
router.post('/api/ai-builder/:project_id/blog/ai-draft', handleBlogAIDraft, PROJ);
router.put('/api/ai-builder/:project_id/blog/:post_id', handleBlogUpdate, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/publish', handleBlogPublish, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/social', handleBlogSocial, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/cover', handleBlogCover, PROJ);

// Store manager + Stripe Connect (owner-facing; same access model as customize).
// The OAuth callback is public — Stripe redirects the browser there; the
// HMAC-signed state (minted by the gated connect endpoint) authorizes it.
router.get('/ai-builder/store/:project_id', handleStoreManager, PROJ);
router.get('/api/ai-builder/:project_id/store/stripe', handleStoreStripeStatus, PROJ);
router.post('/api/ai-builder/:project_id/store/stripe/connect', handleStoreStripeConnect, PROJ);
router.post('/api/ai-builder/:project_id/store/stripe/disconnect', handleStoreStripeDisconnect, PROJ);
router.get('/store/stripe/callback', handleStripeConnectCallback);
// Products (first-match: the specific ai-describe route before :product_id)
router.get('/api/ai-builder/:project_id/store/products', handleProductList, PROJ);
router.post('/api/ai-builder/:project_id/store/products/ai-describe', handleProductAIDescribe, PROJ);
router.post('/api/ai-builder/:project_id/store/products', handleProductCreate, PROJ);
router.post('/api/ai-builder/:project_id/store/products/:product_id/image', handleProductImage, PROJ);
router.put('/api/ai-builder/:project_id/store/products/:product_id', handleProductUpdate, PROJ);
router.delete('/api/ai-builder/:project_id/store/products/:product_id', handleProductDelete, PROJ);
router.get('/api/ai-builder/:project_id/store/orders', handleOrderList, PROJ);
router.post('/api/ai-builder/:project_id/store/import', handleProductImport, PROJ);

// Site version snapshots (save / restore / delete / auto-save toggle)
router.get('/api/ai-builder/:project_id/snapshots', handleSnapshotList, PROJ);
router.post('/api/ai-builder/:project_id/snapshots', handleSnapshotCreate, PROJ);
router.put('/api/ai-builder/:project_id/snapshots/auto', handleSnapshotAutoToggle, PROJ);

// HTML export — download the published site as a ZIP ("your site is yours")
router.get('/api/ai-builder/:project_id/export', handleSiteExport, PROJ);
router.post('/api/ai-builder/:project_id/snapshots/:snapshot_id/restore', handleSnapshotRestore, PROJ);
router.delete('/api/ai-builder/:project_id/snapshots/:snapshot_id', handleSnapshotDelete, PROJ);
router.delete('/api/ai-builder/:project_id/blog/:post_id', handleBlogDelete, PROJ);

// Billing API
router.post('/api/billing/login', handleBillingLogin);
router.post('/api/billing/checkout', handleBillingCheckout, [billingAuth]);
router.post('/api/billing/credits/checkout', handleCreditCheckout, [billingAuth]);
router.post('/api/billing/portal', handleBillingPortal, [billingAuth]);
router.post('/api/team/invite', handleTeamInvite, [billingAuth]);
router.post('/api/team/role', handleTeamRole, [billingAuth]);
router.post('/api/team/remove', handleTeamRemove, [billingAuth]);
router.post('/api/stripe/webhook', handleStripeWebhook);

// Protected admin routes
router.get('/logout', handleLogout, [authMiddleware]);
router.get('/admin', handleAdminDashboard, [authMiddleware, adminMiddleware]);
router.get('/admin/tickets', handleAdminTickets, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/reply', handleAdminTicketReply, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/status', handleAdminTicketStatus, [authMiddleware, adminMiddleware]);
router.get('/admin/legal', handleAdminLegal, [authMiddleware, adminMiddleware]);
router.post('/api/admin/legal/:slug', handleAdminLegalSave, [authMiddleware, adminMiddleware]);

/**
 * Main fetch handler
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleCorsPrelight();
      }

      // Route the request
      let response = await router.route(request, env, ctx);

      // If no route matched, return 404
      if (!response) {
        response = notFound('Page not found');
      }

      // Apply CORS headers to response
      response = applyCorsHeaders(response);

      return response;
    } catch (error) {
      // Global error handling
      console.error('Unhandled error in fetch:', error);
      return handleError(error, request, env);
    }
  },
};
