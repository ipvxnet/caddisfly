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
import { handleOffer } from './routes/public/offer.js';
import { handleSpeed } from './routes/public/speed.js';
import { handleCompare } from './routes/public/compare.js';
import { handleVerticalLanding, handleVerticalHub } from './routes/public/vertical-landing.js';
import { handleShowcase } from './routes/public/showcase.js';
import { handleTemplatesShowcase, handleTemplateDemo } from './routes/public/templates.js';
import { handleAdminShowcase, handleAdminShowcaseAdd, handleAdminShowcaseUpdate, handleAdminShowcaseDelete } from './routes/admin/showcase.js';
import { handleAdminLeads, handleLeadsIngest, handleLeadUpdate, handleLeadDelete, handleLeadAdd, handleLeadsNeedEmail, handleLeadsEnrich, handleLeadsPlaceIds, handleLeadsScrape } from './routes/admin/leads.js';
import { handlePreviewAccess } from './routes/admin/preview-access.js';
import { handleLeadQuoteList, handleLeadQuoteCreate, handleLeadQuoteGet, handleLeadQuoteStatus, handleLeadOrderStatus, handleLeadQuoteDelete, handleLeadQuoteSend, handleLeadQuoteTemplateGet, handleLeadQuoteTemplateSave, handleLeadQuotePreview, handleLeadQuoteEmailUpdate, handleLeadQuoteUpdate, handleLeadQuoteReviewAdd, handleLeadQuoteCatalog } from './routes/admin/lead-quotes.js';
import { handleTerms } from './routes/public/terms.js';
import { handlePrivacy } from './routes/public/privacy.js';
import { handleLogin } from './routes/admin/login.js';
import { handleGoogleCallback } from './routes/api/auth/google-callback.js';
import { handleLogout } from './routes/admin/logout.js';
import { handleAdminDashboard } from './routes/admin/dashboard.js';
import { handlePreviewCreate } from './routes/api/preview/create.js';
import { handlePreviewSearch } from './routes/api/preview/search.js';
import { handlePreviewBuildConfirm } from './routes/api/preview/build.js';
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
import { handleAIBuilderDetailed } from './routes/public/ai-builder-detailed.js';
import { handleAIPreview } from './routes/public/ai-preview.js';
import { handlePublishedSite } from './routes/public/published-site.js';
import { handleStaticAsset, handleWebmanifest, handleOgImage, handleRobots, handleSitemap } from './routes/public/static-assets.js';
import { handleSetLang } from './routes/public/lang.js';
import { handleAIBuilderCreate } from './routes/api/ai-builder/create.js';
import { handleAIBuilderRespond } from './routes/api/ai-builder/respond.js';
import { handleAIBuilderGenerate } from './routes/api/ai-builder/generate.js';
import { handleAIBuilderUpload } from './routes/api/ai-builder/upload.js';
import { handleAIBuilderDetailedSubmit } from './routes/api/ai-builder/detailed.js';
import { handleAIBuilderPrefill } from './routes/api/ai-builder/prefill.js';
import { handleAIBuilderSectionUpdate } from './routes/api/ai-builder/sections.js';
import { handleSectionsReorder } from './routes/api/ai-builder/sections-reorder.js';
import { handleGetSectionEditor } from './routes/api/ai-builder/section-editor.js';
import { handleAddSection, handleDeleteSection } from './routes/api/ai-builder/section-create.js';
import { handleUpdateColors } from './routes/api/ai-builder/config-colors.js';
import { handleApplyTemplate } from './routes/api/ai-builder/apply-template.js';
import { handleStockPhoto, handleGenerateImage } from './routes/api/ai-builder/service-image.js';
import { handleUpdateFonts } from './routes/api/ai-builder/config-fonts.js';
import { handleAIEditPropose, handleAIEditApply } from './routes/api/ai-builder/ai-edit.js';
import { handleListPages, handleCreatePage, handleReorderPages, handleUpdatePage, handleDeletePage } from './routes/api/ai-builder/pages.js';
import { handleSuggestMenu, handleApplyMenu } from './routes/api/ai-builder/menu.js';
import { handleAIBuilderDeploy } from './routes/api/ai-builder/deploy.js';
import { handleUpdateSeo, handleSeoAiReview } from './routes/api/ai-builder/seo.js';
import { handleAddDomain, handleDomainStatus, handleRemoveDomain } from './routes/api/ai-builder/domains.js';

