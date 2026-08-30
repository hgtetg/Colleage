import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  DoorOpen,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <Link className="marketing-logo" href="/">
          <span>CH</span>Campus Hub
        </Link>
        <div className="marketing-links">
          <a href="#platform">Platform</a>
          <a href="#roles">For students</a>
          <a href="#roles">For representatives</a>
        </div>
        <div className="marketing-actions">
          <Link className="marketing-signin" href="/signin">
            Sign in
          </Link>
          <Link className="marketing-cta small" href="/signup">
            Create account <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="marketing-kicker">
            <Sparkles size={13} />
            STUDENT-LED. COURSE-READY.
          </span>
          <h1>Everything your course needs, in one calm place.</h1>
          <p>
            Campus Hub keeps lectures, schedules, study rooms, announcements and
            student opportunities organized around your real course community.
          </p>
          <div className="hero-actions">
            <Link className="marketing-cta" href="/signup">
              Join your course <ArrowRight size={17} />
            </Link>
            <Link className="marketing-demo" href="/signin">
              Try a test account
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <ShieldCheck size={16} />
              Secure accounts
            </span>
            <span>
              <Users size={16} />
              Verified course access
            </span>
            <span>
              <Check size={16} />
              Persistent progress
            </span>
          </div>
        </div>
        <div className="product-window" aria-label="Campus Hub product preview">
          <div className="product-window-bar">
            <span />
            <span />
            <span />
            <b>Software Engineering · Section A</b>
          </div>
          <div className="product-window-body">
            <aside>
              <i>CH</i>
              {[BookOpen, CalendarDays, DoorOpen, MessageCircle].map(
                (Icon, index) => (
                  <span className={index === 0 ? 'active' : ''} key={index}>
                    <Icon size={17} />
                  </span>
                ),
              )}
            </aside>
            <section>
              <div className="preview-greeting">
                <small>GOOD MORNING, LAYLA</small>
                <strong>Your course is on track.</strong>
                <p>Here’s what needs your attention today.</p>
              </div>
              <div className="preview-stats">
                <article>
                  <small>ATTENDANCE</small>
                  <strong>92%</strong>
                  <i>
                    <b style={{ width: '92%' }} />
                  </i>
                </article>
                <article>
                  <small>NEXT CLASS</small>
                  <strong>10:00</strong>
                  <p>DSA · Room B12</p>
                </article>
                <article className="dark">
                  <small>JOIN CODE</small>
                  <strong>DSA2-K7Q1</strong>
                  <p>Active · 12 joins</p>
                </article>
              </div>
              <div className="preview-list">
                <div>
                  <span>30</span>
                  <p>
                    <strong>Discrete Mathematics</strong>
                    <small>09:00 · Hall 3</small>
                  </p>
                  <b>UPCOMING</b>
                </div>
                <div>
                  <span>31</span>
                  <p>
                    <strong>Operating Systems</strong>
                    <small>11:00 · Lab 2</small>
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
      <section className="marketing-proof">
        <p>Designed for the way university courses actually work</p>
        <div>
          <span>Course materials</span>
          <span>Live schedules</span>
          <span>Room booking</span>
          <span>Private community</span>
          <span>Applications</span>
        </div>
      </section>
      <section className="marketing-platform" id="platform">
        <div className="platform-heading">
          <span className="marketing-kicker">ONE CONNECTED WORKSPACE</span>
          <h2>Less searching. More learning.</h2>
          <p>
            Every tool has a clear home, and representatives manage information
            directly where students use it.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-primary">
            <span>
              <BookOpen size={23} />
            </span>
            <h3>Materials that stay in order</h3>
            <p>
              Lectures, files and progress live together by subject—no more
              hunting through message threads.
            </p>
            <div className="mini-subjects">
              <div>
                <b>DS</b>
                <span>
                  <strong>Data Structures</strong>
                  <small>7 of 8 complete</small>
                </span>
                <i>88%</i>
              </div>
              <div>
                <b>OS</b>
                <span>
                  <strong>Operating Systems</strong>
                  <small>2 of 5 complete</small>
                </span>
                <i>40%</i>
              </div>
            </div>
          </article>
          <article>
            <span>
              <CalendarDays size={23} />
            </span>
            <h3>A schedule you can trust</h3>
            <p>
              Course events, deadlines and room changes update in one shared
              calendar.
            </p>
          </article>
          <article>
            <span>
              <MessageCircle size={23} />
            </span>
            <h3>Your real classmates</h3>
            <p>
              A private feed for verified members, useful answers and
              representative announcements.
            </p>
          </article>
        </div>
      </section>
      <section className="role-section" id="roles">
        <div>
          <span className="marketing-kicker">FOR EVERY COURSE ROLE</span>
          <h2>One experience. The right controls.</h2>
        </div>
        <div className="role-cards">
          <article>
            <GraduationCapIcon />
            <span>STUDENT</span>
            <h3>Learn without the clutter</h3>
            <ul>
              <li>
                <Check />
                Track lecture progress
              </li>
              <li>
                <Check />
                Book study rooms
              </li>
              <li>
                <Check />
                Join course discussions
              </li>
              <li>
                <Check />
                Apply for opportunities
              </li>
            </ul>
            <Link href="/signup">
              Create student account <ArrowRight size={15} />
            </Link>
          </article>
          <article className="representative">
            <Users />
            <span>REPRESENTATIVE</span>
            <h3>Manage in context</h3>
            <ul>
              <li>
                <Check />
                Add and edit subjects
              </li>
              <li>
                <Check />
                Maintain schedules and rooms
              </li>
              <li>
                <Check />
                Publish and moderate updates
              </li>
              <li>
                <Check />
                Manage course access
              </li>
            </ul>
            <Link href="/signup">
              Create representative account <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      </section>
      <section className="marketing-visual">
        <Image
          src="/og.png"
          alt="Campus Hub course workspace overview"
          width={1200}
          height={630}
          priority={false}
        />
      </section>
      <section className="marketing-final">
        <span className="marketing-kicker">YOUR COURSE IS WAITING</span>
        <h2>Make this semester easier to navigate.</h2>
        <p>
          Create your account with the code from your course representative.
        </p>
        <div>
          <Link className="marketing-cta" href="/signup">
            Get started free <ArrowRight size={17} />
          </Link>
          <Link className="marketing-signin" href="/signin">
            I already have an account
          </Link>
        </div>
      </section>
      <footer>
        <Link className="marketing-logo inverse" href="/">
          <span>CH</span>Campus Hub
        </Link>
        <p>Student-led course organization, built with care.</p>
        <div>
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Create account</Link>
          <Link href="/admin">Administration</Link>
        </div>
      </footer>
    </main>
  );
}

function GraduationCapIcon() {
  return (
    <span className="role-icon">
      <BookOpen size={25} />
    </span>
  );
}
