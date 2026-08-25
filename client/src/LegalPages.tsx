import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Brand, PublicFooter } from './components'
import './landing.css'

function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

function LegalLayout({
  title,
  heading,
  children,
}: {
  title: string
  heading: string
  children: ReactNode
}) {
  usePageTitle(title)

  return (
    <div className="landing">
      <header className="landing-header is-scrolled">
        <Brand to="/" />
        <nav className="landing-nav" aria-label="Legal">
          <Link to="/">Home</Link>
          <NavLink to="/docs">Docs</NavLink>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
        </nav>
      </header>
      <main id="landing-main" className="legal-main">
        <article className="legal-doc">
          <p className="eyebrow">Legal</p>
          <h1>{heading}</h1>
          <p className="legal-updated">Last updated August 25, 2026</p>
          {children}
        </article>
      </main>
      <PublicFooter />
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions — Rumbl" heading="Terms & Conditions">
      <p>
        These terms govern your use of Rumbl, a role-aware group generator for classrooms,
        workshops, and similar sessions. The person or organization that operates this
        website (“the operator”) provides the service. By creating an account, signing in,
        or using a join or results link, you agree to these terms.
      </p>

      <h2>1. The service</h2>
      <p>
        Rumbl lets organizers create sessions, define the roles that belong in each group,
        share a join link or QR code, collect participant names, and shuffle people into
        balanced groups. Participants do not need an account. Anyone with a public session
        link can join (when enrollment is open) or view published results.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Organizer accounts are for people who create and manage sessions. You must provide
        accurate information, keep your password confidential, and be at least 18 years old
        or have permission from a parent, guardian, or school to use an organizer account.
        You are responsible for activity on your account. Notify the operator if you believe
        it has been misused.
      </p>
      <p>
        The operator may create administrator accounts, suspend accounts, or remove content
        that violates these terms or puts other users at risk.
      </p>

      <h2>3. Sessions and participants</h2>
      <p>
        If you create a session, you are responsible for how you use it: the title, roles,
        expected headcount, who you invite, and when you open, close, or shuffle enrollment.
        Public join and results URLs work as capability links — anyone who has the URL can
        use that page. Do not share a link more widely than you intend.
      </p>
      <p>
        Participants should only join a session they were invited to, use a name the
        organizer can recognize, and pick a role in good faith. Do not submit other people’s
        names without permission, spam enrollments, or try to disrupt a session.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You may not use Rumbl to:</p>
      <ul>
        <li>Break the law, harass anyone, or collect data you are not allowed to collect</li>
        <li>Probe, scrape, overload, or interfere with the service or other users</li>
        <li>Bypass rate limits, authentication, or enrollment rules</li>
        <li>Pretend to be another person or misrepresent your affiliation</li>
        <li>Upload malicious code or attempt to access accounts or data that are not yours</li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You keep whatever rights you have in the names, titles, and other information you
        submit. You grant the operator a limited license to store and process that information
        solely to run Rumbl for you — for example, showing a roster, shuffling groups, and
        displaying public results you choose to share.
      </p>
      <p>
        Organizers may edit or delete their sessions. Removing a session deletes its
        participants and groups from that session. Account deletion requests should be sent
        to the operator of this site.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        Rumbl is provided as-is. The operator does not promise uninterrupted service,
        perfect grouping outcomes, or that a particular feature will remain available.
        Features, these terms, and the privacy policy may change. Continued use after a
        posted update means you accept the revised terms.
      </p>

      <h2>7. Disclaimers and liability</h2>
      <p>
        Grouping results are generated to match the roles and counts you configure; they are
        not a guarantee of fairness in every social or educational sense. To the fullest
        extent allowed by law, the operator is not liable for indirect, incidental, or
        consequential damages, or for lost data, missed class time, or decisions you make
        based on group assignments. If liability cannot be excluded, it is limited to
        fifty US dollars (or the equivalent) in aggregate.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms should go to the operator of this Rumbl site — typically
        the school, facilitator, or administrator who asked you to use it. If you deployed
        this instance yourself, you are the operator.
      </p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy — Rumbl" heading="Privacy Policy">
      <p>
        This policy describes how Rumbl handles information when you visit this site, create
        an organizer account, or join a session. The operator of this website decides how
        long data is kept and how to respond to access or deletion requests.
      </p>

      <h2>1. Who this covers</h2>
      <p>
        <strong>Organizers</strong> create accounts and run sessions.{' '}
        <strong>Participants</strong> join with a name and a role; they do not create an
        account. <strong>Visitors</strong> may load public pages such as the homepage, join
        links, and results links.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Organizer accounts</h3>
      <ul>
        <li>Name, email address, and a hashed password if you register with email</li>
        <li>A Google account identifier if you sign in with Google</li>
        <li>Your role on this site (user or administrator)</li>
        <li>Sessions you create, including titles, role definitions, and status</li>
      </ul>
      <h3>Participants</h3>
      <ul>
        <li>The display name and role you submit when joining a session</li>
        <li>The time you enrolled, so organizers can manage the roster</li>
      </ul>
      <p>
        Join pages do not ask participants for an email address, password, or phone number.
        Organizers should not put sensitive personal data in session titles or names.
      </p>
      <h3>Technical data</h3>
      <ul>
        <li>Request logs such as path, method, status, timing, and IP address</li>
        <li>Optional application logs tied to an account when you are signed in</li>
        <li>Password-reset tokens (stored as hashes) when you request a reset by email</li>
      </ul>

      <h2>3. Cookies</h2>
      <p>Rumbl uses a small number of first-party cookies:</p>
      <ul>
        <li>
          <strong>rumbl_auth</strong> — an HTTP-only session cookie so organizers stay signed
          in. It lasts about 12 hours, or 30 days if you choose “Remember me.”
        </li>
        <li>
          <strong>rumbl_device</strong> — an anonymous identifier on public join pages used
          only to limit how quickly someone can enroll again.
        </li>
      </ul>
      <p>
        These cookies are necessary for the service to work. The site does not use
        third-party advertising or analytics cookies.
      </p>

      <h2>4. How information is used</h2>
      <ul>
        <li>Create and authenticate organizer accounts, including Google sign-in</li>
        <li>Run sessions: enrollment, capacity, shuffling, and public results</li>
        <li>Send password-reset email if the operator has configured mail</li>
        <li>Protect the service (rate limits, abuse investigation, error diagnosis)</li>
        <li>Provide administrators with usage and health information for this instance</li>
      </ul>
      <p>Rumbl does not sell personal information or use it for advertising.</p>

      <h2>5. Public links</h2>
      <p>
        Join and results pages are reachable by anyone who has the unique session URL.
        Results show participant names and assigned groups after an organizer shuffles.
        Treat those links like invitations: only share them with people who should see
        that roster.
      </p>

      <h2>6. Sharing</h2>
      <p>Information is shared only as needed to operate Rumbl:</p>
      <ul>
        <li>With the organizer of a session (the roster and groups they manage)</li>
        <li>With people who open a public results link the organizer shared</li>
        <li>With Google, only to verify a Google sign-in token you start</li>
        <li>With an email provider, only to deliver a password-reset message</li>
        <li>If required by law, or to protect the operator, users, or the service</li>
      </ul>
      <p>
        Hosting, database, and similar infrastructure used by the operator may process data
        on the operator’s behalf.
      </p>

      <h2>7. Retention</h2>
      <p>
        Account and session data stay until the organizer or operator deletes them, or until
        the operator’s own retention rules say otherwise. Password-reset tokens expire.
        Request and system logs are kept to operate and secure the instance and may be
        removed on a rolling schedule by the operator.
      </p>

      <h2>8. Children and classrooms</h2>
      <p>
        Rumbl is built for teachers and facilitators. Participants may be students,
        including minors, who join with a first name or class name only. The organizer
        (for example a teacher or school) is responsible for having a lawful basis to
        collect those names and for how they share join and results links.
      </p>
      <p>
        Organizer accounts are intended for adults or for users who have school or parental
        permission. If you believe a child’s information was submitted inappropriately,
        contact the operator so it can be removed.
      </p>

      <h2>9. Your choices</h2>
      <ul>
        <li>Organizers can edit or delete sessions they own, which removes that roster</li>
        <li>You can sign out at any time; “Remember me” only extends the sign-in cookie</li>
        <li>You can request a copy, correction, or deletion of account data from the operator</li>
        <li>Participants should ask their organizer to fix or remove a name in a session</li>
      </ul>
      <p>
        Depending on where you live, you may have additional rights under local law. The
        operator of this instance is the party that can fulfill those requests.
      </p>

      <h2>10. Security</h2>
      <p>
        Passwords are stored as one-way hashes. Session cookies are HTTP-only and marked
        secure in production. No method of transmission or storage is perfectly secure;
        please use a strong password and share session links carefully.
      </p>

      <h2>11. Changes</h2>
      <p>
        This policy may be updated when the product or the law changes. The “Last updated”
        date at the top will change when that happens. Continued use after an update means
        you accept the revised policy.
      </p>

      <h2>12. Contact</h2>
      <p>
        Privacy questions and deletion requests should go to the operator of this Rumbl
        site. If you joined via a class or workshop link, start with the person who shared
        it. If you operate this instance, you are responsible for answering those requests.
      </p>
    </LegalLayout>
  )
}