// Billing (Stripe + magic-link) route handlers
import { handleBilling, handleBillingVerify, handleBillingLogout } from './routes/public/billing.js';
import { handleBillingLogin, handleBillingCheckout, handleBillingPortal, handleCreditCheckout } from './routes/api/billing.js';
import { handlePluginSubscribe, handlePluginCancel } from './routes/api/plugins.js';
import { handlePluginsMarketplace } from './routes/public/plugins.js';
import { handleDashboard } from './routes/public/dashboard.js';
import { handleTeamAccept } from './routes/public/team-accept.js';
import { handleTeamInvite, handleTeamRole, handleTeamRemove, handleTeamSites } from './routes/api/team.js';
import { handleHelp } from './routes/public/help.js';
import { handleSupport } from './routes/public/support.js';
import { handleActivity } from './routes/public/activity.js';
import { handleCreateTicket, handleReplyTicket } from './routes/api/support.js';
import { handleAdminTickets, handleAdminTicketReply, handleAdminTicketStatus } from './routes/admin/tickets.js';
import { handleAdminAudit } from './routes/admin/audit.js';
import { handleAdminRevenue } from './routes/admin/revenue.js';
import { handleAdminLegal, handleAdminLegalSave } from './routes/admin/legal.js';
import { handleStripeWebhook } from './routes/api/stripe-webhook.js';
import { billingAuth } from './middleware/billing-auth.js';
import { projectAccess } from './middleware/project-access.js';
import { pluginGate } from './plugins/entitlements.js';
import { handleCrmManager } from './routes/public/crm-manager.js';
import { handleAccountsManager, handleAccountEditPage, handleAccountCreate, handleAccountSave, handleAccountDelete } from './routes/public/crm-accounts.js';
import { handleStockView, handleStockUpdate } from './routes/public/crm-stock.js';
import { handleStockImportPage, handleStockImport, handleStockImportTemplate, handleInventoryTokenRotate, handleInventoryTokenRevoke } from './routes/public/crm-stock-import.js';
import { handleInventoryList, handleInventoryUpsert, handleInventoryOptions } from './routes/api/inventory.js';
import { handleCrmContacts, handleCrmContactUpdate, handleCrmActivity, handleCrmContactAdd, handleCrmDedupKey } from './routes/api/ai-builder/crm.js';
import { handleQuotesManager } from './routes/public/quotes-manager.js';
import { handleQuoteList, handleQuoteCreate, handleQuoteGet, handleQuoteStatus, handleOrderStatus, handleQuoteDelete, handleQuoteSend, handleQuoteTemplateGet, handleQuoteTemplateSave, handleQuotePreview, handleQuoteEmailUpdate, handleQuoteUpdate, handleQuoteReviewAdd, handleQuoteProducts } from './routes/api/ai-builder/crm-quotes.js';
import { handleQuoteView, handleQuotePdf } from './routes/public/quote-view.js';
import { handleTransferInitiate, handleTransferCancel } from './routes/api/transfer.js';
import { handleTransferPage } from './routes/public/transfer-page.js';
import { handleTransferAcceptPage, handleTransferAcceptExecute, handleTransferDecline, handleTransferSubscribe } from './routes/public/transfer-accept.js';
import { handleTrack } from './routes/api/track.js';
import { handleSiteAnalytics } from './routes/public/analytics.js';
import { handleFormSubmit, handleFormDelete, handleFormTest, handleFormSettings } from './routes/api/forms.js';
import { handleFormsInbox } from './routes/public/forms-inbox.js';
import { handleSiteReport, handleRunSpeed } from './routes/public/site-report.js';
import { handleAIPreviewBlog } from './routes/public/ai-preview-blog.js';
import { handleAIPreviewShop } from './routes/public/ai-preview-shop.js';
import { handleBlogManager } from './routes/public/blog-manager.js';
import { handleBookingManager } from './routes/public/booking-manager.js';
import { handleBookingCancelPage, handleBookingCancelAction } from './routes/public/booking-cancel.js';
import { handleBookingReceipt } from './routes/public/booking-receipt.js';
import { handleBookingReschedulePage, handleBookingRescheduleAction } from './routes/public/booking-reschedule.js';
import { handleBookingFeed } from './routes/public/booking-feed.js';
import { handleBookingServices, handleBookingSlots, handleBookingCreate } from './routes/api/booking.js';
import {
  handleBookingServiceList, handleBookingServiceCreate, handleBookingServiceUpdate, handleBookingServiceDelete, handleBookingServiceDescribe,
  handleBookingHoursSave, handleBookingOverrideSave, handleBookingOverrideDelete, handleBookingHolidaysAdd,
  handleBookingSettingsSave, handleBookingOwnerCancel, handleBookingIcalToken,
} from './routes/api/ai-builder/booking.js';
import {
  handleBlogList, handleBlogCreate, handleBlogAIDraft, handleBlogUpdate,
  handleBlogPublish, handleBlogSocial, handleBlogCover, handleBlogDelete,
  handleBlogInboundAddress,
} from './routes/api/ai-builder/blog.js';
import { handleSocialSettings, handleSocialTest, handleSocialShare } from './routes/api/ai-builder/social.js';
import {
  handleSnapshotList, handleSnapshotCreate, handleSnapshotRestore, handleSnapshotDelete,
  handleSnapshotAutoToggle, handleRevertToOriginal,
} from './routes/api/ai-builder/snapshots.js';
import { autoSnapshotAfterEdit } from './utils/site-snapshot.js';
import { handleSiteExport } from './routes/api/ai-builder/export.js';
import { handleSiteQr } from './routes/api/ai-builder/qr.js';
import {
  handleStoreStripeStatus, handleStoreStripeConnect, handleStoreStripeDisconnect,
  handleStripeConnectCallback,
  handleProductList, handleProductCreate, handleProductUpdate, handleProductDelete,
  handleProductAIDescribe, handleProductImage, handleStoreCheckout,
  handleStoreWebhook, handleOrderList, handleProductImport,
  handleDiscountList, handleDiscountCreate, handleDiscountUpdate, handleDiscountDelete,
  handleDiscountValidate,
  handleVariantList, handleVariantCreate, handleVariantUpdate, handleVariantDelete,
  handleSubPriceList, handleSubPriceCreate, handleStoreSubscribe,
} from './routes/api/ai-builder/store.js';
import { handleLogoGenerate, handleLogoSet } from './routes/api/ai-builder/logo.js';
import { handleGenerateHeroVideo } from './routes/api/ai-builder/hero-video.js';
import { handleVideoSink } from './routes/api/ai-builder/video-sink.js';
import { handleDomainSearch, handleDomainCheckout, handleDomainReceipt, handleDomainOrders, handleDomainAutoRenew, handleDomainReconnect, handleDnsList, handleDnsSync, handleDnsSave, handleDnsEmailSetup, handleRenewCheckout, handleRenewReceipt } from './routes/api/domains-store.js';
import { handleDomainsStorePage } from './routes/public/domains-store-page.js';
import { processRenewals } from './routes/api/domains-renew.js';
import { processBookingReminders } from './routes/api/bookings-remind.js';
import { handleHolidayThemesSave, processHolidayThemes } from './routes/api/ai-builder/holiday-themes.js';
import { processPluginGraceHides } from './plugins/grace-cron.js';
import { handleOffboardStatus, handleUnpublish, handleDeleteSite } from './routes/api/ai-builder/offboard.js';
import { handleListManagers, handleRemoveManager } from './routes/api/ai-builder/managers.js';
import { handleInboundEmail } from './routes/email/inbound-blog.js';

