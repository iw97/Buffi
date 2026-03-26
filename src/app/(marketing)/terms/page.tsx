import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="marketing-about-page legal-page">
      <h1 className="landing-section-title">Terms</h1>
      <p className="landing-sub legal-effective-date">Effective Date: March 26, 2026</p>

      <div className="legal-content">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Buffi, operated by Buffi (&quot;we,&quot; &quot;our,&quot; or
          &quot;us&quot;). By accessing or using Buffi you agree to these Terms. If you do not agree, do not use Buffi.
        </p>

        <h2>1. What Buffi Is</h2>
        <p>
          Buffi is a consumer information tool that analyzes clothing products based on fiber composition, estimated
          material costs, and retail pricing to provide independent verdicts on product value. Buffi is not affiliated
          with, sponsored by, or endorsed by any clothing brand. Our analysis is independent and no brand can pay
          to influence our verdicts.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 13 years old to use Buffi. By using Buffi you represent that you meet this
          requirement. If you are under 18 you represent that you have parental or guardian consent to use the
          service.
        </p>

        <h2>3. Your Account</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account and for all activity that occurs under
          your account. You agree to provide accurate information when creating your account and to keep it up to
          date. You may not share your account with others or use another person&apos;s account without permission.
        </p>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably
          believe are being used fraudulently or abusively.
        </p>

        <h2>4. Free and Pro Tiers</h2>
        <p>
          Buffi offers a free tier and a paid Pro subscription. The free tier includes unlimited scans, core analysis
          and verdict, and up to 2 saved items with 24-hour scan history. Buffi Pro includes unlimited saves,
          extended scan history, personal analytics, and additional features as described at the time of purchase.
        </p>
        <p>
          Pro subscription fees are billed in advance on a monthly or annual basis. Fees are non-refundable except
          as required by law or at our discretion. We reserve the right to change Pro pricing with reasonable notice
          to existing subscribers.
        </p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use Buffi for any unlawful purpose or in violation of any applicable law</li>
          <li>Attempt to reverse engineer, scrape, or extract data from Buffi&apos;s analysis pipeline or database</li>
          <li>Use automated means to access Buffi at a rate that exceeds normal human usage</li>
          <li>Attempt to circumvent rate limits or other technical restrictions</li>
          <li>Use Buffi to make false or misleading claims about any brand or product</li>
          <li>Impersonate another person or entity</li>
        </ul>

        <h2>6. Analysis Disclaimer</h2>
        <p>
          Buffi&apos;s material cost estimates, markup calculations, and verdicts are based on publicly available fiber
          composition data, commodity fabric pricing, and AI-powered analysis. They are estimates, not guaranteed
          facts.
        </p>
        <p>Specifically:</p>
        <ul>
          <li>
            Estimated material costs are approximations based on commodity fabric prices and typical garment
            construction. Actual production costs vary by manufacturer, order volume, country of manufacture, and
            many other factors.
          </li>
          <li>
            Markup percentages are calculated from estimated material costs and may not reflect a brand&apos;s actual
            production expenses including labor, design, logistics, and overhead.
          </li>
          <li>
            Verdicts (Worth It, Think Twice, Retail Trap) represent Buffi&apos;s independent assessment based on
            available data and should be used as one input among many in your purchasing decisions, not as
            definitive financial or consumer advice.
          </li>
        </ul>
        <p>
          Buffi is a decision-support tool. We are not responsible for purchase decisions made based on our
          analysis.
        </p>

        <h2>7. Intellectual Property</h2>
        <p>
          Buffi&apos;s name, logo, design, and proprietary analysis methodology are owned by Buffi and may not be used
          without our written permission. Product information analyzed by Buffi remains the property of the
          respective brands and retailers. Buffi does not claim ownership of any third party product data.
        </p>
        <p>
          Your account data and scan history belong to you. You grant us a limited license to use that data to
          provide and improve the Buffi service as described in our Privacy Policy.
        </p>

        <h2>8. Third Party Content</h2>
        <p>
          Buffi analyzes publicly available product information from third party websites and retailers. We are not
          responsible for the accuracy, completeness, or availability of third party product data. Product pages,
          prices, and fiber composition information may change and Buffi&apos;s analysis may not reflect the most
          current information at all times.
        </p>
        <p>
          Better alternative recommendations are generated algorithmically based on fiber quality and markup
          analysis. These are not endorsements and Buffi receives no compensation for surfacing any specific
          product as an alternative.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Buffi shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising from your use of or inability to use the service, including but
          not limited to losses arising from purchasing decisions made based on Buffi&apos;s analysis.
        </p>
        <p>
          Our total liability to you for any claims arising from these Terms or your use of Buffi shall not exceed the
          amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
        </p>

        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Buffi and its officers, directors, employees, and agents from
          any claims, damages, or expenses (including reasonable legal fees) arising from your use of Buffi, your
          violation of these Terms, or your violation of any third party rights.
        </p>

        <h2>11. EU Users</h2>
        <p>
          If you are located in the European Union or European Economic Area, you have additional rights under
          GDPR as described in our Privacy Policy. By using Buffi from the EU you acknowledge that your data will
          be processed in the United States in accordance with our Privacy Policy and applicable data transfer
          mechanisms.
        </p>
        <p>
          EU users may withdraw consent for non-essential data processing at any time by contacting{" "}
          <a href="mailto:heybuffi@gmail.com" className="marketing-link">
            heybuffi@gmail.com
          </a>
          . Withdrawal of consent does not affect the lawfulness of processing carried out before withdrawal.
        </p>

        <h2>12. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of North Carolina, United States, without regard to
          conflict of law principles. EU users retain any mandatory consumer protection rights granted by EU law
          that cannot be waived by contract. Any disputes arising from these Terms shall be resolved in the courts
          of North Carolina, except where EU law requires otherwise.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify registered users of material changes via
          email at least 14 days before they take effect. Continued use of Buffi after updated Terms take effect
          constitutes acceptance.
        </p>

        <h2>14. Termination</h2>
        <p>
          You may stop using Buffi at any time and request account deletion by contacting{" "}
          <a href="mailto:heybuffi@gmail.com" className="marketing-link">
            heybuffi@gmail.com
          </a>
          . We may suspend or terminate your access at any time for violation of these Terms. Upon termination
          your right to use Buffi ends immediately. Sections 6, 7, 9, 10, and 11 survive termination.
        </p>

        <h2>15. Contact</h2>
        <p>
          Questions about these Terms? Contact us at:
          <br />
          Buffi
          <br />
          <a href="mailto:heybuffi@gmail.com" className="marketing-link">
            heybuffi@gmail.com
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
