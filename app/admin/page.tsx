'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Building2, Receipt, Clock, Settings, MonitorPlay, Shield, Bell } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'employees' | 'payroll' | 'reports'>('dashboard');

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#4A3AFF] text-white flex flex-col shrink-0">
        <div className="p-6 pb-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-wide">SecureAttend</h1>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 flex flex-col gap-1.5">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white/10 font-medium' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'dashboard' ? 'bg-white' : 'border border-white/70'}`}></div>
            ផ្ទាំងគ្រប់គ្រង
          </button>
          
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'attendance' ? 'bg-white/10 font-medium' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'attendance' ? 'bg-white' : 'border border-white/70'}`}></div>
            វត្តមានបុគ្គលិក
          </button>

          <button 
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'employees' ? 'bg-white/10 font-medium' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'employees' ? 'bg-white' : 'border border-white/70'}`}></div>
            បញ្ជីឈ្មោះបុគ្គលិក
          </button>
          
          <button 
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'payroll' ? 'bg-white/10 font-medium' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'payroll' ? 'bg-white' : 'border border-white/70'}`}></div>
            បើកប្រាក់បៀវត្សរ៍
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-white/10 font-medium' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'reports' ? 'bg-white' : 'border border-white/70'}`}></div>
            របាយការណ៍
          </button>
        </nav>
        
        <div className="p-4 mt-auto">
          <Link href="/check-in" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-sm opacity-80 hover:opacity-100">
            <MonitorPlay className="w-4 h-4" /> Kiosk Mode
          </Link>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all w-full text-left text-sm opacity-80 hover:opacity-100">
            <Settings className="w-4 h-4" /> ការកំណត់
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white px-8 flex items-center justify-between border-b border-slate-100 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800">ទិដ្ឋភាពទូទៅថ្ងៃនេះ</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
              ប្រព័ន្ធដំណើរការធម្មតា
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-px h-6 bg-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-semibold text-slate-700">សុខ ចាន់ដារ៉ា</span>
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-100">
                SC
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="w-full max-w-6xl mx-auto"
          >
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Stats Cards */}
                <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col justify-between">
                  <span className="text-slate-500 text-sm font-medium mb-4">បុគ្គលិកសរុប</span>
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-bold text-slate-800">1,240</span>
                    <span className="text-emerald-500 text-sm font-semibold">+4 ថ្មី</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col justify-between">
                  <span className="text-slate-500 text-sm font-medium mb-4">វត្តមានថ្ងៃនេះ</span>
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-bold text-[#4A3AFF]">1,185</span>
                    <span className="text-slate-400 text-sm">95.5% នៃសរុប</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col justify-between">
                  <span className="text-slate-500 text-sm font-medium mb-4">មកយឺត</span>
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-bold text-orange-500">42</span>
                    <span className="text-orange-500 text-sm font-medium">-12% ធៀបខែមុន</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                  <span className="text-slate-500 text-sm font-medium mb-4 ml-2">អវត្តមាន</span>
                  <div className="flex items-end justify-between ml-2">
                    <span className="text-4xl font-bold text-red-600">13</span>
                    <span className="text-slate-400 text-sm">គ្មានច្បាប់</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-800">បុគ្គលិកទាំងអស់</h2>
                  <button className="bg-[#4A3AFF] hover:bg-[#3D2DE0] text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                    + បន្ថែមបុគ្គលិកថ្មី
                  </button>
                </div>
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ឈ្មោះបុគ្គលិក</th>
                      <th className="px-6 py-4 font-semibold">Telegram ID</th>
                      <th className="px-6 py-4 font-semibold">ប្រាក់ខែគោល</th>
                      <th className="px-6 py-4 font-semibold">ស្ថានភាព</th>
                      <th className="px-6 py-4 font-semibold text-right">សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[1,2,3].map(i => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-500 text-xs">
                            {i}
                          </div>
                          <span className="font-semibold text-slate-800">បុគ្គលិក គំរូទី {i}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">@demo_tg_{i}</td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-700">$15.00</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">សកម្ម</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-[#4A3AFF] hover:text-[#3D2DE0] font-medium text-sm">កែប្រែ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'attendance' && (
               <div className="bg-white border border-slate-200 rounded-2xl min-h-[400px] flex flex-col items-center justify-center shadow-sm">
                 <Clock className="w-16 h-16 mb-4 text-slate-200" />
                 <p className="font-medium text-lg text-slate-600">កំណត់ត្រាវត្តមាននឹងបង្ហាញនៅទីនេះ</p>
                 <p className="text-sm text-slate-400 mt-2">សូមរង់ចាំបុគ្គលិកឆែកចូល</p>
               </div>
            )}

            {activeTab === 'payroll' && (
               <div className="bg-white border border-slate-200 rounded-2xl min-h-[400px] flex flex-col items-center justify-center shadow-sm">
                 <Receipt className="w-16 h-16 mb-4 text-slate-200" />
                 <p className="font-medium text-lg text-slate-600">មិនទាន់មានទិន្នន័យប្រាក់ខែទេ</p>
               </div>
            )}
            
            {activeTab === 'reports' && (
               <div className="bg-white border border-slate-200 rounded-2xl min-h-[400px] flex flex-col items-center justify-center shadow-sm">
                 <p className="font-medium text-lg text-slate-600">របាយការណ៍សរុប</p>
               </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
