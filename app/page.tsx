'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setTimeout(() => setCurrentTime(new Date()), 0);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans flex flex-col transition-colors duration-300">
      {/* Gradient Header */}
      <header className="h-20 bg-hero-gradient px-8 flex items-center justify-between shadow-brand shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-white">SecureAttend</h1>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-white bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm font-mono font-medium shadow-sm border border-white/20">
            {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: true }) : 'Loading...'}
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Greeting Hero */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4A3AFF 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-3xl flex flex-col items-center text-center relative z-10"
        >
          <div className="w-24 h-24 rounded-full bg-brand-primary/10 flex items-center justify-center mb-8 border-4 border-white dark:border-slate-900 shadow-soft">
            <span className="text-4xl font-bold text-brand-primary">SC</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-6 font-sans">
            សួស្តីបង
          </h2>
          
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-12 max-w-xl mx-auto">
            ស្វាគមន៏មកកាន់សាលារៀនសុវណ្ណភូមិទីតាំងទួលពង្រ។ តើថ្ងៃនេះលោកអ្នកចង់ធ្វើអ្វី?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl mx-auto">
            <Link href="/admin">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-700 hover:border-brand-primary/30 dark:hover:border-brand-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                  <Shield className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-brand-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg mb-1">ផ្ទាំងអ្នកគ្រប់គ្រង</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">ចូលទៅកាន់ផ្ទាំង Admin</p>
              </div>
            </Link>
            
            <Link href="/check-in">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-700 hover:border-brand-primary/30 dark:hover:border-brand-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                  <Shield className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-brand-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg mb-1">Check-In Kiosk</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">បើកម៉ាស៊ីនស្កែនវត្តមាន</p>
              </div>
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
