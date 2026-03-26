import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="marketing-about-page legal-page">
      <h1 className="landing-section-title">Privacy</h1>
      <p className="landing-sub legal-effective-date">Effective Date: March 26, 2026</p>

      <div className="legal-content">
        <p>
          Buffi (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains what
          information we collect, how we use it, and what choices you have. By using Buffi, you agree to the
          practices described in this policy.
        </p>

        <h2>1. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your email address and display name. We use Firebase
          Authentication to manage sign-in. We do not store passwords - authentication is handled via email
          magic links.
        </p>
        <h3>Scan Data</h3>
        <p>
          When you scan a product, we process the information you provide - product URLs, tag photos, or
          manual entries - to generate material analysis. We store anonymous aggregate scan data at the product
          level (brand, fiber composition, markup range, verdict) to improve Buffi&apos;s analysis over time. We do not
          store tag photos after analysis is complete.
        </p>
        <h3>Usage Data</h3>
        <p>
          We collect basic usage information such as scan count, save count, and account creation date to operate
          the service and enforce free tier limits.
        </p>
        <h3>Waitlist Data</h3>
        <p>
          If you join our waitlist, we collect your first name and email address solely to notify you when Buffi
          launches or expands access.
        </p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and operate the Buffi service</li>
          <li>To generate material analysis and verdicts for scanned products</li>
          <li>To enforce free tier limits and manage Pro subscriptions</li>
          <li>To send you product updates and launch notifications if you have joined our waitlist</li>
          <li>
            To improve the accuracy of our material cost estimates and verdict logic over time using anonymous
            aggregate data
          </li>
          <li>To respond to support requests</li>
        </ul>

        <h2>3. Third Party Services</h2>
        <p>
          Buffi uses the following third party services to operate. Each has its own privacy policy governing how
          they handle data:
        </p>
        <ul>
          <li>Firebase (Google) - authentication and database storage</li>
          <li>Anthropic Claude API - AI-powered material analysis</li>
          <li>Google Cloud Vision API - optical character recognition for tag photos</li>
          <li>SerpAPI - Google Shopping price lookups</li>
          <li>Poshmark and eBay APIs - secondhand product search (Pro feature)</li>
        </ul>
        <p>
          We share only the minimum data necessary with each service to perform its function. We do not sell your
          personal information to any third party.
        </p>

        <h2>4. What We Do Not Do</h2>
        <p>We want to be explicit about our commitments:</p>
        <ul>
          <li>We do not sell your personal data to brands, advertisers, or any third party</li>
          <li>We do not accept payment from brands to influence scan verdicts or product recommendations</li>
          <li>We do not display advertising in the Buffi app</li>
          <li>We do not share individual scan history with any brand whose products you have scanned</li>
          <li>We do not store tag photos after analysis is complete</li>
        </ul>

        <h2>5. Data Retention</h2>
        <p>
          Scan history is retained for 24 hours for free users and indefinitely for Pro users until deleted. Saved
          items are retained until you delete them or close your account. Waitlist data is retained until you request
          removal or Buffi launches publicly. Anonymous aggregate product scan data may be retained indefinitely
          as it contains no personal information.
        </p>

        <h2>6. Your Rights and Choices</h2>
        <p>
          You may request deletion of your account and associated personal data at any time by contacting us at{" "}
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>
          . Upon request we will delete your account data, scan history, and saved items. Anonymous aggregate
          product data that does not identify you personally cannot be deleted as it is not linked to your account.
        </p>
        <p>
          You may unsubscribe from waitlist communications at any time using the unsubscribe link in any email we
          send.
        </p>

        <h2>7. Data Security</h2>
        <p>
          We use industry-standard security practices including Firebase security rules, server-side API key
          management, and encrypted data transmission. API keys and credentials are never exposed to the client.
          However, no method of transmission over the internet is 100% secure and we cannot guarantee absolute
          security.
        </p>

        <h2>8. EU Users - GDPR</h2>
        <p>
          If you are located in the European Union or European Economic Area, the following additional rights apply
          to you under the General Data Protection Regulation (GDPR):
        </p>
        <h3>Legal Basis for Processing</h3>
        <p>
          We process your personal data on the following legal bases: contract performance (to provide the Buffi
          service you have signed up for), legitimate interests (to improve our service using anonymous aggregate
          data), and consent (for waitlist communications, which you may withdraw at any time).
        </p>
        <h3>Your GDPR Rights</h3>
        <ul>
          <li>Right of access - you may request a copy of the personal data we hold about you</li>
          <li>Right to rectification - you may request correction of inaccurate personal data</li>
          <li>Right to erasure - you may request deletion of your personal data (the right to be forgotten)</li>
          <li>Right to restriction - you may request that we limit how we use your data</li>
          <li>Right to data portability - you may request your data in a machine-readable format</li>
          <li>Right to object - you may object to processing based on legitimate interests</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>
          . We will respond within 30 days. If you are unsatisfied with our response you have the right to lodge a
          complaint with your local data protection authority.
        </p>
        <h3>Data Transfers</h3>
        <p>
          Buffi is operated from the United States. If you are located in the EU, your data will be transferred to and
          processed in the United States. We rely on Standard Contractual Clauses and the data processing
          agreements of our third party providers (Google/Firebase, Anthropic) for lawful transfer of EU personal
          data.
        </p>
        <h3>Data Protection Contact</h3>
        <p>
          For GDPR-related inquiries contact us at{" "}
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>{" "}
          with the subject line &quot;GDPR Request&quot;.
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>
          Buffi is not directed at children under the age of 13 (or 16 in certain EU member states). We do not
          knowingly collect personal information from children below these ages. If you believe a child has provided
          us with personal information, please contact us at{" "}
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>{" "}
          and we will delete it promptly.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify registered users of material changes
          via email at least 14 days before changes take effect. Continued use of Buffi after changes take effect
          constitutes acceptance of the updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          If you have questions about this Privacy Policy or your data, please contact us at:
          <br />
          Buffi
          <br />
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>
          <br />
          North Carolina, United States
        </p>
        <p className="legal-tagline">Buffi - Material intelligence for the conscious shopper.</p>
      </div>

      <p className="legal-back-link">
        <Link href="/" className="marketing-link">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
