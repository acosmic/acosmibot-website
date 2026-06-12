import React from 'react';
import { Link } from 'react-router-dom';
import { HighlightBox, LegalLayout, LegalSection, LegalSubheading } from './LegalLayout';

const SUPPORT_URL = 'https://discord.gg/hrj7WhCyEv';

export const PrivacyPolicyPage: React.FC = () => (
  <LegalLayout
    title="Privacy Policy"
    subtitle="Your privacy is important to us. Learn how we collect and protect your data."
    lastUpdated="April 18, 2026"
  >
    <LegalSection title="1. Introduction">
      <p>This Privacy Policy explains how Acosmibot collects, uses, stores, and protects your personal information when you use our Discord bot and related services.</p>
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
        <li><strong>Message Content:</strong> Messages sent to AI chat features are processed by OpenAI</li>
        <li><strong>Thread IDs:</strong> Conversation thread identifiers for context continuity</li>
        <li><strong>Usage Metrics:</strong> Number of AI messages sent for rate limiting purposes</li>
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
      </ul>
      <p>We do <strong>not</strong> sell, rent, or trade your personal information to third parties for marketing purposes.</p>
    </LegalSection>

    <LegalSection title="4. Third-Party Services">
      <p>Acosmibot integrates with the following third-party services that may have access to your data:</p>

      <LegalSubheading>4.1 Discord Platform</LegalSubheading>
      <p>All data collected is obtained through Discord's API and is subject to Discord's Privacy Policy. By using Discord, you agree to their terms and data practices.</p>

      <LegalSubheading>4.2 OpenAI (AI Chat Features)</LegalSubheading>
      <p>When you use AI chat features, your messages are sent to OpenAI's API for processing. OpenAI's data usage is governed by their Privacy Policy and API Data Usage Policies. Key points:</p>
      <ul>
        <li>Messages sent to AI chat are processed by OpenAI's GPT models</li>
        <li>OpenAI may temporarily store messages for API operation</li>
        <li>We do not share additional personal information beyond the chat messages</li>
        <li>OpenAI's data retention policies apply to AI chat interactions</li>
      </ul>

      <LegalSubheading>4.3 Database &amp; Hosting</LegalSubheading>
      <p>Your data is stored on secure database servers provided by trusted hosting providers. These providers have access to infrastructure but do not actively access or use your data.</p>
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
      </ul>
      <p>To request data deletion, please contact us through our Discord support server.</p>
    </LegalSection>

    <LegalSection title="7. Your Rights & Choices">
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of the data we have collected about you</li>
        <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
        <li><strong>Deletion:</strong> Request deletion of your personal data (subject to limitations)</li>
        <li><strong>Opt-Out:</strong> Stop using Acosmibot by removing it from your servers or discontinuing commands</li>
        <li><strong>Data Portability:</strong> Request your data in a machine-readable format</li>
      </ul>
      <p>To exercise these rights, contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
      <HighlightBox>
        <p style={{ margin: 0 }}><strong>Note:</strong> Some data may be retained for legitimate business purposes, such as fraud prevention or legal compliance, even after deletion requests.</p>
      </HighlightBox>
    </LegalSection>

    <LegalSection title="8. Children's Privacy">
      <p>Acosmibot does not knowingly collect information from users under the age of 13. Discord's Terms of Service require users to be at least 13 years old (or older in some jurisdictions).</p>
      <p>If we become aware that we have collected data from a user under 13, we will take steps to delete that information. Parents or guardians who believe their child has provided data should contact us immediately.</p>
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
        <li><strong>Local Storage:</strong> Stores authentication tokens for dashboard login persistence</li>
        <li><strong>Session Storage:</strong> Temporary storage for user session information</li>
        <li><strong>Essential Cookies:</strong> Required for website functionality (authentication, preferences)</li>
      </ul>
      <p>We do not use tracking cookies or third-party advertising cookies. All data storage is essential for providing our services.</p>
    </LegalSection>

    <LegalSection title="12. Contact Information">
      <p>If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us through our{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>Discord support server</a>.</p>
      <p>We will respond to inquiries within a reasonable timeframe and work to address your concerns in accordance with applicable privacy laws.</p>
      <p>See also our <Link to="/terms-of-service" style={{ color: 'var(--primary-color)' }}>Terms of Service</Link>.</p>
    </LegalSection>
  </LegalLayout>
);

export default PrivacyPolicyPage;
