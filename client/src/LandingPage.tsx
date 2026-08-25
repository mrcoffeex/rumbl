import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, LayoutGrid, Link2, QrCode, Shuffle, Smartphone, Sparkles, UsersRound,
} from 'lucide-react'
import { useAuth } from './auth'
import { Brand, PublicFooter } from './components'
import './landing.css'

const DEMO_ROSTER = [
  { name: 'Amina', role: 'Programmer' },
  { name: 'Kenji', role: 'Programmer' },
  { name: 'Priya', role: 'Programmer' },
  { name: 'Jonah', role: 'UI/UX' },
  { name: 'Elena', role: 'UI/UX' },
  { name: 'Noah', role: 'UI/UX' },
  { name: 'Samira', role: 'Researcher' },
  { name: 'Luis', role: 'Researcher' },
  { name: 'Mei', role: 'Researcher' },
] as const

type DemoPerson = (typeof DEMO_ROSTER)[number]
type DemoGroup = { name: string; members: DemoPerson[] }

function shuffleList<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

function balancedGroups(): DemoGroup[] {
  const byRole: Record<string, DemoPerson[]> = {}
  for (const person of DEMO_ROSTER) {
    byRole[person.role] = shuffleList([...(byRole[person.role] ?? []), person])
  }
  const roles = Object.keys(byRole)
  const count = Math.min(...roles.map((role) => byRole[role]?.length ?? 0))
  return Array.from({ length: count }, (_, index) => ({
    name: `Group ${index + 1}`,
    members: roles.map((role) => byRole[role][index]).filter((member): member is DemoPerson => Boolean(member)),
  }))
}

