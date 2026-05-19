// src/components/Navbar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const links = [
    { href: '/request-service', label: 'Request Service' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/test-tools', label: 'Test Tools' },
  ]

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand" style={{ textDecoration: 'none' }}>PROWIDER</Link>
      <div className="nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${pathname === l.href ? ' active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
