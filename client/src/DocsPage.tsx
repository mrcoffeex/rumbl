import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from './auth'
import { Brand, PublicFooter, StatusBadge } from './components'
import './landing.css'

const SECTIONS = [
  { id: 'start', label: 'Getting started' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'sessions', label: 'Create a session' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'status', label: 'Session status' },
  { id: 'shuffle', label: 'Shuffle' },
  { id: 'results', label: 'Results' },
  { id: 'admins', label: 'Administrators' },
  { id: 'faq', label: 'FAQ' },
] as const

export function DocsPage() {
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const workspace = user?.role === 'admin' ? '/admin' : '/sessions'
  const primary = user
    ? { to: workspace, label: 'Open workspace' }
    : { to: '/register', label: 'Get started' }

  useEffect(() => {
    const previous = document.title
    document.title = 'Docs — Rumbl'
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing docs">
      <a className="skip-link" href="#docs-main">Skip to content</a>
      <header className={`landing-header${scrolled ? ' is-scrolled' : ''}`}>
        <Brand to="/" />
        <nav className="landing-nav" aria-label="Documentation">
          <Link to="/">Home</Link>
          <NavLink to="/docs">Docs</NavLink>
          {!loading && (user ? <Link to={workspace}>Workspace</Link> : <Link to="/login">Sign in</Link>)}
          {!loading && <Link className="button primary" to={primary.to}>{primary.label} <ArrowRight size={16} /></Link>}
        </nav>
      </header>

      <div className="docs-hero">
        <p className="eyebrow">Documentation</p>
        <h1>How Rumbl puts people into groups</h1>
        <p className="landing-lead">
          Organizers design the mix of roles, share a join page, then shuffle when the room is ready.
          Participants never need an account.
        </p>
      </div>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>{section.label}</a>
          ))}
        </nav>

        <article id="docs-main" className="docs-article">
          <section id="start">
            <h2>Getting started</h2>
            <p>
              Rumbl is for classrooms, workshops, and any session where the mix of skills matters.
              You create a session, people join from a phone, and one shuffle builds groups that match the seats you designed.
            </p>
            <ol className="docs-steps">
              <li>Create an organizer account and a new session.</li>
              <li>Open enrollment and share the link or QR code.</li>
              <li>Watch the roster fill, then close enrollment.</li>
              <li>Shuffle into groups and share the public results page.</li>
            </ol>
          </section>

          <section id="accounts">
            <h2>Accounts</h2>
            <p>
              Only organizers sign in. Participants open a join link and never create an account.
              Sign up with email and a password of at least 8 characters, or with Google if your administrator has enabled it.
            </p>
            <ul>
              <li>Users can create, run, and shuffle their own sessions.</li>
              <li>Admins also get a dashboard, user management, and a list of every group on the platform.</li>
              <li>Password reset is for email accounts only, not Google sign-in.</li>
              <li>Use Remember me on a trusted device so you stay signed in longer.</li>
            </ul>
          </section>

          <section id="sessions">
            <h2>Create a session</h2>
            <p>
              From Groups, start a new session. Give it a title people will recognize on the join page,
              then decide how large each group should be and which roles belong in it.
            </p>
            <h3>Participant limit</h3>
            <p>
              Cap how many people can join, or leave enrollment open. A limit must cover at least one full group.
              Role capacities are derived from that limit, so popular roles fill first instead of overflowing.
            </p>
            <h3>Roles</h3>
            <p>
              Role seats must add up to the group size. For example, a group of three with one Programmer,
              one UI/UX, and one Researcher uses every seat. Presets for software studio, product team,
              discussion, and pairs are a starting point — rename or add roles to match your room.
            </p>
            <p>
              Draft sessions can still be edited. Once enrollment opens, the design is locked so the join page stays consistent.
            </p>
          </section>

          <section id="enrollment">
            <h2>Enrollment</h2>
            <p>
              Open enrollment from the session page, then share the join link or download the QR code for a projector.
              The roster refreshes live as people join.
            </p>
            <ul>
              <li>Each person enters a unique name and picks a role with remaining seats.</li>
              <li>Full roles disappear from the join form until someone is removed or more capacity exists.</li>
              <li>If the session is full, closed, or already shuffled, the join page explains why and can link to results.</li>
              <li>Organizers can search the roster and remove a mistaken signup. After a shuffle, you may need to reshuffle.</li>
            </ul>
          </section>

          <section id="status">
            <h2>Session status</h2>
            <p>Every session moves through a short lifecycle. Controls change with the status.</p>
            <div className="docs-status-list">
              <div>
                <StatusBadge status="draft" />
                <p>Designed but not accepting joins yet. This is the only status you can still edit or delete.</p>
              </div>
              <div>
                <StatusBadge status="open" />
                <p>People can join. Close enrollment before you shuffle so late arrivals do not change the plan mid-deal.</p>
              </div>
              <div>
                <StatusBadge status="closed" />
                <p>Joins are paused. Shuffle when the roster looks right — you do not have to wait for 100% capacity.</p>
              </div>
              <div>
                <StatusBadge status="grouped" />
                <p>Groups exist. Share the public results page, or reshuffle for a new random mix. Reopening enrollment clears groups.</p>
              </div>
            </div>
          </section>

          <section id="shuffle">
            <h2>Shuffle</h2>
            <p>
              Shuffle fills every required role seat first, then spreads people as evenly as possible.
              It is not a lucky draw of names — each group gets the mix you configured.
            </p>
            <p>
              Rumbl creates as many groups as it needs for the people who actually joined.
              The last group may be smaller than the others when the count does not divide evenly.
              Reshuffle replaces the current assignments with a new random arrangement of the same roster.
            </p>
            <div className="docs-callout">
              <p className="eyebrow">Example</p>
              <p>
                Forty students with one coder, one designer, and one researcher per group become fourteen groups
                of at most three. The final group can be incomplete.
              </p>
            </div>
          </section>

          <section id="results">
            <h2>Results</h2>
            <p>
              After a shuffle, copy the public results link or preview it from the session page.
              Anyone with the link can see the groups — no sign-in required.
              The join page also offers that link once groups are ready.
            </p>
            <p>
              Keep the results URL for the projector or a chat channel. If you reshuffle, the same link updates
              with the new groups.
            </p>
          </section>

          <section id="admins">
            <h2>Administrators</h2>
            <p>
              Admins see Dashboard, All groups, and Users in the header. Those tools are for the platform,
              not for taking over someone else’s session.
            </p>
            <ul>
              <li>Dashboard summarizes traffic, signups, session status, and recent logs.</li>
              <li>Users lets you invite organizers, change roles, and remove accounts. You cannot delete or demote yourself, and the last admin cannot be removed.</li>
              <li>All groups lists every session. You can open and manage only the groups you created. Other owners’ rows are visible, not editable.</li>
            </ul>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            <dl className="docs-faq">
              <div>
                <dt>Someone joined with the wrong role or a typo.</dt>
                <dd>Remove them from the roster. They can join again while enrollment is open. If groups already exist, reshuffle after the change.</dd>
              </div>
              <div>
                <dt>The shuffle button is disabled.</dt>
                <dd>Close enrollment first, and make sure at least one participant has joined.</dd>
              </div>
              <div>
                <dt>A role on the join page says Full.</dt>
                <dd>That role has used its seats for the participant limit you set. People can pick another role, or you can remove someone to free a seat.</dd>
              </div>
              <div>
                <dt>I am an admin and cannot change another teacher’s groups.</dt>
                <dd>That is intentional. Platform admins can see every session, but only the owner can open, close, shuffle, or edit it.</dd>
              </div>
              <div>
                <dt>Do participants need this documentation?</dt>
                <dd>Usually not. Give them the join link. If groups are already shuffled, send the results link instead.</dd>
              </div>
            </dl>
          </section>
        </article>
      </div>

      <PublicFooter />
    </div>
  )
}
