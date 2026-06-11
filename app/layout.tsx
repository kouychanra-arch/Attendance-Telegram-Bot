import type {Metadata} from 'next';
import { Kantumruy_Pro } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const kantumruyPro = Kantumruy_Pro({
  subsets: ['khmer', 'latin'],
  variable: '--font-kantumruy',
});

export const metadata: Metadata = {
  title: 'SecureAttend',
  description: 'Employee attendance + HR/payroll system with geofencing, AI face match, QR, and NFC.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={kantumruyPro.variable} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans antialiased text-slate-800 dark:text-slate-100 min-h-screen bg-slate-50 dark:bg-slate-900 selection:bg-indigo-500/30">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
