import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection, LegalSubheading } from './LegalLayout';
import { COMPANY_NAME, COMPANY_STATE, SUPPORT_DISCORD_URL as SUPPORT_URL, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from '@/lib/company';

export const TermsOfServicePage: React.FC = () => (
  <LegalLayout
    kind="terms"
    title="Terms of Service"
    subtitle="Please read these terms carefully before using Acosmibot"
    lastUpdated="August 6, 2026"
  >
    <LegalSection title="1. Introduction">
      <p>Welcome to Acosmibot! Acosmibot is operated by <strong>{COMPANY_NAME}</strong>, a {COMPANY_STATE} limited liability company ("{COMPANY_NAME}", "we", "us", or "our"). By using our Discord bot and related services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use Acosmibot.</p>
      <p>These terms govern your access to and use of Acosmibot, including any features, content, and services provided through the bot, the Acosmibot website, and any paid subscriptions.</p>
    </LegalSection>

    <LegalSection title="2. Service Description">
      <p>Acosmibot is a multi-featured Discord bot that provides the following services:</p>
      <ul>
        <li><strong>Leveling System:</strong> Experience points and level progression based on server activity</li>
        <li><strong>Economy System:</strong> Virtual currency, daily bonuses, and trading features</li>
        <li><strong>Games &amp; Gambling:</strong> Entertainment games including slots, blackjack, and other gambling features</li>
        <li><strong>AI Chat:</strong> Interactive AI-powered conversations using configured third-party providers</li>
        <li><strong>Utility Features:</strong> Reminders, server management tools, and other utilities</li>
      </ul>
      <p>All features are subject to change, addition, or removal at any time without prior notice.</p>
    </LegalSection>

    <LegalSection title="3. User Responsibilities">
      <p>By using Acosmibot, you agree to:</p>
      <ul>
        <li>Comply with Discord's Terms of Service and Community Guidelines</li>
        <li>Not abuse, exploit, or manipulate bot features for unfair advantages</li>
        <li>Not attempt to hack, reverse engineer, or compromise bot security</li>
        <li>Not use the bot for illegal activities or to harass other users</li>
        <li>Not spam commands or attempt to overload bot services</li>
        <li>Accept that server administrators have the right to configure or disable bot features</li>
      </ul>
      <p>Violation of these responsibilities may result in being banned from using Acosmibot.</p>
    </LegalSection>

    <LegalSection title="4. Data Usage">
      <p>Acosmibot collects and stores certain data to provide its services. This includes:</p>
      <ul>
        <li>Discord user IDs and usernames</li>
        <li>Server (guild) IDs and basic server information</li>
        <li>Activity data such as message counts and streaks</li>
        <li>Economy data including virtual currency balances</li>
        <li>Game statistics and history</li>
      </ul>
      <p>For detailed information about data collection and privacy, please review our <Link to="/privacy-policy" style={{ color: 'var(--primary-color)' }}>Privacy Policy</Link>.</p>
    </LegalSection>

    <LegalSection title="5. Virtual Currency & Economy">
      <p><strong>Important Notice:</strong> All virtual currency, items, and assets within Acosmibot have <strong>no real-world monetary value</strong> and cannot be exchanged for real money, goods, or services.</p>
      <ul>
        <li>Virtual currency is for entertainment purposes only</li>
        <li>We reserve the right to adjust, reset, or remove virtual currency at any time</li>
        <li>Lost or stolen virtual currency will not be restored</li>
        <li>Currency transfers and economy features may be modified or discontinued without notice</li>
      </ul>
    </LegalSection>

    <LegalSection title="6. Subscriptions, Billing & Refunds">
      <p>Acosmibot offers optional paid subscription tiers. The following terms apply to any purchase you make.</p>

      <LegalSubheading>6.1 Payment Processing</LegalSubheading>
      <p>Payments are processed by Stripe, Inc. on our behalf. {COMPANY_NAME} does not receive or store your full card number. Your use of Stripe's checkout is additionally subject to Stripe's own terms and privacy policy. Charges will appear on your statement under a descriptor associated with {COMPANY_NAME}.</p>

      <LegalSubheading>6.2 Automatic Renewal</LegalSubheading>
      <ul>
        <li>Subscriptions renew automatically at the end of each billing period (monthly or annual, as selected at checkout) until cancelled</li>
        <li>Your payment method is charged at the start of each new billing period</li>
        <li>All prices are listed in U.S. dollars and exclude any applicable taxes</li>
        <li>We may change subscription prices; changes take effect at your next renewal, and we will provide notice before the change applies to you</li>
      </ul>

      <LegalSubheading>6.3 Cancellation</LegalSubheading>
      <ul>
        <li>You may cancel at any time from the billing portal on the Acosmibot website</li>
        <li>Cancellation stops future renewals; your subscription remains active through the end of the period you already paid for</li>
        <li>We do not provide prorated refunds for the unused portion of a billing period</li>
      </ul>

      <LegalSubheading>6.4 Refunds</LegalSubheading>
      <ul>
        <li>Payments are generally non-refundable once the billing period has begun</li>
        <li>We will refund a charge where the service was materially unavailable for an extended period, where you were billed in error, or where a refund is required by applicable law</li>
        <li>Refund requests must be made within 30 days of the charge, by email to{' '}
          <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a> or through our{' '}
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a></li>
        <li>Refunds are issued to the original payment method</li>
        <li>Nothing here limits statutory cancellation or refund rights you may have as a consumer in your jurisdiction</li>
      </ul>

      <LegalSubheading>6.5 Failed Payments &amp; Chargebacks</LegalSubheading>
      <ul>
        <li>If a payment fails, premium features may be suspended until payment succeeds</li>
        <li>Initiating a chargeback instead of contacting us may result in termination of access; we ask that you contact us first so we can resolve the issue directly</li>
      </ul>

      <LegalSubheading>6.6 What a Subscription Is Not</LegalSubheading>
      <p>A subscription grants access to features of the Acosmibot service for the paid period. It does not purchase virtual currency, virtual items, or any asset with real-world value (see Section 5), and it does not guarantee that any specific feature will remain available indefinitely (see Section 10).</p>

      <LegalSubheading>6.7 Prepaid AI Credits</LegalSubheading>
      <p>We may offer optional prepaid AI Credits as service capacity for eligible, explicit AI requests. AI Credits are not Discord currency, virtual economy currency, gift cards, stored cash, or a security; they have no cash value, are not redeemable for money or other goods, and are non-transferable.</p>
      <ul>
        <li>Purchased credits are assigned to the personal or guild wallet selected at checkout. Guild credits remain with that guild and do not follow the purchaser if they leave the guild.</li>
        <li>Purchased credits do not expire under the current product terms. Promotional credits, if offered, may have a clearly stated expiration date.</li>
        <li>Included plan quota is used before eligible prepaid overage. Credits do not unlock subscription entitlements, premium configuration, or autonomous/ambient spending.</li>
        <li>AI requests remain subject to safety checks, rate limits, provider availability, and the applicable rate card. We reserve a bounded amount before provider work and settle only after a screened response is delivered.</li>
        <li>Refunds, disputes, or fraud reviews may reverse unused credits and may freeze a wallet while the issue is investigated. Credits already consumed for delivered service are generally not refundable, subject to applicable law and support review.</li>
        <li>We may pause sales or spending without deleting valid balances or ledger history. Any correction is recorded against the wallet history.</li>
      </ul>
    </LegalSection>

    <LegalSection title="7. Gambling & Games Disclaimer">
      <p>Acosmibot includes gambling features such as slots, blackjack, and other games of chance. Please note:</p>
      <ul>
        <li>All gambling is conducted with virtual currency that has no real-world value</li>
        <li>Games are designed for entertainment only and do not constitute real gambling</li>
        <li>Game outcomes are generated programmatically and may not represent true randomness</li>
        <li>We do not promote or encourage real-world gambling</li>
        <li>Users under the age of 13 should not use gambling features (per Discord's age requirements)</li>
      </ul>
    </LegalSection>

    <LegalSection title="8. AI Chat Services">
      <p>Acosmibot uses configured third-party AI services, which may include OpenAI or Google Gemini, to provide chat and media functionality:</p>
      <ul>
        <li>AI responses are generated automatically and may not always be accurate</li>
        <li>We are not responsible for the content of AI-generated messages</li>
        <li>AI chat messages may be subject to rate limits and daily usage caps</li>
        <li>Where enabled, explicit requests may use prepaid AI Credits after included quota and the applicable consent and policy checks</li>
        <li>Provider/model, token, latency, cost-estimate, reservation, and delivery metadata may be recorded for safety, accounting, support, and service operation; prompts and generated content are handled under the Privacy Policy</li>
        <li>AI features are provided "as is" without warranties of any kind</li>
      </ul>
    </LegalSection>

    <LegalSection title="9. Limitations of Liability">
      <p>Acosmibot is provided "as is" without warranties of any kind, either express or implied. We are not liable for:</p>
      <ul>
        <li>Service interruptions, downtime, or data loss</li>
        <li>Errors, bugs, or inaccuracies in bot functionality</li>
        <li>Any damages or losses resulting from your use of the bot</li>
        <li>Third-party services or content accessed through the bot</li>
        <li>Actions taken by server administrators using bot management features</li>
      </ul>
      <p>To the maximum extent permitted by law, the total liability of {COMPANY_NAME} arising out of or relating to these terms or your use of Acosmibot shall not exceed the greater of (a) the total amount you paid us in the twelve (12) months preceding the claim, or (b) $50 USD. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or lost data.</p>
      <p>Some jurisdictions do not allow the exclusion of certain warranties or the limitation of certain damages; in those jurisdictions, our liability is limited to the greatest extent permitted by law.</p>
    </LegalSection>

    <LegalSection title="10. Service Modifications">
      <p>We reserve the right to:</p>
      <ul>
        <li>Modify, suspend, or discontinue any part of Acosmibot at any time</li>
        <li>Change features, functionality, or availability without notice</li>
        <li>Implement usage limits, rate limits, or restrictions</li>
        <li>Update these Terms of Service at any time</li>
      </ul>
      <p>Continued use of Acosmibot after changes constitutes acceptance of the modified terms.</p>
    </LegalSection>

    <LegalSection title="11. Termination">
      <p>We reserve the right to terminate or suspend your access to Acosmibot at any time, with or without cause, and with or without notice. Reasons for termination may include:</p>
      <ul>
        <li>Violation of these Terms of Service</li>
        <li>Abuse or exploitation of bot features</li>
        <li>Illegal activities or harassment</li>
        <li>Any conduct that we deem harmful to the bot or its users</li>
      </ul>
    </LegalSection>

    <LegalSection title="12. Governing Law & Disputes">
      <p>These Terms of Service are governed by the laws of the State of {COMPANY_STATE}, United States, without regard to its conflict of law principles.</p>
      <p>Any dispute arising out of or relating to these terms or your use of Acosmibot shall be brought exclusively in the state or federal courts located in {COMPANY_STATE}, and you consent to the personal jurisdiction of those courts. This does not affect any right you may have to bring a claim in your local courts where applicable consumer law grants it.</p>
      <p>If any provision of these terms is found unenforceable, the remaining provisions remain in full force and effect.</p>
    </LegalSection>

    <LegalSection title="13. Changes to Terms">
      <p>We may update these Terms of Service from time to time. Changes will be effective immediately upon posting. Your continued use of Acosmibot after changes are posted constitutes acceptance of the new terms.</p>
      <p>We encourage you to review these terms periodically to stay informed about your rights and obligations.</p>
    </LegalSection>

    <LegalSection title="14. Contact Information">
      <p>Acosmibot is operated by <strong>{COMPANY_NAME}</strong> ({COMPANY_STATE}, United States).</p>
      <p>For questions about these Terms of Service, billing, or support, email us at{' '}
        <a href={SUPPORT_EMAIL_HREF} style={{ color: 'var(--primary-color)' }}>{SUPPORT_EMAIL}</a>{' '}
        or contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
    </LegalSection>
  </LegalLayout>
);

export default TermsOfServicePage;
