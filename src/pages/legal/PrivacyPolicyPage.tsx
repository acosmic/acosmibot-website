import React from 'react';
import { Link } from 'react-router-dom';
import { HighlightBox, LegalLayout, LegalSection, LegalSubheading } from './LegalLayout';
import { COMPANY_NAME, COMPANY_STATE, SUPPORT_DISCORD_URL as SUPPORT_URL, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from '@/lib/company';

export const PrivacyPolicyPage: React.FC = () => (
  <LegalLayout
    kind="privacy"
    title="Privacy Policy"
    subtitle="Your privacy is important to us. Learn how we collect and protect your data."
    lastUpdated="August 29, 2026"
  >
    <LegalSection title="1. Introduction">
      <p>This Privacy Policy explains how Acosmibot collects, uses, stores, and protects your personal information when you use our Discord bot and related services.</p>
      <p>Acosmibot is operated by <strong>{COMPANY_NAME}</strong>, a {COMPANY_STATE} limited liability company, which is the data controller responsible for the information described in this policy.</p>
      <p>By using Acosmibot, you consent to the data practices described in this policy. If you do not agree with this policy, please discontinue use of our services.</p>
      <HighlightBox>
        <p style={{ margin: 0 }}><strong>Important:</strong> Acosmibot is not affiliated with Discord Inc. We are an independent third-party bot operating on the Discord platform.</p>
      </HighlightBox>
    </LegalSection>

    <LegalSection title="2. Information We Collect">
      <p>Acosmibot collects the following types of data to provide its features and services:</p>

      <LegalSubheading>2.1 Discord Account Information</LegalSubheading>
      <ul>
        <li><strong>User IDs:</strong> Your unique Discord user identifier</li>
        <li><strong>Username &amp; Discriminator:</strong> Your Discord display name and tag</li>
        <li><strong>Avatar:</strong> Your profile picture for display in leaderboards and dashboards</li>
        <li><strong>Server Membership:</strong> List of servers where you and the bot share membership</li>
      </ul>

      <LegalSubheading>2.2 Activity &amp; Usage Data</LegalSubheading>
      <ul>
        <li><strong>Message Statistics:</strong> Count of messages sent in servers (not message content)</li>
        <li><strong>Better Social Embeds Activity:</strong> Daily server-level counts of supported links, replacement outcomes, social platform, and embed-provider resolution status. These aggregates do not store the member&apos;s user ID, channel or message IDs, message text, social URLs, account handles, or profile names.</li>
        <li><strong>Activity Streaks:</strong> Consecutive days of server activity for leveling features</li>
        <li><strong>Experience Points (XP):</strong> Calculated based on your server participation</li>
        <li><strong>Level Information:</strong> Your current level in each server and globally</li>
      </ul>

      <LegalSubheading>2.3 Economy &amp; Game Data</LegalSubheading>
      <ul>
        <li><strong>Virtual Currency:</strong> Balance of bot currency in each server and globally</li>
        <li><strong>Transaction History:</strong> Records of currency transfers, purchases, and rewards</li>
        <li><strong>Game Statistics:</strong> Win/loss records, games played, total amounts wagered</li>
        <li><strong>Gambling History:</strong> Results from slots, blackjack, and other game features</li>
      </ul>

      <LegalSubheading>2.4 AI Chat Interactions</LegalSubheading>
      <ul>
        <li><strong>Message Content:</strong> Messages sent to enabled AI chat features are processed by the configured provider, which may be OpenAI or Google Gemini</li>
        <li><strong>Thread IDs:</strong> Conversation thread identifiers for context continuity</li>
        <li><strong>Usage Metrics:</strong> Number of AI messages sent for rate limiting purposes</li>
        <li><strong>Provider Telemetry:</strong> Provider, model, layer, operation, timing, token categories, and cost-estimate metadata for safety, accounting, support, and margin monitoring; this structured telemetry does not store prompts or generated output</li>
        <li><strong>AI Image Records:</strong> Image-generation prompts, revised prompts, analysis text, and result URLs may be stored temporarily so the requested feature and support history can be provided; those content fields are automatically erased after 30 days while non-content quota and accounting fields remain</li>
        <li><strong>AI Credits Records:</strong> Wallet, purchase, reservation, ledger, refund/dispute, action, and call correlation identifiers; guild administrators see only guild-funded aggregate information, not personal balances or DM activity</li>
      </ul>

      <LegalSubheading>2.5 Website Sign-In Data</LegalSubheading>
      <p>When you log in to the Acosmibot website using Discord OAuth, we record the following for security purposes:</p>
      <ul>
        <li><strong>IP Address:</strong> Your IP address at the time of sign-in, used to detect and block abusive or unauthorized access</li>
        <li><strong>Browser/Device Info:</strong> Your user-agent string (browser type and OS) for security context</li>
        <li><strong>Sign-In Timestamp:</strong> Date and time of each login</li>
      </ul>
      <p>Sign-in logs are retained for 90 days and then automatically deleted. This data is used exclusively for security and abuse prevention and is never shared with third parties.</p>

      <LegalSubheading>2.6 Server (Guild) Information</LegalSubheading>
      <ul>
        <li><strong>Server ID:</strong> Unique identifier for Discord servers</li>
        <li><strong>Server Name:</strong> Display name of the server</li>
        <li><strong>Server Owner:</strong> User ID of the server owner</li>
        <li><strong>Member Count:</strong> Number of members in the server</li>
        <li><strong>Configuration Settings:</strong> Bot feature settings customized by server administrators</li>
      </ul>

      <LegalSubheading>2.7 Subscription &amp; Billing Data</LegalSubheading>
      <p>If you purchase a paid subscription, we record the information needed to provision and manage it:</p>
      <ul>
        <li><strong>Subscription Records:</strong> Tier, billing interval, status, renewal and cancellation dates</li>
        <li><strong>Processor Identifiers:</strong> The Stripe customer and subscription IDs linked to your account</li>
        <li><strong>Purchase History:</strong> Which server a subscription applies to and when it was purchased</li>
      </ul>
      <p>If you purchase prepaid AI Credits, we also record the selected pack, amount, personal or guild wallet target, Stripe Checkout/PaymentIntent identifiers, fulfillment state, immutable credit ledger entries, reservations, and refund or dispute reconciliation needed to provide the service and meet accounting obligations.</p>
      <HighlightBox>
        <p style={{ margin: 0 }}><strong>We never see your card details.</strong> Card numbers, billing addresses, and other payment credentials are collected and stored by Stripe, not by {COMPANY_NAME}.</p>
      </HighlightBox>

      <LegalSubheading>2.8 Optional Website Analytics</LegalSubheading>
      <p>If you allow analytics, we use Google Analytics to collect limited website-usage information:</p>
      <ul>
        <li><strong>Sanitized Page Categories:</strong> General route types with usernames, server IDs, resource IDs, query strings, and fragments removed</li>
        <li><strong>Product Actions:</strong> Limited events such as beginning Discord sign-in, opening a server, inviting the bot, or beginning checkout</li>
        <li><strong>Technical Context:</strong> Browser, device category, approximate region, referring source, and engagement information supplied by Google Analytics</li>
      </ul>
      <p>We do not send authentication credentials, Discord IDs, server IDs, usernames, form contents, configuration values, or user-entered text to Google Analytics. Analytics is disabled unless you choose to allow it.</p>

      <LegalSubheading>2.9 Error and Reliability Diagnostics</LegalSubheading>
      <p>We collect limited technical diagnostics when the bot or API fails. These records may include the service and release, an error category and code, exception type, stack-frame file and function names, operating-system/runtime context, timing, and database-pool health counts. Request bodies, headers, cookies, prompts, generated output, search queries, URLs, client IP addresses, and local variables are excluded. Local error and critical records may include the Discord user, server, channel, or message ID directly related to a failure so an authorized operator can provide support; routine local records use keyed pseudonyms instead. Raw Discord identifiers are never sent to Sentry.</p>
    </LegalSection>

    <LegalSection title="3. How We Use Your Data">
      <p>We collect and use your data for the following purposes:</p>
      <ul>
        <li><strong>Feature Delivery:</strong> To provide leveling, economy, games, and other bot features</li>
        <li><strong>User Experience:</strong> To track progress, display leaderboards, and personalize interactions</li>
        <li><strong>System Operations:</strong> To maintain functionality, prevent abuse, and optimize performance</li>
        <li><strong>Analytics:</strong> To understand usage patterns and improve bot features</li>
        <li><strong>Communication:</strong> To send announcements, notifications, and support responses</li>
        <li><strong>Security:</strong> To detect and prevent abuse, fraud, or violations of our Terms of Service</li>
        <li><strong>Billing:</strong> To provision paid subscriptions, sell and fulfill prepaid AI Credits, process renewals, refunds, disputes, and cancellations, and meet tax and accounting obligations</li>
      </ul>
      <p>We do <strong>not</strong> sell, rent, or trade your personal information to third parties for marketing purposes.</p>
    </LegalSection>

    <LegalSection title="4. Third-Party Services">
      <p>Acosmibot integrates with the following third-party services that may have access to your data:</p>

      <LegalSubheading>4.1 Discord Platform</LegalSubheading>
      <p>All data collected is obtained through Discord's API and is subject to Discord's Privacy Policy. By using Discord, you agree to their terms and data practices.</p>

      <LegalSubheading>4.2 AI Providers (OpenAI and Google Gemini)</LegalSubheading>
      <p>When you use an AI feature, the relevant message or media input is sent to the provider selected for that feature. The current providers may include OpenAI and Google Gemini. Each provider's handling of data is governed by its own privacy and API data-use policies.</p>
      <ul>
        <li>AI requests are sent only when a user invokes an enabled AI surface; ambient behavior is separately configurable and never uses prepaid credits</li>
        <li>We send the context required for the requested feature, and do not send credit-card credentials</li>
        <li>Provider retention, abuse monitoring, and processing terms apply to the request handled by that provider</li>
        <li>DM requests use a separate personal context and do not load guild memory, roster, settings, or tools</li>
      </ul>

      <LegalSubheading>4.3 Stripe (Payments)</LegalSubheading>
      <p>Paid subscriptions and prepaid AI Credit packs are processed by Stripe, Inc. or its applicable payment-service entities, which act as our payment processor. When you check out:</p>
      <ul>
        <li>Your payment details are submitted directly to Stripe and are never transmitted to or stored on our servers</li>
        <li>We share the Discord user ID and, for a guild purchase, the relevant server ID plus internal purchase metadata so payment can be matched to the correct wallet</li>
        <li>Stripe returns subscription status and customer identifiers to us so we can grant and revoke premium access</li>
        <li>For AI Credits, Stripe returns Checkout/PaymentIntent and refund/dispute state; our server verifies the catalog and records fulfillment or compensating ledger entries</li>
        <li>Stripe's handling of your data is governed by its own privacy policy, and Stripe may use payment data for fraud prevention as an independent controller</li>
      </ul>

      <LegalSubheading>4.4 Google Analytics</LegalSubheading>
      <p>When you allow optional analytics, Google processes sanitized usage events on our behalf so we can understand which areas of the website are useful and where visitors encounter friction. Advertising storage, Google Signals, and ad personalization are disabled. You can change your choice at any time using the “Cookie choices” link in the website footer.</p>

      <LegalSubheading>4.5 Database &amp; Hosting</LegalSubheading>
      <p>Your data is stored on secure database servers provided by trusted hosting providers. These providers have access to infrastructure but do not actively access or use your data.</p>

      <LegalSubheading>4.6 Sentry (Error Monitoring)</LegalSubheading>
      <p>We use Sentry as an independent, off-site error and availability monitoring service so failures can be detected even when the Acosmibot server is unavailable. Sentry receives the limited technical diagnostics described in Section 2.9. Client-side filtering removes request data, user content, raw identifiers, breadcrumbs, local variables, and exception messages before an event is sent. Sentry's handling of this diagnostic data is governed by its privacy and data-processing terms.</p>
    </LegalSection>

    <LegalSection title="5. Data Storage & Security">
      <p>We take data security seriously and implement the following measures:</p>
      <ul>
        <li><strong>Secure Databases:</strong> Data is stored in password-protected MySQL databases</li>
        <li><strong>Access Controls:</strong> Limited access to data by authorized personnel only</li>
        <li><strong>Encrypted Connections:</strong> API communications use HTTPS/TLS encryption</li>
        <li><strong>Regular Backups:</strong> Database backups to prevent data loss</li>
        <li><strong>Monitoring:</strong> Activity logs to detect unauthorized access attempts</li>
      </ul>
      <HighlightBox>
        <p style={{ margin: 0 }}><strong>Note:</strong> While we implement security measures, no system is 100% secure. We cannot guarantee absolute security of your data.</p>
      </HighlightBox>
    </LegalSection>

    <LegalSection title="6. Data Retention">
      <p>We retain your data for the following periods:</p>
      <ul>
        <li><strong>Active Users:</strong> Data is retained as long as you use Acosmibot in any server</li>
        <li><strong>Inactive Users:</strong> Data may be retained indefinitely for historical leaderboards and statistics</li>
        <li><strong>Deleted Accounts:</strong> If you delete your Discord account, associated data may remain until manually requested for deletion</li>
        <li><strong>Server Removal:</strong> When Acosmibot is removed from a server, per-server data is retained for potential re-addition</li>
        <li><strong>Billing Records:</strong> Subscription and transaction records are retained for at least seven years to satisfy tax, accounting, and legal obligations, even after an account deletion request</li>
        <li><strong>AI Credit Accounting:</strong> Wallet, purchase, ledger, reservation, refund, and dispute records may be retained for at least seven years for tax, accounting, fraud, and service-liability obligations</li>
        <li><strong>AI Provider Telemetry:</strong> Structured provider/cost/latency records are retained for up to 90 days for operations and reconciliation; prompts and generated content are not retained in those telemetry records</li>
        <li><strong>Local AI Traces:</strong> Content-free routing, provider, tool, safety, delivery, and settlement spans are retained for up to 90 days</li>
        <li><strong>AI Image Content:</strong> Stored generation prompts, revised prompts, analysis text, and result URLs are erased after 30 days; non-content quota and accounting fields may remain under the applicable operational or billing retention period</li>
        <li><strong>Error Monitoring:</strong> Scrubbed Sentry events are retained for no longer than 90 days and may be retained for a shorter period under the active project settings</li>
        <li><strong>Local Runtime Diagnostics:</strong> Local system journals, including raw Discord identifiers attached only to error and critical records, are capped at 14 days and are accessible only to authorized operators</li>
        <li><strong>Better Social Embeds Aggregates:</strong> Content-free daily server, outcome, platform, and provider-resolution counts are retained for up to 400 days</li>
        <li><strong>Optional Website Analytics:</strong> Event-level analytics data is retained for no longer than 14 months</li>
      </ul>
      <p>To request data deletion, email us at{' '}
        <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a>{' '}
        or contact us through our Discord support server.</p>
    </LegalSection>

    <LegalSection title="7. Your Rights & Choices">
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of the data we have collected about you</li>
        <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
        <li><strong>Deletion:</strong> Request deletion of your personal data (subject to limitations)</li>
        <li><strong>Opt-Out:</strong> Decline optional website analytics at any time and stop using Acosmibot by removing it from your servers or discontinuing commands</li>
        <li><strong>Data Portability:</strong> Request your data in a machine-readable format</li>
      </ul>
      <p>To exercise these rights, email us at{' '}
        <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a>{' '}
        or contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
      <HighlightBox>
        <p style={{ margin: 0 }}><strong>Note:</strong> Some data may be retained for legitimate business purposes, such as fraud prevention or legal compliance, even after deletion requests.</p>
      </HighlightBox>
    </LegalSection>

    <LegalSection title="8. Children's Privacy">
      <p>Acosmibot does not knowingly collect information from users under the age of 13. Discord's Terms of Service require users to be at least 13 years old (or older in some jurisdictions).</p>
      <p>If we become aware that we have collected data from a user under 13, we will take steps to delete that information. Parents or guardians who believe their child has provided data should contact us immediately at{' '}
        <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a>.</p>
    </LegalSection>

    <LegalSection title="9. International Data Transfers">
      <p>Your data may be transferred to and processed in countries other than your own. By using Acosmibot, you consent to the transfer of your data to these locations.</p>
      <p>We take steps to ensure appropriate safeguards are in place when data is transferred internationally, in accordance with applicable data protection laws.</p>
    </LegalSection>

    <LegalSection title="10. Changes to This Privacy Policy">
      <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons.</p>
      <p>When we make changes:</p>
      <ul>
        <li>The "Last Updated" date will be revised</li>
        <li>Significant changes may be announced in our Discord support server</li>
        <li>Continued use after changes constitutes acceptance of the new policy</li>
      </ul>
      <p>We encourage you to review this policy periodically to stay informed about how we protect your data.</p>
    </LegalSection>

    <LegalSection title="11. Cookie Policy">
      <p>The Acosmibot website uses the following types of data storage:</p>
      <ul>
        <li><strong>Essential Session Cookies:</strong> A Secure, HttpOnly cookie keeps you signed in without exposing the credential to website JavaScript</li>
        <li><strong>OAuth Security Cookie:</strong> A temporary signed cookie protects Discord sign-in from request forgery</li>
        <li><strong>Local Storage:</strong> Stores non-secret, versioned preferences such as your cookie choice and intended return page during sign-in</li>
        <li><strong>Optional Analytics Cookies:</strong> Google Analytics cookies are permitted only after you select “Accept all” or enable Analytics under “Manage choices”</li>
      </ul>
      <p>We do not use third-party advertising cookies. Declining analytics does not affect dashboard functionality, Discord sign-in, subscriptions, or bot features.</p>
      <p>If we introduce a new optional cookie purpose, we will update this policy and ask you to choose again; accepting the current categories does not authorize undisclosed future uses.</p>
    </LegalSection>

    <LegalSection title="12. Contact Information">
      <p>Acosmibot is operated by <strong>{COMPANY_NAME}</strong> ({COMPANY_STATE}, United States), the data controller for the purposes of this policy.</p>
      <p>If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, email us at{' '}
        <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a>{' '}
        or contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
      <p>We will respond to inquiries within a reasonable timeframe and work to address your concerns in accordance with applicable privacy laws.</p>
      <p>See also our <Link to="/terms-of-service" style={{ color: 'var(--primary-color)' }}>Terms of Service</Link>.</p>
    </LegalSection>
  </LegalLayout>
);

export default PrivacyPolicyPage;
