'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import { Camera, QrCode, SmartphoneNfc, MapPin, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

import Link from 'next/link';

type Method = 'face' | 'qr' | 'nfc' | 'gps';

export default function CheckInKiosk() {
  const [method, setMethod] = useState<Method>('face');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const webcamRef = useRef<Webcam>(null);

  // Helper to handle completion states
  const showResult = (success: boolean, text: string) => {
    setStatus(success ? 'success' : 'error');
    setMessage(text);
    setLoading(false);
    setTimeout(() => setStatus('idle'), 4000);
  };

  // 1. AI Face Match
  const captureFace = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    
    setLoading(true);
    setStatus('idle');
    try {
      // Sent to our Gemini API for verification
      const res = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageSrc })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        showResult(true, `ស្កែនមុខជោគជ័យ! សួស្តី ${data.employeeName}`);
      } else {
        showResult(false, data.error || 'មិនអាចស្គាល់មុខបានទេ។ សូមព្យាយាមម្តងទៀត។');
      }
    } catch (e) {
      showResult(false, 'មានបញ្ហាប្រព័ន្ធ។ សូមព្យាយាមម្តងទៀត។');
    }
  }, [webcamRef]);

  // 2. QR Code
  useEffect(() => {
    if (method === 'qr') {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render((decodedText) => {
        setLoading(true);
        scanner.clear(); // Stop scanning once we get a logic
        // Simulate QR Validation
        setTimeout(() => {
          showResult(true, `QR ជោគជ័យ: ${decodedText}`);
        }, 1200);
      }, (err) => {
        // ignore scan errors (they happen every frame that lacks a QR)
      });
      
      return () => {
        scanner.clear().catch(e => console.log('Scanner exit'));
      };
    }
  }, [method]);

  // 3. NFC Web API
  const scanNfc = async () => {
    if (!('NDEFReader' in window)) {
      showResult(false, 'កម្មវិធីស្វែងរករបស់អ្នកមិនគាំទ្រ NFC ទេ។ (ត្រូវប្រើ Chrome នៅលើ Android)');
      return;
    }
    
    try {
      setLoading(true);
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      setMessage("កំពុងរង់ចាំការប៉ះ NFC...");
      
      ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
        showResult(true, `NFC ជោគជ័យ: ${serialNumber}`);
        // Typically call an API /api/nfc-check with serialNumber
      });
    } catch (error) {
      showResult(false, 'មានបញ្ហាក្នុងការស្កែន NFC។');
    }
  };

  // 4. GPS Geofence
  const getGps = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      showResult(false, 'ឧបករណ៍របស់អ្នកមិនគាំទ្រ GPS ទេ។');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      // Pretend target is (11.5564, 104.9282) - Phnom Penh
      showResult(true, `GPS ជោគជ័យ: Lat ${latitude.toFixed(2)}, Lng ${longitude.toFixed(2)}`);
    }, (err) => {
      showResult(false, 'មិនអាចភ្ជាប់ GPS បានទេ។ សូមបើក Location។');
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative bg-slate-50 text-slate-800">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="inline-flex items-center justify-center px-4 py-2 font-medium bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
          ← ត្រឡប់ក្រោយ
        </Link>
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8">
        
        {/* Sidebar Controls */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-indigo-950">ជម្រើស Check-In</h2>
          
          <button 
            onClick={() => setMethod('face')}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-medium ${method === 'face' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'}`}
          >
            <Camera className="w-5 h-5" /> ស្កែនមុខ (Face)
          </button>
          
          <button 
            onClick={() => setMethod('qr')}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-medium ${method === 'qr' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'}`}
          >
            <QrCode className="w-5 h-5" /> ប្រើ QR Code
          </button>

          <button 
            onClick={() => setMethod('nfc')}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-medium ${method === 'nfc' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'}`}
          >
            <SmartphoneNfc className="w-5 h-5" /> ប៉ះកាត NFC
          </button>

          <button 
            onClick={() => setMethod('gps')}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-medium ${method === 'gps' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'}`}
          >
            <MapPin className="w-5 h-5" /> Geofence (GPS)
          </button>
        </div>

        {/* Action Window */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden shadow-sm">
          
          <AnimatePresence mode="wait">
            {/* Status Overlay */}
            {status !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-md ${status === 'success' ? 'bg-emerald-50/90 text-emerald-700' : 'bg-red-50/90 text-red-700'}`}
              >
                {status === 'success' ? <CheckCircle2 className="w-24 h-24 mb-6" /> : <XCircle className="w-24 h-24 mb-6" />}
                <h3 className="text-2xl text-center font-bold leading-relaxed">{message}</h3>
              </motion.div>
            )}
            
            {/* Method Renderers */}
            <motion.div 
              key={method}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex-1 flex flex-col items-center justify-center"
            >
              {loading && status === 'idle' && (
                <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-600 rounded-3xl">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" />
                  <p className="text-lg animate-pulse font-medium">{message || 'កំពុងដំណើរការ...'}</p>
                </div>
              )}

              {method === 'face' && (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-8 border border-slate-200 shadow-sm relative">
                    <Webcam
                      ref={webcamRef}
                      mirrored
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-2xl pointer-events-none mix-blend-multiply"></div>
                  </div>
                  <button 
                    onClick={captureFace}
                    disabled={loading}
                    className="bg-indigo-800 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold transition-colors shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    ស្កែនឥឡូវនេះ (Scan Face)
                  </button>
                </div>
              )}

              {method === 'qr' && (
                <div className="w-full max-w-sm flex flex-col items-center bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">
                  <div id="reader" className="w-full text-slate-900"></div>
                </div>
              )}

              {method === 'nfc' && (
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center mb-8 bg-indigo-50">
                    <SmartphoneNfc className="w-16 h-16 text-indigo-500" />
                  </div>
                  <button 
                    onClick={scanNfc}
                    className="bg-indigo-800 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold transition-colors shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    ចាប់ផ្តើមស្កែនកាត NFC
                  </button>
                </div>
              )}

              {method === 'gps' && (
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center mb-8 bg-indigo-50 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 bg-indigo-200/50 rounded-full animate-ping"></div>
                    </div>
                    <MapPin className="w-16 h-16 text-indigo-500 relative z-10" />
                  </div>
                  <button 
                    onClick={getGps}
                    className="bg-indigo-800 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold transition-colors shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    ឆែកទីតាំងឥឡូវនេះ (Check Geofence)
                  </button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