function ShuffleDemo() {
  const [groups, setGroups] = useState<DemoGroup[] | null>(null)
  const [deal, setDeal] = useState(0)

  function shuffle() {
    setGroups(balancedGroups())
    setDeal((value) => value + 1)
  }

  return (
    <section className="landing-demo" aria-labelledby="demo-title">
      <div className="landing-demo-copy">
        <p className="eyebrow">Try it</p>
        <h2 id="demo-title">See a balanced shuffle</h2>
        <p>
          Nine people. Three roles. Rumbl does not pick names at random — it fills every group with the mix you designed.
        </p>
        <button type="button" className="button primary" onClick={shuffle}>
          <Shuffle size={17} /> {groups ? 'Shuffle again' : 'Shuffle into groups'}
        </button>
      </div>
      <div className="landing-demo-stage" aria-live="polite">
        {!groups ? (
          <ul className="landing-roster">
            {DEMO_ROSTER.map((person) => (
              <li key={person.name}>
                <span className="avatar small" aria-hidden="true">{person.name.slice(0, 1)}</span>
                <strong>{person.name}</strong>
                <em>{person.role}</em>
              </li>
            ))}
          </ul>
        ) : (
          <div className="landing-groups" key={deal}>
            {groups.map((group, index) => (
              <article className="card group-card landing-group" key={group.name} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="group-title">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{group.name}</h3>
                  <strong>{group.members.length}</strong>
                </div>
                <div className="group-members">
                  {group.members.map((member) => (
                    <div key={member.name}>
                      <div className="avatar small">{member.name.slice(0, 1)}</div>
                      <span>{member.name}</span>
                      <em>{member.role}</em>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function LandingPage() {
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const workspace = user?.role === 'admin' ? '/admin' : '/sessions'
  const primary = user
    ? { to: workspace, label: 'Open workspace' }
    : { to: '/register', label: 'Get started' }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">Skip to content</a>
      <header className={`landing-header${scrolled ? ' is-scrolled' : ''}`}>
        <Brand to="/" />
        <nav className="landing-nav" aria-label="Landing">
          <Link to="/docs">Docs</Link>
          <a className="landing-hash" href="#how">How it works</a>
          <a className="landing-hash" href="#who">Who it’s for</a>
          {!loading && (user ? <Link to={workspace}>Workspace</Link> : <Link to="/login">Sign in</Link>)}
          {!loading && <Link className="button primary" to={primary.to}>{primary.label} <ArrowRight size={16} /></Link>}
        </nav>
      </header>

      <main id="landing-main">
        <section className="landing-hero">
          <p className="eyebrow">Role-aware group generator</p>
          <h1>Fair teams in a few taps — not a spreadsheet scramble.</h1>
          <p className="landing-lead">
            Open a session, let people join as Programmer, Designer, Researcher, or whatever roles you need.
            When the room is ready, Rumbl shuffles them into groups that actually match the mix you planned.
          </p>
          <div className="landing-hero-actions">
            {!loading && <Link className="button primary" to={primary.to}>{primary.label} <ArrowRight size={17} /></Link>}
            <a className="button secondary" href="#how">See how it works</a>
          </div>
          <ul className="landing-proof">
            <li>No student accounts</li>
            <li>Share a link or QR</li>
            <li>Reshuffle anytime</li>
          </ul>
        </section>

        <ShuffleDemo />

        <section className="landing-section" id="how">
          <div className="landing-section-head">
            <p className="eyebrow">How it works</p>
            <h2>From empty room to balanced groups</h2>
            <p>Built for class kickoffs, workshops, and any session where the mix of skills matters.</p>
          </div>
          <ol className="landing-steps">
            <li>
              <span>01</span>
              <LayoutGrid size={22} aria-hidden="true" />
              <h3>Design the session</h3>
              <p>Set a title, group size, and the roles that belong in every team. Cap enrollment or leave it open.</p>
            </li>
            <li>
              <span>02</span>
              <QrCode size={22} aria-hidden="true" />
              <h3>Share the join page</h3>
              <p>Send a link or put the QR on the projector. People pick a unique name and the role they want.</p>
            </li>
            <li>
              <span>03</span>
              <UsersRound size={22} aria-hidden="true" />
              <h3>Watch the roster fill</h3>
              <p>Counts update live. Close enrollment when you are ready so late joins do not scramble the plan.</p>
            </li>
            <li>
              <span>04</span>
              <Shuffle size={22} aria-hidden="true" />
              <h3>Shuffle and share</h3>
              <p>One click builds balanced groups. Reshuffle if you need a new mix, then share the public results page.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section landing-features">
          <div className="landing-section-head">
            <p className="eyebrow">Why Rumbl</p>
            <h2>Made for the messy middle of grouping people</h2>
          </div>
          <div className="landing-feature-grid">
            <article>
              <Sparkles size={20} aria-hidden="true" />
              <h3>Roles, not random</h3>
              <p>Each group gets the seats you defined — one coder, one designer, one researcher — instead of a lucky draw.</p>
            </article>
            <article>
              <Link2 size={20} aria-hidden="true" />
              <h3>Join in seconds</h3>
              <p>Students never create an account. They open the link, type a name, pick a role, and they are in.</p>
            </article>
            <article>
              <Smartphone size={20} aria-hidden="true" />
              <h3>Phone-friendly room</h3>
              <p>The join page is built for a lecture hall of phones. Unique names stop duplicate sign-ups.</p>
            </article>
            <article>
              <LayoutGrid size={20} aria-hidden="true" />
              <h3>Results you can project</h3>
              <p>Share a clean results page so every team can find their people without you reading names aloud.</p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="who">
          <div className="landing-section-head">
            <p className="eyebrow">Who it’s for</p>
            <h2>Two sides of the same session</h2>
          </div>
          <div className="landing-split">
            <article className="card landing-audience">
              <p className="eyebrow">Organizers</p>
              <h3>Teachers, facilitators, team leads</h3>
              <p>Create sessions, track who joined, remove mistakes, and shuffle when the room is full enough — even before 100% capacity.</p>
              <ul>
                <li>Email, password, or Google sign-in</li>
                <li>Presets for studios, product teams, and discussions</li>
                <li>Live roster, search, and group results</li>
              </ul>
              <Link className="button primary" to={user ? workspace : '/register'}>
                {user ? 'Go to your sessions' : 'Create an account'} <ArrowRight size={16} />
              </Link>
            </article>
            <article className="card landing-audience">
              <p className="eyebrow">Participants</p>
              <h3>Students and attendees</h3>
              <p>No login. Scan the QR, choose a role with open seats, and wait for your organizer to share the groups.</p>
              <ul>
                <li>Join from any phone browser</li>
                <li>See remaining seats per role</li>
                <li>Find your group on the results link</li>
              </ul>
              <p className="landing-audience-note">If you were given a join link, open it directly — you do not need this homepage.</p>
            </article>
          </div>
        </section>

        <section className="landing-cta">
          <p className="eyebrow">Ready when you are</p>
          <h2>Next class, skip the grouping chaos.</h2>
          <p>Create a session in a minute, share the join page, and shuffle when the roster looks right.</p>
          <div className="landing-hero-actions">
            {!loading && <Link className="button primary" to={primary.to}>{primary.label} <ArrowRight size={17} /></Link>}
            {!loading && !user && <Link className="button secondary" to="/login">I already have an account</Link>}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
