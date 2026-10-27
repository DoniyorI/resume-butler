// Sign-in pages are full-screen and have no app navigation
export default function AuthLayout({ children }) {
  return <main className="min-h-screen bg-white">{children}</main>;
}