/** GET /api/admin/domains/renew?dry=1&now=<unix> — manual renewal run
 *  (admin-only test). `now` simulates a date so dry-runs can preview the
 *  window without waiting; it's ignored unless dry=1 (never charge on a sim). */
async function handleAdminRenewRun(ctx) {
  const dryRun = ctx.query && (ctx.query.dry === '1' || ctx.query.dry === 'true');
  const opts = { dryRun };
  const nowOverride = parseInt(ctx.query && ctx.query.now, 10);
  if (dryRun && Number.isFinite(nowOverride)) opts.now = nowOverride;
  const summary = await processRenewals(ctx.env, opts);
  return new Response(JSON.stringify({ success: true, summary }), { headers: { 'Content-Type': 'application/json' } });
}

/** GET /api/admin/bookings/remind?dry=1&now=<unix> — manual reminder run
 *  (admin-only test; `now` simulates the clock, honored only with dry=1). */
async function handleAdminRemindRun(ctx) {
  const dryRun = ctx.query && (ctx.query.dry === '1' || ctx.query.dry === 'true');
  const opts = { dryRun };
  const nowOverride = parseInt(ctx.query && ctx.query.now, 10);
  if (dryRun && Number.isFinite(nowOverride)) opts.now = nowOverride;
  const summary = await processBookingReminders(ctx.env, opts);
  return new Response(JSON.stringify({ success: true, summary }), { headers: { 'Content-Type': 'application/json' } });
}

/** GET /api/admin/holiday-themes/run?dry=1&now=YYYY-MM-DD — manual tick
 *  (admin-only test; `now` simulates the date, honored only with dry=1). */
async function handleAdminHolidayRun(ctx) {
  const dryRun = ctx.query && (ctx.query.dry === '1' || ctx.query.dry === 'true');
  const opts = { dryRun };
  // Unlike renewals, `now` is honored on REAL runs too: applying a holiday
  // skin is fully reversible by the inverse call (?now=<after the window>),
  // and that's exactly how you demo a December theme in June.
  if (ctx.query && ctx.query.now) opts.now = String(ctx.query.now);
  const summary = await processHolidayThemes(ctx.env, ctx.ctx, opts);
  return new Response(JSON.stringify({ success: true, summary }), { headers: { 'Content-Type': 'application/json' } });
}
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
router.get('/offer', handleOffer);
router.get('/speed', handleSpeed);
router.get('/compare', handleCompare);
router.get('/website-builder', handleVerticalHub);
router.get('/website-builder/:vertical', handleVerticalLanding);
router.get('/showcase', handleShowcase);
router.get('/templates', handleTemplatesShowcase);
router.get('/templates/:key', handleTemplateDemo);
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
router.get('/ai-builder', handleAIBuilderLanding, [billingAuth]);
router.get('/ai-builder/chat/:project_id', handleAIBuilderChat, [billingAuth, projectAccess]);
router.get('/ai-builder/generating/:project_id', handleAIBuilderGenerating, [billingAuth, projectAccess]);
router.get('/ai-builder/customize/:project_id', handleAIBuilderCustomize, [billingAuth, projectAccess]);
router.get('/ai-builder/detailed/:project_id', handleAIBuilderDetailed, [billingAuth, projectAccess]);
router.get('/ai-builder/analytics/:project_id', handleSiteAnalytics, [billingAuth, projectAccess]);
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

