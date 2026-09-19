import React from 'react';
import { Key, Zap, Database, Globe, FolderDown, ShieldCheck } from 'lucide-react';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { classNames } from '~/utils/classNames';
import styles from './BaseChat.module.scss';

export const HomepageHero: React.FC = () => {
  return (
    <div id="intro" className={classNames(styles.HomepageHero, 'mt-[7vh] max-w-4xl mx-auto px-4 lg:px-0')}>
      <div className={styles.HomepageTopline}>
        <div className={styles.HomepageEyebrow}>
          <span className={styles.HomepageSpark}>✦</span>
          <span>Free & Open-Source Alternative to Lovable and v0</span>
        </div>
        <ThemeSwitch className={styles.HomepageThemeSwitch} />
      </div>
      <h1 className={styles.HomepageTitle}>Build Real Full-Stack Web Apps in Seconds with AI.</h1>
      <div className={styles.HomepageMeta}>
        <span><span className={styles.MetaDot} /> BYOK (Pay Direct Token Cost)</span>
        <span>•</span>
        <span>Instant Browser Runtime</span>
        <span>•</span>
        <span>Real PocketBase Database</span>
        <span>•</span>
        <span>1-Click Live Publish</span>
        <span>•</span>
        <span>100% Yours to Keep</span>
      </div>
    </div>
  );
};

