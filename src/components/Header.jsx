"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Settings } from "lucide-react";

export default function Header() {
  const pathname = usePathname();

  // TODO: Replace with actual user data from auth context
  const firstName = "User";

  const isActive = (path) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/invoices", label: "Invoices" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto h-16 max-w-7xl px-4 lg:px-6">
        <div className="grid h-full grid-cols-3 items-center gap-4">
          {/* Left: Logo */}
          <div className="flex items-center justify-start">
            <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
              <Image
                src="/logo.svg"
                alt="Nudge"
                width={120}
                height={38}
                priority
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Center: Navigation Links */}
          <nav className="flex items-center justify-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  rounded-md px-4 py-2 text-sm font-medium transition-colors
                  ${
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: Welcome Message + Settings */}
          <div className="flex items-center justify-end gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Welcome back, <span className="font-medium text-foreground">{firstName}</span>.
            </span>
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
