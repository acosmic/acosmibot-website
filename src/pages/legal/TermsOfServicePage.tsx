import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from './LegalLayout';

const SUPPORT_URL = 'https://discord.gg/hrj7WhCyEv';

export const TermsOfServicePage: React.FC = () => (
  <LegalLayout
    title="Terms of Service"
    subtitle="Please read these terms carefully before using Acosmibot"
    lastUpdated="October 29, 2025"
  >
    <LegalSection title="1. Introduction">
      <p>Welcome to Acosmibot! By using our Discord bot and related services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use Acosmibot.</p>
      <p>These terms govern your access to and use of Acosmibot, including any features, content, and services provided through the bot.</p>
    </LegalSection>

    <LegalSection title="2. Service Description">
      <p>Acosmibot is a multi-featured Discord bot that provides the following services:</p>
      <ul>
        <li><strong>Leveling System:</strong> Experience points and level progression based on server activity</li>
        <li><strong>Economy System:</strong> Virtual currency, daily bonuses, and trading features</li>
        <li><strong>Games &amp; Gambling:</strong> Entertainment games including slots, blackjack, and other gambling features</li>
        <li><strong>AI Chat:</strong> Interactive AI-powered conversations using OpenAI technology</li>
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

    <LegalSection title="6. Gambling & Games Disclaimer">
      <p>Acosmibot includes gambling features such as slots, blackjack, and other games of chance. Please note:</p>
      <ul>
        <li>All gambling is conducted with virtual currency that has no real-world value</li>
        <li>Games are designed for entertainment only and do not constitute real gambling</li>
        <li>Game outcomes are generated programmatically and may not represent true randomness</li>
        <li>We do not promote or encourage real-world gambling</li>
        <li>Users under the age of 13 should not use gambling features (per Discord's age requirements)</li>
      </ul>
    </LegalSection>

    <LegalSection title="7. AI Chat Services">
      <p>Acosmibot uses third-party AI services (OpenAI) to provide chat functionality:</p>
      <ul>
        <li>AI responses are generated automatically and may not always be accurate</li>
        <li>We are not responsible for the content of AI-generated messages</li>
        <li>AI chat messages may be subject to rate limits and daily usage caps</li>
        <li>AI features are provided "as is" without warranties of any kind</li>
      </ul>
    </LegalSection>

    <LegalSection title="8. Limitations of Liability">
      <p>Acosmibot is provided "as is" without warranties of any kind, either express or implied. We are not liable for:</p>
      <ul>
        <li>Service interruptions, downtime, or data loss</li>
        <li>Errors, bugs, or inaccuracies in bot functionality</li>
        <li>Any damages or losses resulting from your use of the bot</li>
        <li>Third-party services or content accessed through the bot</li>
        <li>Actions taken by server administrators using bot management features</li>
      </ul>
      <p>To the maximum extent permitted by law, our total liability shall not exceed $0.</p>
    </LegalSection>

    <LegalSection title="9. Service Modifications">
      <p>We reserve the right to:</p>
      <ul>
        <li>Modify, suspend, or discontinue any part of Acosmibot at any time</li>
        <li>Change features, functionality, or availability without notice</li>
        <li>Implement usage limits, rate limits, or restrictions</li>
        <li>Update these Terms of Service at any time</li>
      </ul>
      <p>Continued use of Acosmibot after changes constitutes acceptance of the modified terms.</p>
    </LegalSection>

    <LegalSection title="10. Termination">
      <p>We reserve the right to terminate or suspend your access to Acosmibot at any time, with or without cause, and with or without notice. Reasons for termination may include:</p>
      <ul>
        <li>Violation of these Terms of Service</li>
        <li>Abuse or exploitation of bot features</li>
        <li>Illegal activities or harassment</li>
        <li>Any conduct that we deem harmful to the bot or its users</li>
      </ul>
    </LegalSection>

    <LegalSection title="11. Changes to Terms">
      <p>We may update these Terms of Service from time to time. Changes will be effective immediately upon posting. Your continued use of Acosmibot after changes are posted constitutes acceptance of the new terms.</p>
      <p>We encourage you to review these terms periodically to stay informed about your rights and obligations.</p>
    </LegalSection>

    <LegalSection title="12. Contact Information">
      <p>If you have questions about these Terms of Service or need support, please contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
    </LegalSection>
  </LegalLayout>
);

export default TermsOfServicePage;
