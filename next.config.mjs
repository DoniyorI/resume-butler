const isDev = process.env.NODE_ENV !== "production";

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const supabaseRealtime = supabaseOrigin.replace(/^https:/, "wss:");

// Next.js App Router injects inline scripts, so script-src needs 'unsafe-inline'
// until we move to nonce-based CSP. The other directives still block framing,
// plugins, base-tag hijacking and connections to unknown hosts.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseRealtime} https://api.emailjs.com`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabaseOrigin}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf2json", "imap", "mailparser"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The master CV moved into the profile page
  async redirects() {
    return [
      { source: "/cv", destination: "/profile", permanent: true },
      { source: "/profile/new", destination: "/profile", permanent: false },
    ];
  },
};

export default nextConfig;