// Plugin marketplace + add-on subscribe/cancel (a $5/mo module on the existing sub).
router.get('/plugins', handlePluginsMarketplace, [billingAuth]);
router.post('/api/plugins/:key/subscribe', handlePluginSubscribe, [billingAuth]);
router.post('/api/plugins/:key/cancel', handlePluginCancel, [billingAuth]);

// CRM plugin (gated by an active 'crm' entitlement).
router.get('/ai-builder/crm/:project_id', handleCrmManager, [billingAuth, projectAccess, pluginGate('crm')]);
router.get('/api/ai-builder/:project_id/crm/contacts', handleCrmContacts, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/contacts', handleCrmContactAdd, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/dedup-key', handleCrmDedupKey, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/contacts/:email', handleCrmContactUpdate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.get('/api/ai-builder/:project_id/crm/contacts/:email/activity', handleCrmActivity, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
// CRM Accounts (Phase 1) — structured company records with multiple contacts.
router.get('/ai-builder/crm/:project_id/accounts', handleAccountsManager, [billingAuth, projectAccess, pluginGate('crm')]);
router.get('/ai-builder/crm/:project_id/accounts/:account_id', handleAccountEditPage, [billingAuth, projectAccess, pluginGate('crm')]);
router.post('/api/ai-builder/:project_id/crm/accounts', handleAccountCreate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/accounts/:account_id', handleAccountSave, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.delete('/api/ai-builder/:project_id/crm/accounts/:account_id', handleAccountDelete, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
// CRM Stock — inventory view connected to the Advanced Store (edits gated by advanced_store).
router.get('/ai-builder/crm/:project_id/stock', handleStockView, [billingAuth, projectAccess, pluginGate('crm')]);
router.put('/api/ai-builder/:project_id/crm/stock', handleStockUpdate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.get('/ai-builder/crm/:project_id/stock/import', handleStockImportPage, [billingAuth, projectAccess, pluginGate('crm')]);
router.get('/ai-builder/crm/:project_id/stock/import/template', handleStockImportTemplate, [billingAuth, projectAccess, pluginGate('crm')]);
router.post('/api/ai-builder/:project_id/crm/stock/import', handleStockImport, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/inventory-token', handleInventoryTokenRotate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.delete('/api/ai-builder/:project_id/crm/inventory-token', handleInventoryTokenRevoke, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
// Public inventory REST API (Phase 3) — token-authed (Bearer), NO session.
router.get('/api/inventory/products', handleInventoryList);
router.post('/api/inventory/products', handleInventoryUpsert);
router.register('OPTIONS', '/api/inventory/products', handleInventoryOptions);
// CRM — Quotation & Order Management
router.get('/ai-builder/crm/:project_id/quotes', handleQuotesManager, [billingAuth, projectAccess, pluginGate('crm')]);
router.get('/api/ai-builder/:project_id/crm/quote-products', handleQuoteProducts, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.get('/api/ai-builder/:project_id/crm/quote-template', handleQuoteTemplateGet, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/quote-template', handleQuoteTemplateSave, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.get('/api/ai-builder/:project_id/crm/quotes', handleQuoteList, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/quotes', handleQuoteCreate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.get('/api/ai-builder/:project_id/crm/quotes/:quote_id', handleQuoteGet, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/quotes/:quote_id/status', handleQuoteStatus, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/quotes/:quote_id/order-status', handleOrderStatus, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/quotes/:quote_id/send', handleQuoteSend, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/quotes/:quote_id/preview', handleQuotePreview, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/quotes/:quote_id/email', handleQuoteEmailUpdate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.put('/api/ai-builder/:project_id/crm/quotes/:quote_id', handleQuoteUpdate, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.post('/api/ai-builder/:project_id/crm/quotes/:quote_id/review', handleQuoteReviewAdd, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
router.delete('/api/ai-builder/:project_id/crm/quotes/:quote_id', handleQuoteDelete, [billingAuth, projectAccess, pluginGate('crm', { json: true })]);
// Public hosted quote page + PDF (token-authed, no session)
router.get('/q/:token', handleQuoteView);
router.get('/q/:token/pdf', handleQuotePdf);
// Website transfer — owner initiates/cancels; recipient accepts/declines
router.get('/ai-builder/:project_id/transfer', handleTransferPage, [billingAuth, projectAccess]);
router.post('/api/ai-builder/:project_id/transfer', handleTransferInitiate, [billingAuth, projectAccess]);
router.post('/api/ai-builder/:project_id/transfer/cancel', handleTransferCancel, [billingAuth, projectAccess]);
router.get('/transfer/accept/:token', handleTransferAcceptPage, [billingAuth]);
router.post('/transfer/accept/:token', handleTransferAcceptExecute, [billingAuth]);
router.post('/transfer/accept/:token/subscribe', handleTransferSubscribe, [billingAuth]);
router.post('/transfer/decline/:token', handleTransferDecline, [billingAuth]);

// Customer dashboard (websites + team) and team management
router.get('/dashboard', handleDashboard, [billingAuth]);
router.get('/team/accept/:token', handleTeamAccept);
router.get('/booking/receipt', handleBookingReceipt);
router.get('/booking/cancel/:token', handleBookingCancelPage);
router.post('/booking/cancel/:token', handleBookingCancelAction);
router.get('/booking/feed/:token', handleBookingFeed);
router.get('/booking/reschedule/:token', handleBookingReschedulePage);
router.post('/booking/reschedule/:token', handleBookingRescheduleAction);

// Help/docs (public) + support tickets (customer, magic-link auth)
router.get('/help', handleHelp);
router.get('/support', handleSupport, [billingAuth]);
router.get('/activity', handleActivity, [billingAuth]);

// Domain store (Namecheap reselling)
router.get('/domains', handleDomainsStorePage, [billingAuth]);
router.get('/domains/receipt', handleDomainReceipt, [billingAuth]);
router.get('/api/domains/search', handleDomainSearch, [billingAuth]);
router.post('/api/domains/checkout', handleDomainCheckout, [billingAuth]);
router.get('/api/domains/orders', handleDomainOrders, [billingAuth]);
router.post('/api/domains/:id/auto-renew', handleDomainAutoRenew, [billingAuth]);
router.post('/api/domains/:id/renew-checkout', handleRenewCheckout, [billingAuth]);
router.get('/domains/renew-receipt', handleRenewReceipt, [billingAuth]);
router.post('/api/domains/:id/reconnect', handleDomainReconnect, [billingAuth]);
router.get('/api/domains/:id/dns', handleDnsList, [billingAuth]);
router.get('/api/domains/:id/dns/sync', handleDnsSync, [billingAuth]);
router.put('/api/domains/:id/dns', handleDnsSave, [billingAuth]);
router.post('/api/domains/:id/dns/email', handleDnsEmailSetup, [billingAuth]);
router.post('/api/support/ticket', handleCreateTicket, [billingAuth]);
router.post('/api/support/ticket/:public_id/reply', handleReplyTicket, [billingAuth]);

// API routes
router.post('/api/preview/create', handlePreviewCreate);
// Refactor preview flow: look up what we found (paid Places, capped) → confirm → build.
router.post('/api/preview/search', handlePreviewSearch);
router.post('/api/preview/build/:preview_id', handlePreviewBuildConfirm);
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
// Booking engine (public, called cross-origin from published sites like forms)
router.get('/api/booking/:project_id/services', handleBookingServices);
router.get('/api/booking/:project_id/slots', handleBookingSlots);
router.post('/api/booking/:project_id/book', handleBookingCreate);
// Video upload sink — PUBLIC, token-authorized; the xAI video model PUTs the
// finished clip here under Zero Data Retention (see video-sink.js).
router.put('/api/video-sink/:token', handleVideoSink);
router.post('/api/video-sink/:token', handleVideoSink);
// Store checkout — public, called cross-origin by the mini cart on shop pages
router.post('/api/store/checkout', handleStoreCheckout);
router.post('/api/store/discount/validate', handleDiscountValidate);
router.post('/api/store/subscribe', handleStoreSubscribe);
// Buyer receipt page (Stripe success_url) + Connect webhook (order backstop)
router.get('/store/receipt', handleStoreReceipt);
router.post('/api/store/webhook', handleStoreWebhook);
// Buyer purchase history (magic-link, per site; first-match: specific before generic)
router.get('/store/orders/auth', handleBuyerOrdersAuth);
router.post('/store/orders/send', handleBuyerOrdersSend);
router.get('/store/orders', handleBuyerOrders);

// AI Builder API routes
router.post('/api/ai-builder/create', handleAIBuilderCreate, [billingAuth]);
// All project-scoped editing routes are gated [billingAuth, projectAccess]:
// signed-in non-members are blocked (cross-account); deploy/domains additionally
// check ctx.projectRole inside their handlers.
const PROJ = [billingAuth, projectAccess];
router.post('/api/ai-builder/:project_id/respond', handleAIBuilderRespond, PROJ);
router.post('/api/ai-builder/:project_id/generate-preview', handleAIBuilderGenerate, PROJ);
router.post('/api/ai-builder/:project_id/upload', handleAIBuilderUpload, PROJ);
router.post('/api/ai-builder/:project_id/detailed', handleAIBuilderDetailedSubmit, PROJ);
router.post('/api/ai-builder/:project_id/prefill', handleAIBuilderPrefill, PROJ);
router.get('/api/ai-builder/:project_id/sections/:section_id/editor', handleGetSectionEditor, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit', handleAIEditPropose, PROJ);
router.post('/api/ai-builder/:project_id/sections/:section_id/ai-edit/apply', autoSnap(handleAIEditApply), PROJ);
// NOTE: literal routes must precede same-method param routes — the router is
// first-match-wins, and /sections/:section_id swallowed /sections/reorder for
// ages ("Failed to update section order: Section not found").
router.put('/api/ai-builder/:project_id/sections/reorder', autoSnap(handleSectionsReorder), PROJ);
router.put('/api/ai-builder/:project_id/sections/:section_id', autoSnap(handleAIBuilderSectionUpdate), PROJ);
router.post('/api/ai-builder/:project_id/sections', autoSnap(handleAddSection), PROJ);
router.delete('/api/ai-builder/:project_id/sections/:section_id', autoSnap(handleDeleteSection), PROJ);
router.put('/api/ai-builder/:project_id/config/colors', autoSnap(handleUpdateColors), PROJ);
router.put('/api/ai-builder/:project_id/config/fonts', autoSnap(handleUpdateFonts), PROJ);
router.post('/api/ai-builder/:project_id/template', autoSnap(handleApplyTemplate), PROJ);
router.post('/api/ai-builder/:project_id/stock-photo', handleStockPhoto, PROJ);
router.post('/api/ai-builder/:project_id/generate-image', handleGenerateImage, PROJ);
router.get('/api/ai-builder/:project_id/pages', handleListPages, PROJ);
router.post('/api/ai-builder/:project_id/pages', autoSnap(handleCreatePage), PROJ);
router.put('/api/ai-builder/:project_id/pages/reorder', autoSnap(handleReorderPages), PROJ);
router.put('/api/ai-builder/:project_id/pages/:page_id', autoSnap(handleUpdatePage), PROJ);
router.delete('/api/ai-builder/:project_id/pages/:page_id', autoSnap(handleDeletePage), PROJ);
router.post('/api/ai-builder/:project_id/menu/suggest', handleSuggestMenu, PROJ);
router.post('/api/ai-builder/:project_id/menu/apply', autoSnap(handleApplyMenu), PROJ);
router.put('/api/ai-builder/:project_id/seo', autoSnap(handleUpdateSeo), PROJ);
router.post('/api/ai-builder/:project_id/seo/ai-review', handleSeoAiReview, PROJ);
router.post('/api/ai-builder/:project_id/logo/generate', handleLogoGenerate, PROJ);
router.post('/api/ai-builder/:project_id/hero-video/generate', handleGenerateHeroVideo, PROJ);
router.post('/api/ai-builder/:project_id/logo', autoSnap(handleLogoSet), PROJ);
router.post('/api/ai-builder/:project_id/deploy', handleAIBuilderDeploy, PROJ);
router.get('/api/ai-builder/:project_id/offboard', handleOffboardStatus, PROJ);
router.post('/api/ai-builder/:project_id/unpublish', handleUnpublish, PROJ);
router.post('/api/ai-builder/:project_id/delete', handleDeleteSite, PROJ);
router.get('/api/ai-builder/:project_id/managers', handleListManagers, PROJ);
router.post('/api/ai-builder/:project_id/managers/remove', handleRemoveManager, PROJ);
router.post('/api/ai-builder/:project_id/domains', handleAddDomain, PROJ);
router.get('/api/ai-builder/:project_id/domains/:id/status', handleDomainStatus, PROJ);
router.delete('/api/ai-builder/:project_id/domains/:id', handleRemoveDomain, PROJ);

// Contact-form inbox (owner-facing; same access model as customize)
router.get('/ai-builder/forms/:project_id', handleFormsInbox, PROJ);
// Site report — third-party dependency audit + PageSpeed (Desktop/Mobile).
router.get('/ai-builder/report/:project_id', handleSiteReport, PROJ);
router.post('/api/ai-builder/:project_id/report/speed', handleRunSpeed, PROJ);
router.delete('/api/ai-builder/:project_id/forms/:id', handleFormDelete, PROJ);
router.post('/api/ai-builder/:project_id/forms/test', handleFormTest, PROJ);
router.put('/api/ai-builder/:project_id/forms/settings', handleFormSettings, PROJ);

// Blog manager + API (owner-facing; same access model as customize)
router.get('/ai-builder/blog/:project_id', handleBlogManager, PROJ);
router.get('/ai-builder/bookings/:project_id', handleBookingManager, PROJ);
// Booking engine — owner management
router.get('/api/ai-builder/:project_id/booking/services', handleBookingServiceList, PROJ);
router.post('/api/ai-builder/:project_id/booking/services', handleBookingServiceCreate, PROJ);
router.post('/api/ai-builder/:project_id/booking/services/describe', handleBookingServiceDescribe, PROJ);
router.put('/api/ai-builder/:project_id/booking/services/:service_id', handleBookingServiceUpdate, PROJ);
router.delete('/api/ai-builder/:project_id/booking/services/:service_id', handleBookingServiceDelete, PROJ);
router.put('/api/ai-builder/:project_id/booking/hours', handleBookingHoursSave, PROJ);
router.post('/api/ai-builder/:project_id/booking/overrides', handleBookingOverrideSave, PROJ);
router.post('/api/ai-builder/:project_id/booking/holidays', handleBookingHolidaysAdd, PROJ);
router.delete('/api/ai-builder/:project_id/booking/overrides/:override_id', handleBookingOverrideDelete, PROJ);
router.put('/api/ai-builder/:project_id/booking/settings', handleBookingSettingsSave, PROJ);
router.put('/api/ai-builder/:project_id/holiday-themes', handleHolidayThemesSave, PROJ);
router.post('/api/ai-builder/:project_id/booking/ical-token', handleBookingIcalToken, PROJ);
router.post('/api/ai-builder/:project_id/booking/:booking_id/cancel', handleBookingOwnerCancel, PROJ);
router.get('/api/ai-builder/:project_id/blog', handleBlogList, PROJ);
router.post('/api/ai-builder/:project_id/blog', handleBlogCreate, PROJ);
router.post('/api/ai-builder/:project_id/blog/ai-draft', handleBlogAIDraft, PROJ);
router.post('/api/ai-builder/:project_id/blog/inbound-address', handleBlogInboundAddress, PROJ);
router.put('/api/ai-builder/:project_id/blog/:post_id', handleBlogUpdate, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/publish', handleBlogPublish, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/social', handleBlogSocial, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/cover', handleBlogCover, PROJ);
// Social syndication (Discord/Slack auto-share) — owner-facing, same access model
router.put('/api/ai-builder/:project_id/social/settings', handleSocialSettings, PROJ);
router.post('/api/ai-builder/:project_id/social/test', handleSocialTest, PROJ);
router.post('/api/ai-builder/:project_id/blog/:post_id/share', handleSocialShare, PROJ);

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
// Discount codes (Advanced Store plugin — gated by entitlement).
const ADV = [billingAuth, projectAccess, pluginGate('advanced_store', { json: true })];
router.get('/api/ai-builder/:project_id/store/discounts', handleDiscountList, ADV);
router.post('/api/ai-builder/:project_id/store/discounts', handleDiscountCreate, ADV);
router.put('/api/ai-builder/:project_id/store/discounts/:discount_id', handleDiscountUpdate, ADV);
router.delete('/api/ai-builder/:project_id/store/discounts/:discount_id', handleDiscountDelete, ADV);
// Product variants (Advanced Store plugin — gated by entitlement).
router.get('/api/ai-builder/:project_id/store/products/:product_id/variants', handleVariantList, ADV);
router.post('/api/ai-builder/:project_id/store/products/:product_id/variants', handleVariantCreate, ADV);
router.put('/api/ai-builder/:project_id/store/products/:product_id/variants/:variant_id', handleVariantUpdate, ADV);
router.delete('/api/ai-builder/:project_id/store/products/:product_id/variants/:variant_id', handleVariantDelete, ADV);
router.get('/api/ai-builder/:project_id/store/prices', handleSubPriceList, PROJ);
router.post('/api/ai-builder/:project_id/store/prices', handleSubPriceCreate, PROJ);

// Site version snapshots (save / restore / delete / auto-save toggle)
router.get('/api/ai-builder/:project_id/snapshots', handleSnapshotList, PROJ);
router.post('/api/ai-builder/:project_id/snapshots', handleSnapshotCreate, PROJ);
router.put('/api/ai-builder/:project_id/snapshots/auto', handleSnapshotAutoToggle, PROJ);

// HTML export — download the published site as a ZIP ("your site is yours")
router.get('/api/ai-builder/:project_id/export', handleSiteExport, PROJ);
// QR code for the site's live URL (print/share) — first-party, all tiers
router.get('/api/ai-builder/:project_id/qr', handleSiteQr, PROJ);
router.post('/api/ai-builder/:project_id/snapshots/:snapshot_id/restore', handleSnapshotRestore, PROJ);
router.post('/api/ai-builder/:project_id/revert-original', handleRevertToOriginal, PROJ);
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
router.post('/api/team/sites', handleTeamSites, [billingAuth]);
router.post('/api/stripe/webhook', handleStripeWebhook);

// Protected admin routes
router.get('/logout', handleLogout, [authMiddleware]);
router.get('/admin', handleAdminDashboard, [authMiddleware, adminMiddleware]);
router.get('/admin/tickets', handleAdminTickets, [authMiddleware, adminMiddleware]);
router.get('/admin/audit', handleAdminAudit, [authMiddleware, adminMiddleware]);
router.get('/admin/revenue', handleAdminRevenue, [authMiddleware, adminMiddleware]);
router.get('/api/admin/domains/renew', handleAdminRenewRun, [authMiddleware, adminMiddleware]);
router.get('/api/admin/bookings/remind', handleAdminRemindRun, [authMiddleware, adminMiddleware]);
router.get('/api/admin/holiday-themes/run', handleAdminHolidayRun, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/reply', handleAdminTicketReply, [authMiddleware, adminMiddleware]);
router.post('/api/admin/tickets/:public_id/status', handleAdminTicketStatus, [authMiddleware, adminMiddleware]);
router.get('/admin/legal', handleAdminLegal, [authMiddleware, adminMiddleware]);
router.post('/api/admin/legal/:slug', handleAdminLegalSave, [authMiddleware, adminMiddleware]);
router.get('/admin/showcase', handleAdminShowcase, [authMiddleware, adminMiddleware]);
router.post('/api/admin/showcase', handleAdminShowcaseAdd, [authMiddleware, adminMiddleware]);
router.post('/api/admin/showcase/:id', handleAdminShowcaseUpdate, [authMiddleware, adminMiddleware]);
router.delete('/api/admin/showcase/:id', handleAdminShowcaseDelete, [authMiddleware, adminMiddleware]);
// Leads — Caddisfly's outbound-sales CRM. Ingest is token-authorized (for the
// lead-gen script); the UI + edits are admin-session gated.
router.post('/api/admin/leads/ingest', handleLeadsIngest);
router.get('/api/admin/leads/place-ids', handleLeadsPlaceIds);
router.get('/api/admin/leads/need-email', handleLeadsNeedEmail);
router.post('/api/admin/leads/enrich', handleLeadsEnrich);
router.post('/api/admin/leads/scrape', handleLeadsScrape);
router.get('/admin/preview-access', handlePreviewAccess, [authMiddleware, adminMiddleware]);
router.post('/admin/preview-access', handlePreviewAccess, [authMiddleware, adminMiddleware]);
router.get('/admin/leads', handleAdminLeads, [authMiddleware, adminMiddleware]);
router.post('/api/admin/leads', handleLeadAdd, [authMiddleware, adminMiddleware]);
// Global Caddisfly quote template + catalog (MUST precede /:id so ':id' doesn't capture them)
router.get('/api/admin/leads/quote-catalog', handleLeadQuoteCatalog, [authMiddleware, adminMiddleware]);
router.get('/api/admin/leads/quote-template', handleLeadQuoteTemplateGet, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/quote-template', handleLeadQuoteTemplateSave, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/:id', handleLeadUpdate, [authMiddleware, adminMiddleware]);
router.delete('/api/admin/leads/:id', handleLeadDelete, [authMiddleware, adminMiddleware]);
// Admin Leads CRM — Quotation & Order Management (shared engine, owner = lead)
router.get('/api/admin/leads/:id/quotes', handleLeadQuoteList, [authMiddleware, adminMiddleware]);
router.post('/api/admin/leads/:id/quotes', handleLeadQuoteCreate, [authMiddleware, adminMiddleware]);
router.get('/api/admin/leads/:id/quotes/:quote_id', handleLeadQuoteGet, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/:id/quotes/:quote_id/status', handleLeadQuoteStatus, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/:id/quotes/:quote_id/order-status', handleLeadOrderStatus, [authMiddleware, adminMiddleware]);
router.post('/api/admin/leads/:id/quotes/:quote_id/send', handleLeadQuoteSend, [authMiddleware, adminMiddleware]);
router.post('/api/admin/leads/:id/quotes/:quote_id/preview', handleLeadQuotePreview, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/:id/quotes/:quote_id/email', handleLeadQuoteEmailUpdate, [authMiddleware, adminMiddleware]);
router.put('/api/admin/leads/:id/quotes/:quote_id', handleLeadQuoteUpdate, [authMiddleware, adminMiddleware]);
router.post('/api/admin/leads/:id/quotes/:quote_id/review', handleLeadQuoteReviewAdd, [authMiddleware, adminMiddleware]);
router.delete('/api/admin/leads/:id/quotes/:quote_id', handleLeadQuoteDelete, [authMiddleware, adminMiddleware]);

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

  // Daily cron (wrangler [triggers]) — domain auto-renewals + expiry reminders.
  // Production only: preview shares the real Namecheap account, so renewals
  // there would really renew + charge.
  async scheduled(event, env, ctx) {
    if (env.ENVIRONMENT !== 'production') return;
    // Two schedules share this handler — dispatch on the cron expression.
    if (event && event.cron === '30 * * * *') {
      try {
        const summary = await processBookingReminders(env);
        console.log('booking reminders:', JSON.stringify(summary));
      } catch (e) {
        console.error('scheduled booking reminders failed:', e.message);
      }
      return;
    }
    try {
      const summary = await processRenewals(env);
      console.log('renewals:', JSON.stringify(summary));
    } catch (e) {
      console.error('scheduled renewals failed:', e.message);
    }
    try {
      const summary = await processHolidayThemes(env, ctx);
      console.log('holiday themes:', JSON.stringify(summary));
    } catch (e) {
      console.error('scheduled holiday themes failed:', e.message);
    }
    try {
      const summary = await processPluginGraceHides(env, ctx);
      console.log('plugin grace hides:', JSON.stringify(summary));
    } catch (e) {
      console.error('scheduled plugin grace hides failed:', e.message);
    }
  },

  // Inbound email (Cloudflare Email Routing → this worker). Turns an email sent
  // to a site's secret address into a DRAFT blog post for review.
  async email(message, env, ctx) {
    try {
      await handleInboundEmail(message, env, ctx);
    } catch (e) {
      console.error('email handler failed:', e && e.message);
    }
  },
};
