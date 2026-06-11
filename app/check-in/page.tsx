'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import { 
  Camera, QrCode, SmartphoneNfc, MapPin, CheckCircle2, XCircle, 
  Loader2, Compass, Navigation, Key, Shield, User, LogOut, Check, AlertCircle
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { getSupabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false }
);

type Method = 'face' | 'qr' | 'nfc' | 'gps';

export default function CheckInKiosk() {
  const [method, setMethod] = useState<Method>('face');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const webcamRef = useRef<Webcam>(null);

  // States
  const [employees, setEmployees] = useState<any[]>([]);
  const [enrolledEmployeeIds, setEnrolledEmployeeIds] = useState<Set<string>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secureattend_active_employee');
      if (saved) {
        try {
          return JSON.parse(saved).id || '';
        } catch (e) {
          return '';
        }
      }
    }
    return '';
  });
  const [activeEmployee, setActiveEmployee] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secureattend_active_employee');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  const [activationCodeInput, setActivationCodeInput] = useState<string>('');

  // Self Face Enrollment states (for active employee)
  const [isEnrollingFace, setIsEnrollingFace] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState('');

  // Load Active Employee & All Employees on mount
  useEffect(() => {
    const savedActiveEmp = typeof window !== 'undefined' ? localStorage.getItem('secureattend_active_employee') : null;
    
    // 2. Fetch employees (both Supabase & falls back to local cache)
    const loadEmployeesAndRecords = async () => {
      let emps: any[] = [];
      const supabase = getSupabase() as any;
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('full_name', { ascending: true });
          if (!error && data) {
            emps = data;
          }
        } catch (err) {
          console.warn("Supabase fetch employees failed, falling back to local:", err);
        }
      }

      const localEmpsRaw = localStorage.getItem('secureattend_employees');
      const localEmployees = localEmpsRaw ? JSON.parse(localEmpsRaw) : [];

      if (emps.length === 0 && localEmployees.length === 0) {
        // Build initial seed templates if completely empty
        const initialSeeds = [
          { id: 'emp-uuid-sok-chanra', employee_code: 'EMP001', full_name: 'សុខ ចាន់ដារ៉ា', department: 'IT', telegram_id: '@sok_chanra', active: true, base_salary_per_hour: 15, created_at: new Date().toISOString() },
          { id: 'emp-uuid-keo-pich', employee_code: 'EMP002', full_name: 'កែវ ពេជ្រ', department: 'HR', telegram_id: '@keo_pich', active: true, base_salary_per_hour: 18, created_at: new Date().toISOString() },
          { id: 'emp-uuid-chhim-sopheak', employee_code: 'EMP003', full_name: 'ឈឹម សុភ័ក្ត្រ', department: 'Finance', telegram_id: '@chhim_sopheak', active: true, base_salary_per_hour: 20, created_at: new Date().toISOString() }
        ];
        localStorage.setItem('secureattend_employees', JSON.stringify(initialSeeds));
        emps = initialSeeds;
      } else {
        const merged = [...emps];
        for (const le of localEmployees) {
          if (!merged.some(se => se.id === le.id)) {
            merged.push(le);
          }
        }
        emps = merged;
      }
      setEmployees(emps);

      // Verify if currently active employee is still in list and active
      if (savedActiveEmp) {
        try {
          const parsed = JSON.parse(savedActiveEmp);
          const currentInList = emps.find(e => e.id === parsed.id);
          if (currentInList) {
            if (currentInList.active === false) {
              // Deactivated by Admin!
              localStorage.removeItem('secureattend_active_employee');
              setTimeout(() => {
                setActiveEmployee(null);
                setSelectedEmployeeId('');
              }, 0);
            } else {
              // Update state with fresher profile data
              setTimeout(() => {
                setActiveEmployee(currentInList);
                setSelectedEmployeeId(currentInList.id);
              }, 0);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Fetch Face enrollments status
      let enrolledSet = new Set<string>();
      if (supabase) {
        try {
          const { data: fe, error } = await supabase.from('face_enrollments').select('employee_id');
          if (!error && fe) {
            fe.forEach((item: any) => enrolledSet.add(item.employee_id));
          }
        } catch (e) {}
      }
      const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
      if (localEnrollmentsRaw) {
        try {
          const localFE = JSON.parse(localEnrollmentsRaw);
          localFE.forEach((item: any) => enrolledSet.add(item.employeeId));
        } catch (e) {}
      }
      setEnrolledEmployeeIds(enrolledSet);
    };

    loadEmployeesAndRecords();
  }, []);

  // Auto-link telegram_id when the app opens inside Telegram Mini App
  useEffect(() => {
    if (typeof window !== 'undefined' && activeEmployee) {
      const tg = (window as any).Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      
      if (tgUser && tgUser.id) {
        const tgIdStr = tgUser.id.toString();
        // If employee is not linked or has a different ID, update it
        if (activeEmployee.telegram_id !== tgIdStr) {
          console.log(`Telegram WebApp user detected: Auto-linking ${tgUser.first_name} (ID: ${tgIdStr}) to ${activeEmployee.full_name}`);
          
          const supabase = getSupabase() as any;
          if (supabase) {
            supabase
              .from('employees')
              .update({ telegram_id: tgIdStr })
              .eq('id', activeEmployee.id)
              .then(({ error }: any) => {
                if (!error) {
                  // Successfully updated, update local states
                  const updatedEmployee = { ...activeEmployee, telegram_id: tgIdStr };
                  localStorage.setItem('secureattend_active_employee', JSON.stringify(updatedEmployee));
                  setActiveEmployee(updatedEmployee);
                  
                  // Keep employees state updated as well
                  setEmployees((prev: any[]) => 
                    prev.map(emp => emp.id === activeEmployee.id ? { ...emp, telegram_id: tgIdStr } : emp)
                  );
                } else {
                  console.error("Auto-linking failed on Supabase:", error);
                }
              });
          }
        }
      }
    }
  }, [activeEmployee]);

  // Helper to handle completion states
  const showResult = useCallback((success: boolean, text: string) => {
    setStatus(success ? 'success' : 'error');
    setMessage(text);
    setLoading(false);
    setTimeout(() => setStatus('idle'), 4000);
  }, []);

  // Face API States
  const [faceapi, setFaceapi] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load faceapi client-side dynamically when Face method is selected OR when enrolling face
  useEffect(() => {
    if ((method === 'face' || isEnrollingFace) && !faceapi) {
      import('@vladmandic/face-api').then((api) => {
        setFaceapi(api);
      });
    }
  }, [method, isEnrollingFace, faceapi]);

  // Load weights
  useEffect(() => {
    if (!faceapi || modelsLoaded || loadingModels) return;

    const loadModels = async () => {
      try {
        setLoadingModels(true);
        setMessage('កំពុងទាញយកម៉ូដែល AI ទម្រង់មុខ (Loading AI face models)...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
        setMessage('');
      } catch (err) {
        console.error("Error loading faceapi weights:", err);
        showResult(false, "មិនអាចទាញយកម៉ូដែល AI ទម្រង់មុខបានទេ។ (Failed to load AI face models)");
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [faceapi, modelsLoaded, loadingModels, showResult]);

  // GPS Geofence States
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinZone, setIsWithinZone] = useState<boolean>(false);
  const [gpsFetched, setGpsFetched] = useState<boolean>(false);
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Office & Geofence Coordinates loaded from Admin settings with fallback defaults
  const [OFFICE_LAT, setOfficeLat] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secureattend_office_lat');
      return saved ? parseFloat(saved) : 11.5305;
    }
    return 11.5305;
  });

  const [OFFICE_LNG, setOfficeLng] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secureattend_office_lng');
      return saved ? parseFloat(saved) : 104.8620;
    }
    return 104.8620;
  });

  const [ZONE_RADIUS, setZoneRadius] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secureattend_office_radius');
      return saved ? parseInt(saved, 10) : 150;
    }
    return 150;
  });

  // Haversine formula to compute distance in meters
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const getGps = useCallback((mockCoords?: { lat: number; lng: number }) => {
    setLoading(true);
    setStatus('idle');

    if (mockCoords) {
      setTimeout(() => {
        const dist = getHaversineDistance(OFFICE_LAT, OFFICE_LNG, mockCoords.lat, mockCoords.lng);
        setUserCoords(mockCoords);
        setDistance(dist);
        setIsWithinZone(dist <= ZONE_RADIUS);
        setGpsFetched(true);
        setLoading(false);
      }, 500);
      return;
    }

    if (!navigator.geolocation) {
      showResult(false, 'ឧបករណ៍របស់អ្នកមិនគាំទ្រ GPS ទេ។');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getHaversineDistance(OFFICE_LAT, OFFICE_LNG, latitude, longitude);
        setUserCoords({ lat: latitude, lng: longitude });
        setDistance(dist);
        setIsWithinZone(dist <= ZONE_RADIUS);
        setGpsFetched(true);
        setLoading(false);
      },
      (err) => {
        showResult(false, 'មិនអាចភ្ជាប់ GPS បានទេ។ សូមបើក Location ឬសាកល្បង Mock Location។');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showResult, OFFICE_LAT, OFFICE_LNG, ZONE_RADIUS]);

  // Map Synchronization Effect
  useEffect(() => {
    if (method !== 'gps' || !mapContainerRef.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let activeMap: any = null;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Reset previous map reference to avoid container re-initialization errors
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([OFFICE_LAT, OFFICE_LNG], 16);

      mapRef.current = map;
      activeMap = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Office icon
      const officeHtml = `
        <div class="flex items-center justify-center w-10 h-10 bg-[#4A3AFF] text-white rounded-full border-2 border-white font-semibold shadow-md text-xl">
          🏫
        </div>
      `;
      const officeIcon = L.divIcon({
        className: 'custom-leaflet-icon-office',
        html: officeHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      L.marker([OFFICE_LAT, OFFICE_LNG], { icon: officeIcon })
        .addTo(map)
        .bindPopup('<b class="text-indigo-950 font-bold font-sans">សាលារៀនសុវណ្ណភូមិ (ទួលពង្រ)</b><br><span class="text-xs text-slate-500 font-sans">ទីតាំងការិយាល័យ - Geofence</span>')
        .openPopup();

      // Zone Radius Circle
      L.circle([OFFICE_LAT, OFFICE_LNG], {
        color: '#4A3AFF',
        fillColor: '#4A3AFF',
        fillOpacity: 0.12,
        radius: ZONE_RADIUS,
        weight: 1.5
      }).addTo(map);

      // User location marker
      if (userCoords) {
        const userHtml = `
          <div class="flex items-center justify-center w-10 h-10 bg-emerald-500 text-white rounded-full border-2 border-white font-semibold shadow-md text-lg animate-bounce">
            👤
          </div>
        `;
        const userIcon = L.divIcon({
          className: 'custom-leaflet-icon-user',
          html: userHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<b class="text-emerald-700 font-bold font-sans">អ្នកនៅត្រង់នេះ</b>')
          .openPopup();

        // Fit boundaries to accommodate both office & user
        const bounds = L.latLngBounds([
          [OFFICE_LAT, OFFICE_LNG],
          [userCoords.lat, userCoords.lng]
        ]);
        map.fitBounds(bounds.pad(0.25));
      }
    }).catch((err) => {
      console.error('Error rendering Leaflet Map:', err);
    });

    return () => {
      isMounted = false;
      if (activeMap) {
        activeMap.remove();
        mapRef.current = null;
      }
    };
  }, [method, userCoords, OFFICE_LAT, OFFICE_LNG, ZONE_RADIUS]);

  // Attendance Logger Helper - Keys log by employee_code & server timestamp
  const logCheckIn = useCallback(async (employeeId: string, employeeName: string, checkInMethod: string, type: 'check-in' | 'check-out' = 'check-in') => {
    // Find the correct employee_code
    const emp = employees.find(e => e.id === employeeId);
    const employeeCode = emp?.employee_code || 'EMP' + Math.floor(100 + Math.random() * 900);

    const nowIso = new Date().toISOString();
    const attendanceRecord = {
      id: 'att-' + Math.random().toString(36).substring(2, 11),
      employee_id: employeeId,
      employee_code: employeeCode,
      employee_name: employeeName,
      check_in_time: nowIso,
      method: checkInMethod,
      status: 'present',
      type: type
    };

    // Save to Supabase
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
        let tenantId = tenants?.[0]?.id;
        
        if (tenantId) {
          if (type === 'check-out') {
            await supabase.from('attendance').insert({
              tenant_id: tenantId,
              employee_id: employeeId,
              employee_code: employeeCode,
              check_in_time: nowIso,
              check_out_time: nowIso,
              method: checkInMethod,
              status: 'present'
            });
          } else {
            await supabase.from('attendance').insert({
              tenant_id: tenantId,
              employee_id: employeeId,
              employee_code: employeeCode,
              check_in_time: nowIso,
              method: checkInMethod,
              status: 'present'
            });
          }
        }
      } catch (err) {
        console.warn("Could not save attendance log to Supabase:", err);
      }
    }

    // Save to LocalStorage
    const localAttendanceRaw = localStorage.getItem('secureattend_attendance');
    const localAttendance = localAttendanceRaw ? JSON.parse(localAttendanceRaw) : [];
    localAttendance.unshift(attendanceRecord);
    localStorage.setItem('secureattend_attendance', JSON.stringify(localAttendance));

    // Send Telegram Notification
    fetch('/api/bot/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        employeeName,
        method: checkInMethod,
        timestamp: nowIso,
        type
      })
    }).catch(err => console.warn("Failed sending Telegram notification:", err));
  }, [employees]);

  // Device / Employee Activation
  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    const code = activationCodeInput.trim().toUpperCase();
    if (!code) return;

    const found = employees.find(emp => emp.employee_code?.toUpperCase() === code);

    if (!found) {
      alert(`រកមិនឃើញអត្តលេខបុគ្គលិក "${code}" ទេ! (Employee ID "${code}" not found!)`);
      return;
    }

    if (found.active === false) {
      alert("គណនីបុគ្គលិកនេះត្រូវបានផ្អាកសកម្មភាពដោយអ្នកគ្រប់គ្រង! (This employee account is deactivated!)");
      return;
    }

    localStorage.setItem('secureattend_active_employee', JSON.stringify(found));
    setActiveEmployee(found);
    setSelectedEmployeeId(found.id);
    setActivationCodeInput('');
  };

  const handleDeactivate = () => {
    localStorage.removeItem('secureattend_active_employee');
    setActiveEmployee(null);
    setSelectedEmployeeId('');
  };

  // Self-Service Face Enrollment
  const enrollActiveEmployeeFace = async () => {
    if (!faceapi || !webcamRef.current || !activeEmployee) return;

    setEnrollStatus('scanning');
    setEnrollMessage('កំពុងស្កែន និងវិភាគទម្រង់មុខ (Scanning and mapping facial keypoints)...');

    try {
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) {
        setEnrollStatus('error');
        setEnrollMessage('បរាជ័យក្នុងការចាប់ទិន្នន័យកាមេរ៉ា (Webcam feed capture failed).');
        return;
      }

      // 1. Load screenshot image
      const img = new Image();
      img.src = screenshot;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // 2. Perform landmark extraction and descriptor mapping
      const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setEnrollStatus('error');
        setEnrollMessage('រកមិនឃើញទម្រង់មុខទេ! សូមឈរចំពីមុខកាមេរ៉ាក្នុងពន្លឺច្បាស់លាស់។ (No face detected)');
        return;
      }

      const descriptorArray = Array.from(detection.descriptor);

      // 3. Upsert to Supabase
      const supabase = getSupabase() as any;
      if (supabase) {
        try {
          await supabase.from('face_enrollments').upsert({
            employee_id: activeEmployee.id,
            descriptor: descriptorArray
          });
        } catch (dbErr) {
          console.warn("Could not save vector descriptor in Supabase Cloud:", dbErr);
        }
      }

      // 4. Save inside Local Cache fallback database
      const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
      const localEnrollments = localEnrollmentsRaw ? JSON.parse(localEnrollmentsRaw) : [];
      // Clean previous representation
      const filteredEnrollments = localEnrollments.filter((item: any) => item.employeeId !== activeEmployee.id);
      filteredEnrollments.push({
        employeeId: activeEmployee.id,
        employeeName: activeEmployee.full_name,
        descriptor: descriptorArray,
        enrolled_at: new Date().toISOString()
      });
      localStorage.setItem('secureattend_face_enrollments', JSON.stringify(filteredEnrollments));

      // Update local set state
      setEnrolledEmployeeIds(prev => {
        const next = new Set(prev);
        next.add(activeEmployee.id);
        return next;
      });

      setEnrollStatus('success');
      setEnrollMessage('ការចុះឈ្មោះស្កែនមុខទទួលបានជោគជ័យ! (Face Enrollment Successful!)');
      
      // Close automatically
      setTimeout(() => {
        setIsEnrollingFace(false);
        setEnrollStatus('idle');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setEnrollStatus('error');
      setEnrollMessage('មានបញ្ហាក្នុងការចងចាំទម្រង់មុខ៖ ' + err.message);
    }
  };

  // 1. AI Face Match (Auto-recognize ANY person and log attendance)
  const captureFace = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    
    // Ensure models are loaded
    if (!modelsLoaded || !faceapi) {
      showResult(false, 'សូមរង់ចាំឲ្យម៉ូដែល AI ដំណើរការសិន (Please wait for face models to load).');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setMessage('កំពុងវិភាគទម្រង់មុខរបស់អ្នក... (Analyzing face...)');

    try {
      // 1. Convert screenshot to HTML Image Element
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // 2. Compute 128-d descriptor in the browser
      const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        showResult(false, 'រកមិនឃើញទម្រង់មុខទេ! សូមសម្លឹងចំកាមេរ៉ាក្នុងកន្លែងមានពន្លឺគ្រប់គ្រាន់។');
        return;
      }

      const descriptorArray = Array.from(detection.descriptor);

      // Get local enrollments to pass as fallback
      const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
      const localEnrollments = localEnrollmentsRaw ? JSON.parse(localEnrollmentsRaw) : [];

      // 3. Post to API for matching
      const res = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          descriptor: descriptorArray,
          localEnrollments: localEnrollments
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Find matching employee by returned employeeId
        const matchEmp = employees.find(e => e.id === data.employeeId);
        if (matchEmp && matchEmp.active === false) {
          showResult(false, `គណនីរបស់បង ${data.employeeName} ត្រូវបានផ្អាកសកម្មភាព!`);
          return;
        }

        // Save check-in log!
        await logCheckIn(data.employeeId, data.employeeName, 'face');
        showResult(true, `ស្កែនមុខជោគជ័យ! សួស្តីបង ${data.employeeName} ⏱️ ចុះវត្តមានរួចរាល់។`);
      } else {
        showResult(false, data.error || 'មិនស្គាល់ទម្រង់មុខនេះទេ! សូមប្រាកដថាបានចុះឈ្មោះមុខក្នុងប្រព័ន្ធ។');
      }
    } catch (e: any) {
      console.error(e);
      showResult(false, 'មានបញ្ហាប្រព័ន្ធក្នុងការស្កែន។ សូមព្យាយាមម្តងទៀត។');
    }
  }, [webcamRef, faceapi, modelsLoaded, employees, showResult, logCheckIn]);

  // 2. QR Code Scanner
  const handleQrScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const scannedSecret = typeof detectedCodes[0] === 'object' ? detectedCodes[0]?.rawValue : detectedCodes[0];
    if (!scannedSecret) return;

    if (!selectedEmployeeId) {
      showResult(false, 'សូមជ្រើសរើសឈ្មោះបុគ្គលិកជាមុនសិន หรือធ្វើសកម្មភាពគណនីបង!');
      return;
    }

    if (loading) return;

    setLoading(true);
    setStatus('idle');
    setMessage('កំពុងផ្ទៀងផ្ទាត់ QR Code... (Validating QR Code...)');

    try {
      const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
      const res = await fetch('/api/qr-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: scannedSecret,
          employeeId: selectedEmployeeId,
          employeeName: selectedEmp?.full_name || 'បុគ្គលិក'
        })
      });
      const data = await res.json();

      if (data.success) {
        await logCheckIn(selectedEmployeeId, selectedEmp?.full_name || 'បុគ្គលិក', 'qr');
        showResult(true, `ស្កែន QR ជោគជ័យ! សួស្តីបង ${selectedEmp?.full_name} ⏱️ ចុះវត្តមានរួចរាល់។`);
      } else {
        showResult(false, data.error || 'QR Code មិនត្រឹមត្រូវ ឬហួសសុពលភាព! (Invalid or expired QR)');
      }
    } catch (err) {
      console.error(err);
      showResult(false, 'មានបញ្ហាប្រព័ន្ធក្នុងការស្កែន QR។');
    }
  };

  // 3. NFC Reader scan
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
      
      ndef.addEventListener("reading", ({ message: nfcMsg, serialNumber }: any) => {
        if (!selectedEmployeeId) {
          showResult(false, 'រកមិនឃើញគណនីកម្មវិធីទេ។');
          return;
        }
        const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
        logCheckIn(selectedEmployeeId, selectedEmp?.full_name || 'បុគ្គលិក', 'nfc');
        showResult(true, `ស្កែនកាត NFC ជោគជ័យ! អត្តសញ្ញាណប័ណ្ណបង៖ ${selectedEmp?.full_name} (${serialNumber})`);
      });
    } catch (error) {
      showResult(false, 'មានបញ្ហាក្នុងការស្កែន NFC។');
    }
  };

  // 4. GPS Check-In / Check-Out
  const handleCheckIn = () => {
    if (!selectedEmployeeId) {
      showResult(false, 'សូមធ្វើសកម្មភាពគណនីបងជាមុនសិន។');
      return;
    }
    setLoading(true);
    setStatus('idle');
    const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
    setTimeout(async () => {
      await logCheckIn(selectedEmployeeId, selectedEmp?.full_name || 'បុគ្គលិក', 'gps');
      showResult(true, `វត្តមានចូលធ្វើការ (Check IN) សម្រាប់ ${selectedEmp?.full_name || 'បុគ្គលិក'} ត្រូវបានកត់ត្រាដោយជោគជ័យ! រីករាយការងារថ្ងៃនេះបង។ ⏱️ ម៉ោង ` + new Date().toLocaleTimeString('en-US', { hour12: true }));
    }, 1200);
  };

  const handleCheckOut = () => {
    if (!selectedEmployeeId) {
      showResult(false, 'សូមធ្វើសកម្មភាពគណនីបងជាមុនសិន។');
      return;
    }
    setLoading(true);
    setStatus('idle');
    const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
    setTimeout(async () => {
      await logCheckIn(selectedEmployeeId, selectedEmp?.full_name || 'បុគ្គលិក', 'gps', 'check-out');
      showResult(true, `វត្តមានចេញពីធ្វើការ (Check OUT) សម្រាប់ ${selectedEmp?.full_name || 'បុគ្គលិក'} ត្រូវបានកត់ត្រាដោយជោគជ័យ! ធ្វើដំណើរត្រឡប់ដោយសុវត្ថិភាពបង។ 🏡 ម៉ោង ` + new Date().toLocaleTimeString('en-US', { hour12: true }));
    }, 1200);
  };

  // 1. Render Activation screen if no active employee exists
  if (!activeEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
        <div className="absolute top-6 left-6 z-10">
          <Link href="/" className="inline-flex items-center justify-center px-4 py-2 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            ← ត្រឡប់ទៅទំព័រដើម
          </Link>
        </div>
        <div className="absolute top-6 right-6 z-10">
          <ThemeToggle />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-800 rounded-3xl p-8 shadow-large z-0"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100/50 dark:border-indigo-900/40">
              <Shield className="w-8 h-8 text-[#4A3AFF]" />
            </div>
            <h2 className="text-2xl font-black text-slate-850 dark:text-slate-100 font-sans">ធ្វើសកម្មភាពគណនី (Device Activation)</h2>
            <p className="text-sm text-slate-450 dark:text-slate-400 mt-2 font-sans">
              សូមវាយបញ្ចូលលេខអត្តសម្គាល់បុគ្គលិក (Employee ID) ដើម្បីធ្វើសកម្មភាពទូរស័ព្ទ/រន្ធស្កែនវត្តមានបុគ្គលិក។
            </p>
          </div>

          <form onSubmit={handleActivate} className="flex flex-col gap-4 font-sans text-left">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-extrabold text-slate-550 dark:text-slate-350">អត្តសម្គាល់បុគ្គលិក (Employee ID) *</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  placeholder="ឧ. EMP001"
                  value={activationCodeInput}
                  onChange={(e) => setActivationCodeInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 p-3.5 pl-11 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3AFF] uppercase font-bold text-slate-800 dark:text-slate-100"
                />
                <Key className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button 
              type="submit"
              className="bg-[#4A3AFF] hover:bg-[#3D2DE0] text-white py-4 rounded-2xl font-black text-center transition-all shadow-md shadow-indigo-600/10 cursor-pointer mt-2"
            >
              ធ្វើសកម្មភាពឥឡូវនេះ (Activate)
            </button>
          </form>

          {/* Guidelines / Helper Mock List */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-750 font-sans">
            <span className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider text-center">
              លេខកូដសាកល្បងដែលមានស្រាប់ (Demo Seeding Accounts):
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setActivationCodeInput(emp.employee_code || '')}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 hover:border-[#4A3AFF] hover:bg-indigo-50/20 active:scale-95 transition-all text-ellipsis overflow-hidden ${emp.active === false ? 'opacity-40 line-through' : ''}`}
                  title={`${emp.full_name} (${emp.active === false ? 'Inactive' : 'Active'})`}
                >
                  <span className="font-bold text-[#4A3AFF] block font-mono">{emp.employee_code || "N/A"}</span>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                    {emp.full_name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Render Check-in Layout once activeEmployee IS set
  const isActiveEmployeeEnrolled = enrolledEmployeeIds.has(activeEmployee.id);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="inline-flex items-center justify-center px-4 py-2 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          ← ត្រឡប់ទៅទំព័រដើម
        </Link>
      </div>
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 mt-12 lg:mt-0">
        
        {/* Sidebar Employee Details & Actions */}
        <div className="flex flex-col gap-6">
          
          {/* Employee Active Profile Information Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#4A3AFF]/10 text-[#4A3AFF] rounded-2xl flex items-center justify-center font-bold text-lg border border-[#4A3AFF]/20">
                <User className="w-6 h-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xxs font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-wider uppercase">
                  {activeEmployee.employee_code}
                </span>
                <span className="font-black text-slate-805 dark:text-slate-100 font-sans text-base">
                  {activeEmployee.full_name}
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            <div className="flex flex-col gap-2.5 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-slate-450 dark:text-slate-400">ផ្នែកការងារ (Dept):</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{activeEmployee.department || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450 dark:text-slate-400">Telegram ID:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{activeEmployee.telegram_id || '-'}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-slate-450 dark:text-slate-400">កាមេរ៉ាស្កែនមុខ AI:</span>
                {isActiveEmployeeEnrolled ? (
                  <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                    <Check className="w-3 h-3" /> រួចរាល់
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-500/20 animate-pulse">
                    <AlertCircle className="w-3 h-3" /> មិនទាន់ចុះមុខ
                  </span>
                )}
              </div>
            </div>

            {/* Face Self-Enrollment Control */}
            <div className="mt-2">
              <button
                onClick={() => {
                  setIsEnrollingFace(true);
                  setEnrollStatus('idle');
                  setEnrollMessage('');
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                  isActiveEmployeeEnrolled
                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-650 dark:text-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-750 text-white border-transparent shadow-sm hover:scale-[1.01]'
                }`}
              >
                <Camera className="w-4 h-4" />
                {isActiveEmployeeEnrolled ? 'ផ្ទៀងផ្ទាត់/ចុះឈ្មោះមុខថ្មី' : 'ចុះឈ្មោះស្កែនមុខ (Face Enrollment)'}
              </button>
            </div>

            {/* Logout/Switch account */}
            <button 
              onClick={handleDeactivate}
              className="mt-1 w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/35 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              បិទសកម្មភាពឧបករណ៍ (Logout)
            </button>
          </div>

          {/* Attendance Check-in Method Navigation */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 flex flex-col gap-3.5 shadow-sm text-left">
            <h3 className="text-base font-extrabold mb-1 text-slate-800 dark:text-slate-105">តើបងចង់ចុះវត្តមានដោយរបៀបណា?</h3>
            
            <button 
              onClick={() => {
                setMethod('face');
                setIsEnrollingFace(false);
              }}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-sm font-bold text-left cursor-pointer ${method === 'face' && !isEnrollingFace ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}
            >
              <Camera className="w-4.5 h-4.5" /> ស្កែនមុខ (AI Face Match)
            </button>
            
            <button 
              onClick={() => {
                setMethod('qr');
                setIsEnrollingFace(false);
              }}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-sm font-bold text-left cursor-pointer ${method === 'qr' && !isEnrollingFace ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}
            >
              <QrCode className="w-4.5 h-4.5" /> ស្កែនកូដ QR សាលា
            </button>

            <button 
              onClick={() => {
                setMethod('nfc');
                setIsEnrollingFace(false);
              }}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-sm font-bold text-left cursor-pointer ${method === 'nfc' && !isEnrollingFace ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}
            >
              <SmartphoneNfc className="w-4.5 h-4.5" /> ប៉ះកាតការងារ NFC
            </button>

            <button 
              onClick={() => {
                setMethod('gps');
                setIsEnrollingFace(false);
              }}
              className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-sm font-bold text-left cursor-pointer ${method === 'gps' && !isEnrollingFace ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}
            >
              <MapPin className="w-4.5 h-4.5" /> ផែនទី Geofence (GPS)
            </button>
          </div>
        </div>

        {/* Action Window Panel */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden shadow-sm">
          
          {/* Web UI Feedback notifications inside check-in */}
          <AnimatePresence mode="wait">
            {status !== 'idle' && !isEnrollingFace && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-8 backdrop-blur-md ${status === 'success' ? 'bg-emerald-50/95 dark:bg-emerald-950/98 text-emerald-700 dark:text-emerald-300 font-sans' : 'bg-red-50/95 dark:bg-red-950/98 text-red-700 dark:text-red-300 font-sans'}`}
              >
                {status === 'success' ? <CheckCircle2 className="w-24 h-24 mb-6 text-emerald-500" /> : <XCircle className="w-24 h-24 mb-6 text-red-500" />}
                <h2 className="text-2xl text-center font-black leading-relaxed">{message}</h2>
              </motion.div>
            )}

            {/* RENDER ACTIVE FACE ENROLLMENT VIEW */}
            {isEnrollingFace ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-center mb-6 max-w-sm">
                  <h3 className="text-xl font-black text-indigo-950 dark:text-indigo-200">ចុះឈ្មោះស្កែនមុខបុគ្គលិក</h3>
                  <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                    សូមសម្លឹងចំកាមេរ៉ាឲ្យឃើញទម្រង់មុខច្បាស់ល្អ រួចចុចប៊ូតុងចុះឈ្មោះដើម្បីចងចាំទម្រង់មុខ (Landmark Mapping)។
                  </p>
                </div>

                <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 mb-6 border border-slate-200 dark:border-slate-700 shadow-sm relative">
                  <Webcam
                    ref={webcamRef}
                    mirrored
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-[#4A3AFF]/30 animate-pulse rounded-2xl pointer-events-none"></div>
                </div>

                {enrollStatus === 'scanning' ? (
                  <div className="flex flex-col items-center gap-2 mb-4 text-[#4A3AFF] animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs text-center font-bold">{enrollMessage}</span>
                  </div>
                ) : enrollStatus === 'success' ? (
                  <div className="flex flex-col items-center gap-2 mb-4 text-emerald-505 font-bold">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <span className="text-xs text-center">{enrollMessage}</span>
                  </div>
                ) : enrollStatus === 'error' ? (
                  <div className="flex flex-col items-center gap-2 mb-4 text-rose-500 font-bold max-w-sm">
                    <AlertCircle className="w-10 h-10" />
                    <span className="text-xs text-center">{enrollMessage}</span>
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <button
                    onClick={enrollActiveEmployeeFace}
                    disabled={enrollStatus === 'scanning'}
                    className="bg-[#4A3AFF] hover:bg-[#3D2DE0] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm cursor-pointer"
                  >
                    ថតរូបចុះឈ្មោះ (Capture & Enroll)
                  </button>
                  <button
                    onClick={() => {
                      setIsEnrollingFace(false);
                      setEnrollStatus('idle');
                    }}
                    className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-100 px-5 py-3 rounded-xl font-bold transition-all text-sm cursor-pointer"
                  >
                    បោះបង់
                  </button>
                </div>
              </motion.div>
            ) : (
              /* STANDARD CHECK-IN METHODS */
              <motion.div 
                key={method}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex-1 flex flex-col items-center justify-center"
              >
                {loading && status === 'idle' && (
                  <div className="absolute inset-0 z-40 bg-white/80 dark:bg-slate-850/90 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 rounded-3xl">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="text-lg animate-pulse font-medium">{message || 'កំពុងដំណើរការ...'}</p>
                  </div>
                )}

                {method === 'face' && (
                  <div className="flex flex-col items-center">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-black text-slate-805 dark:text-slate-100">ស្កែនទម្រង់មុខ (AI Face Match Entry)</h3>
                      <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                        កម្មវិធីស្គាល់ទម្រង់មុខស្វ័យប្រវត្តិតាមរយៈ AI Landmark និងកត់ត្រាវត្តមានភ្លាមៗ។
                      </p>
                    </div>

                    <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 mb-8 border border-slate-200 dark:border-slate-700 shadow-sm relative">
                      <Webcam
                        ref={webcamRef}
                        mirrored
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/50 rounded-2xl pointer-events-none mix-blend-multiplyFixed select-none"></div>
                    </div>
                    <button 
                      onClick={captureFace}
                      disabled={loading}
                      className="bg-indigo-650 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-base cursor-pointer"
                    >
                      ស្កែនមុខឥឡូវនេះ (Scan Face Match)
                    </button>
                  </div>
                )}

                {method === 'qr' && (
                  <div className="w-full max-w-sm flex flex-col items-stretch bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl shadow-sm font-sans gap-4">
                    <div className="text-center">
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">ស្កែនកូដ QR សាលារៀន (Office QR Scan)</h3>
                      <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                        សូមយកទូរស័ព្ទមកស្កែនកូដ QR របស់ការិយាល័យដែលបង្កើតដោយ Admin។
                      </p>
                    </div>

                    <div className="w-full flex flex-col items-stretch gap-3">
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-inner relative">
                        <QrScanner
                          onScan={handleQrScan}
                          onError={(err) => console.log('QR Scanner Error:', err)}
                        />
                      </div>
                      <div className="text-center text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse mt-1">
                        📷 កំពុងបើកកាមេរ៉ាស្កែន... (Camera active...)
                      </div>
                    </div>
                  </div>
                )}

                {method === 'nfc' && (
                  <div className="flex flex-col items-center">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-105">ប៉ះកាតបុគ្គលិក NFC</h3>
                      <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                        ប្រើប្រាស់កាតបុគ្គលិកដែលមានឈីប NFC ដើម្បីចុះវត្តមានទូចភ្លាមៗ (Chrome in Android)។
                      </p>
                    </div>

                    <div className="w-48 h-48 rounded-full border border-dashed border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-8 bg-indigo-50/50 dark:bg-slate-900">
                      <SmartphoneNfc className="w-16 h-16 text-indigo-500 animate-pulse" />
                    </div>
                    <button 
                      onClick={scanNfc}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg hover:scale-[1.01] active:scale-95 cursor-pointer"
                    >
                      ចាប់ផ្ដើមទូចកាត NFC (Scan NFC Card)
                    </button>
                  </div>
                )}

                {method === 'gps' && (
                  <div className="w-full flex flex-col items-stretch text-left">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100 font-sans">ផែនទី Geofence នៃសាលារៀន</h3>
                        <p className="text-xs text-slate-450 dark:text-slate-400 font-sans">សាខាទួលពង្រ - រង្វង់សុវត្ថិភាព {ZONE_RADIUS} ម៉ែត្រ</p>
                      </div>
                      {gpsFetched && (
                        <button 
                          onClick={() => getGps()}
                          title="ធ្វើបច្ចុប្បន្នភាពទីតាំង"
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Compass className="w-5 h-5 animate-pulse" />
                        </button>
                      )}
                    </div>

                    {/* Leaflet Map Target Div */}
                    <div ref={mapContainerRef} className="w-full h-[280px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-inner mb-4 relative z-0"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
                      {/* Location Info Box */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 flex flex-col justify-center text-left">
                        <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold mb-1 font-sans uppercase">ស្ថានភាពទីតាំងបច្ចុប្បន្ន</span>
                        {gpsFetched ? (
                          <div className="flex flex-col gap-1 font-sans text-left">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                              <span>ចម្ងាយ៖ {distance !== null ? `${distance.toFixed(1)} ម៉ែត្រ` : 'កំពុងគណនា'}</span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              ទីតាំង៖ {userCoords ? `${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}` : '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">សូមស្វែងរកទីតាំងរបស់អ្នក ដើម្បីផ្ទៀងផ្ទាត់</span>
                        )}
                      </div>

                      {/* Geofence Status Badge Box */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 flex items-center">
                        {!gpsFetched ? (
                          <div className="flex items-center gap-2 text-slate-500 font-sans">
                            <Compass className="w-5 h-5 text-indigo-400 animate-spin" />
                            <span className="text-xs font-semibold">រង់ចាំទាញយកទីតាំង...</span>
                          </div>
                        ) : isWithinZone ? (
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-sans">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-bold">នៅក្នុងតំបន់អនុញ្ញាត</span>
                              <span className="text-[10px] text-slate-400">អ្នកអាចចុះវត្តមានបាន</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-650 dark:text-red-400 font-sans">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-bold">ស្ថិតនៅក្រៅតំបន់អនុញ្ញាត</span>
                              <span className="text-[10px] text-slate-400 font-sans">ត្រូវស្ថិតក្នុងរយៈចម្ងាយ {ZONE_RADIUS}ម</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Main Action Buttons: Check IN / Check OUT */}
                    <div className="grid grid-cols-2 gap-4 mb-6 font-sans">
                      <button
                        onClick={handleCheckIn}
                        disabled={!gpsFetched || !isWithinZone || loading}
                        className={`py-3.5 px-6 rounded-2xl font-black font-sans text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          gpsFetched && isWithinZone && !loading
                            ? 'bg-[#4A3AFF] hover:bg-[#3D2DE0] text-white shadow-md active:scale-[0.98]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Navigation className="w-4 h-4 transform rotate-45" />
                        វត្តមាន ចូល (Check IN)
                      </button>

                      <button
                        onClick={handleCheckOut}
                        disabled={!gpsFetched || !isWithinZone || loading}
                        className={`py-3.5 px-6 rounded-2xl font-black font-sans text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          gpsFetched && isWithinZone && !loading
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-[0.98]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        វត្តមាន ចេញ (Check OUT)
                      </button>
                    </div>

                    {/* Simulated Sandbox / Mock Panel */}
                    <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-slate-900/60 border border-indigo-100/50 dark:border-slate-800 text-center font-sans">
                      <span className="text-xxs text-indigo-950 dark:text-indigo-300 font-semibold mb-2 block uppercase tracking-wider">
                        🛠️ ផ្ទាំងដំឡើងទីតាំងសាកល្បង (Geofence Testing Sandbox)
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button 
                          onClick={() => getGps()}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-650 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          📡 ទីតាំងពិត (Real GPS)
                        </button>
                        <button 
                          onClick={() => getGps({ lat: 11.5303, lng: 104.8618 })}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                        >
                          🟢 សាកល្បងក្នុងសាលា (30m)
                        </button>
                        <button 
                          onClick={() => getGps({ lat: 11.5723, lng: 104.8953 })}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                        >
                          🔴 សាកល្បងនៅឆ្ងាយ (8km)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