export const HomepageDetails: React.FC = () => {
  return (
    <section className={styles.HomepageDetails} aria-label="PocketApp overview">
      <div className={styles.HomepageSectionIntro}>
        <span className={styles.SectionKicker}>OUR MISSION & ARCHITECTURE</span>
        <h2>Full-Stack Power. Zero Monthly Fees. Total Ownership.</h2>
        <p>
          PocketApp.dev is a free, open-source alternative to tools like Lovable and v0.
          You simply type what you want in plain words, and the AI builds a full working app:
          a clean React frontend connected to an embedded, real PocketBase database.
        </p>
      </div>

      <div className={styles.FeatureGrid}>
        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <Key className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>Direct Pricing</span>
          </div>
          <h3>Use Your Own AI Key (BYOK)</h3>
          <p>
            Connect your own cheap AI keys (like OpenRouter, Anthropic, OpenAI, DeepSeek, or Groq). You only pay for what you use, with no expensive monthly subscriptions.
          </p>
        </article>

        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <Zap className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>Browser-Native</span>
          </div>
          <h3>Instant Free Testing</h3>
          <p>
            Everything runs inside your web browser while you build, so it is fast and costs nothing to run. Zero cloud spin-up lag and instant hot-module reloading.
          </p>
        </article>

        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <Database className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>Real PocketBase</span>
          </div>
          <h3>Built-in Database Viewer</h3>
          <p>
            See your database tables, check your data, and test your app live without touching complex code. Real SQLite relations, authentication, and live APIs.
          </p>
        </article>

        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <Globe className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>1-Click Deploy</span>
          </div>
          <h3>One-Click Export</h3>
          <p>
            Bundle your frontend and PocketBase backend with Docker Compose in one click to run locally or deploy to any cloud VPS.
          </p>
        </article>

        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <FolderDown className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>No Lock-In</span>
          </div>
          <h3>100% Yours to Keep</h3>
          <p>
            Download the complete project files and SQLite database at any time and run them on your own computer or server forever. Clean, production-ready code.
          </p>
        </article>

        <article className={styles.FeatureCard}>
          <div className={styles.FeatureCardTop}>
            <div className={styles.FeatureIconBox}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className={styles.FeatureBadge}>Open Sovereign Web</span>
          </div>
          <h3>Total Creator Sovereignty</h3>
          <p>
            No hostaged code, no artificial credit quotas, and no platform paywalls. A tool that gives developers and creators full control over their code, their data, and their money.
          </p>
        </article>
      </div>

      <div className={styles.ComparisonSection}>
        <div className={styles.HomepageSectionIntro}>
          <span className={styles.SectionKicker}>THE OPEN-SOURCE ADVANTAGE</span>
          <h2>How PocketApp Compares</h2>
          <p>Experience the power of modern AI generation without the corporate subscription tax.</p>
        </div>
        <div className={styles.ComparisonCard}>
          <table className={styles.ComparisonTable}>
            <thead>
              <tr>
                <th>Capability</th>
                <th className={styles.ComparisonHighlight}>PocketApp.dev</th>
                <th>Proprietary Cloud Builders (Lovable, v0)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Platform Pricing</strong></td>
                <td className={styles.ComparisonHighlight}>100% Free & Open-Source</td>
                <td>$20 – $50 / month subscriptions</td>
              </tr>
              <tr>
                <td><strong>AI Generation Costs</strong></td>
                <td className={styles.ComparisonHighlight}>Direct BYOK Wholesale (Pennies / session)</td>
                <td>Expensive proprietary credit markups</td>
              </tr>
              <tr>
                <td><strong>Backend & Database</strong></td>
                <td className={styles.ComparisonHighlight}>Real Embedded PocketBase + SQLite</td>
                <td>Mock data or complex paid cloud add-ons</td>
              </tr>
              <tr>
                <td><strong>Code & Data Sovereignty</strong></td>
                <td className={styles.ComparisonHighlight}>Export full source code + DB in 1 click</td>
                <td>Restricted downloads or platform lock-in</td>
              </tr>
              <tr>
                <td><strong>Live Testing</strong></td>
                <td className={styles.ComparisonHighlight}>Zero-lag in-browser WebContainer</td>
                <td>Remote queue delays and build timeouts</td>
              </tr>
              <tr>
                <td><strong>Deployment & Self-Hosting</strong></td>
                <td className={styles.ComparisonHighlight}>Free vanity URLs + self-host anywhere</td>
                <td>Bound to closed cloud hosting tiers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.HowItWorks}>
        <div>
          <span>01</span>
          <strong>Tell AI What to Build</strong>
          <p>Describe your app in everyday plain words. The AI architects the React frontend UI and PocketBase data schemas.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Test & Inspect Live</strong>
          <p>Watch your app compile instantly in the browser. Inspect database tables and test live records in real time.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Export or Self-Host</strong>
          <p>Download the clean repo and SQLite DB in seconds to host anywhere on your terms with Docker, Vercel, or Netlify.</p>
        </div>
      </div>

      <div className={styles.MissionBanner}>
        <div className={styles.MissionBannerKicker}>OUR CORE PHILOSOPHY</div>
        <h3 className={styles.MissionBannerTitle}>Full control over your code, your data, and your money.</h3>
        <p className={styles.MissionBannerText}>
          Software creation should never be locked behind expensive monthly tolls. We engineered PocketApp.dev to democratize full-stack application development with absolute developer sovereignty—delivering professional-grade AI velocity with zero vendor lock-in.
        </p>
      </div>

      <div className={styles.FaqBlock}>
        <div className={styles.HomepageSectionIntro}>
          <span className={styles.SectionKicker}>FREQUENTLY ASKED QUESTIONS</span>
          <h2>Clear Answers to Common Questions</h2>
        </div>
        <details>
          <summary>How is PocketApp.dev free when other AI builders charge $20–$50/mo?</summary>
          <p>
            Traditional platforms rent you computing power and mark up AI models by 500% to support venture-backed overhead. PocketApp.dev runs the development and build process inside your browser (WebContainers) and lets you connect your own API keys directly. You pay only for the exact raw tokens you consume—saving up to 95%.
          </p>
        </details>
        <details>
          <summary>How does Bring Your Own Key (BYOK) work?</summary>
          <p>
            You enter your API key from providers such as OpenRouter, Anthropic, OpenAI, DeepSeek, or Groq in the model selector. Your keys are stored locally in your browser and synced to your private account. All AI requests go directly to the provider without middlemen markups.
          </p>
        </details>
        <details>
          <summary>What kind of database does PocketApp create?</summary>
          <p>
            Every application is paired with PocketBase, a modern, ultra-fast SQLite backend with user authentication, file uploads, and real-time subscriptions. You can view your tables, check data, and verify functionality directly inside the embedded database viewer.
          </p>
        </details>
        <details>
          <summary>Can I download my project files and run them on my own server?</summary>
          <p>
            Yes, 100%. You can download the complete project zip or push it directly to GitHub at any time. The project uses standard React, Vite, and PocketBase with zero proprietary runtime dependencies. Run it on your laptop, Docker, or any Linux VPS forever.
          </p>
        </details>
        <details>
          <summary>How do I deploy my exported application?</summary>
          <p>
            When you are ready to ship, click &quot;Export App&quot;. PocketApp bundles your application with a ready-to-run Docker Compose configuration that includes the React frontend and isolated PocketBase backend.
          </p>
        </details>
      </div>

      <footer className={styles.HomepageFooter}>
        <span>© {new Date().getFullYear()} PocketApp.dev — Open-Source Full-Stack AI Studio</span>
        <span>Built for full creator sovereignty.</span>
      </footer>
    </section>
  );
};
