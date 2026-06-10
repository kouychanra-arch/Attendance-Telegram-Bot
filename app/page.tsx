'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import Link from 'next/link';

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
    <main className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Gradient Header */}
      <header className="h-20 bg-hero-gradient px-8 flex items-center justify-between shadow-brand shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-white">SecureAttend</h1>
        </Link>
        <div className="text-white bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm font-mono font-medium shadow-sm border border-white/20">
          {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: true }) : 'Loading...'}
        </div>
      </header>

      {/* Greeting Hero */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4A3AFF 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-3xl flex flex-col items-center text-center relative z-10"
        >
          <div className="w-24 h-24 rounded-full bg-brand-primary/10 flex items-center justify-center mb-8 border-4 border-white shadow-soft">
            <span className="text-4xl font-bold text-brand-primary">SC</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-800 mb-6 font-sans">
            សួស្តីបង, <span className="text-transparent bg-clip-text bg-hero-gradient">សុខ ចាន់ដារ៉ា</span>
          </h2>
          
          <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-xl mx-auto">
            សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងវត្តមាន និងប្រាក់ខែ SecureAttend ។ តើថ្ងៃនេះលោកអ្នកចង់ធ្វើអ្វី?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl mx-auto">
            <Link href="/admin">
              <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 hover:border-brand-primary/30 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                  <Shield className="w-6 h-6 text-slate-600 group-hover:text-brand-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 text-lg mb-1">ផ្ទាំងអ្នកគ្រប់គ្រង</h3>
                <p className="text-sm text-slate-500">ចូលទៅកាន់ផ្ទាំង Admin</p>
              </div>
            </Link>
            
            <Link href="/check-in">
              <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 hover:border-brand-primary/30 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center group">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                  <Shield className="w-6 h-6 text-slate-600 group-hover:text-brand-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-800 text-lg mb-1">Check-In Kiosk</h3>
                <p className="text-sm text-slate-500">បើកម៉ាស៊ីនស្កែនវត្តមាន</p>
              </div>
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
