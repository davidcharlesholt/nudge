"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Settings, Menu } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { getWorkspace } from "@/lib/workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [workspace, setWorkspace] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadWorkspace() {
      if (isLoaded && user) {
        const ws = await getWorkspace();
        setWorkspace(ws);
      }
    }
    loadWorkspace();
  }, [isLoaded, user]);

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

  // Check if user is signed in
  const isSignedIn = isLoaded && user;
  const workspaceName = workspace?.workspaceName || null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto h-16 max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-full items-center justify-between gap-2 sm:gap-4">
          {/* Left: Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
              <Image
                src="/logo.svg"
                alt="Nudge"
                width={120}
                height={38}
                priority
                className="h-7 w-auto sm:h-8"
              />
            </Link>
          </div>

          {/* Center: Navigation Links - Hidden on mobile, shown on md+ */}
          <nav className="hidden md:flex items-center justify-center gap-1 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  rounded-md px-3 lg:px-4 py-2 text-sm font-medium transition-colors
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

          {/* Right: Workspace Name + Menu/Settings + User Button */}
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {isSignedIn ? (
              <>
                {workspaceName && (
                  <span className="hidden lg:inline text-sm font-medium text-foreground max-w-[120px] truncate">
                    {workspaceName}
                  </span>
                )}
                
                {/* Mobile Navigation Menu */}
                <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <DropdownMenuTrigger
                    className="md:hidden flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                    title="Menu"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[200px] bg-card text-foreground border-border md:hidden"
                  >
                    {navLinks.map((link) => (
                      <DropdownMenuItem key={link.href} asChild className="hover:bg-muted">
                        <Link
                          href={link.href}
                          className="cursor-pointer"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="hover:bg-muted">
                      <Link
                        href="/settings/account"
                        className="cursor-pointer"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Account & Login
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-muted">
                      <Link
                        href="/settings/business"
                        className="cursor-pointer"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Business Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Desktop Settings Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="hidden md:flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                    title="Settings"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[200px] bg-card text-foreground border-border"
                  >
                    <DropdownMenuItem asChild className="hover:bg-muted">
                      <Link
                        href="/settings/account"
                        className="cursor-pointer"
                      >
                        Account & Login
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-muted">
                      <Link
                        href="/settings/business"
                        className="cursor-pointer"
                      >
                        Business Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-9 w-9",
                      userButtonPopoverCard: "shadow-lg border border-border",
                    },
                  }}
                />
              </>
            ) : (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Welcome to Nudge
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
