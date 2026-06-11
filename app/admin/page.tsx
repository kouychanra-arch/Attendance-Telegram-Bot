'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import { 
  Users, Shield, Bell, Camera, Trash2, Plus, Edit2,
  Loader2, CheckCircle2, XCircle, RefreshCw, SmartphoneNfc, 
  QrCode, MapPin, AlertCircle, Check, Printer, Lock, Unlock, LogOut, Send, Info
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AdminDashboard() {
  // Session Authentication State initialize synchronously from sessionStorage
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('secureattend_admin_logged_in') === 'true';
    }
    return false;
  });
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Tab State: sidebar tabs requested are: Employees, QR, Telegram, System
  const [activeTab, setActiveTab] = useState<'employees' | 'qr' | 'telegram' | 'system'>('employees');
  
  // Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [enrolledEmployeeIds, setEnrolledEmployeeIds] = useState<Set<string>>(new Set());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Employee Form States (CRUD Create)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmpCode, setNewEmpCode] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDepartment, setNewEmpDepartment] = useState('');
  const [newEmpTelegram, setNewEmpTelegram] = useState('');
  const [newEmpActive, setNewEmpActive] = useState(true);
  const [newEmpSalary, setNewEmpSalary] = useState('15');

  // Edit Employee States (CRUD Update)
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editEmpCode, setEditEmpCode] = useState('');
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpDepartment, setEditEmpDepartment] = useState('');
  const [editEmpTelegram, setEditEmpTelegram] = useState('');
  const [editEmpSalary, setEditEmpSalary] = useState('');
  const [editEmpActive, setEditEmpActive] = useState(true);

  // System Geofence Location States initialize synchronously from localStorage
  const [officeLat, setOfficeLat] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('secureattend_office_lat') || '11.5305';
    }
    return '11.5305';
  });
  const [officeLng, setOfficeLng] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('secureattend_office_lng') || '104.8620';
    }
    return '104.8620';
  });
  const [geofenceRadius, setGeofenceRadius] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('secureattend_office_radius') || '150';
    }
    return '150';
  });
  const [googleMapsInput, setGoogleMapsInput] = useState<string>('');
  const [saveLocationSuccess, setSaveLocationSuccess] = useState<boolean>(false);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);

  // Face Registration Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedEmployeeForEnroll, setSelectedEmployeeForEnroll] = useState<any>(null);
  const [faceapi, setFaceapi] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState('');

  // Office QR States
  const [officeQrSecret, setOfficeQrSecret] = useState('');
  const [officeQrDataUrl, setOfficeQrDataUrl] = useState('');
  const [isSyncingSecret, setIsSyncingSecret] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123' || password === 'admin') {
      sessionStorage.setItem('secureattend_admin_logged_in', 'true');
      setIsAuthorized(true);
      setLoginError('');
    } else {
      setLoginError('❌ លេខសម្ងាត់មិនត្រឹមត្រូវទេ! (Incorrect password!)');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('secureattend_admin_logged_in');
    setIsAuthorized(false);
    setPassword('');
  };

  const generateRandomSecret = () => {
    return 'SECURE_OFFICE_' + Math.random().toString(36).substring(2, 11).toUpperCase() + '_' + Date.now().toString().slice(-4);
  };

  const generateQrCode = async (secret: string) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(secret, { width: 400, margin: 2 });
      setOfficeQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code data URL:', err);
    }
  };

  const handleRegenerateQr = async () => {
    const newSecret = generateRandomSecret();
    setOfficeQrSecret(newSecret);
    await generateQrCode(newSecret);

    setIsSyncingSecret(true);
    try {
      await fetch('/api/qr-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: newSecret })
      });
      localStorage.setItem('secureattend_office_qr_secret', newSecret);
    } catch (err) {
      console.error('Failed to sync secret to server:', err);
    } finally {
      setIsSyncingSecret(false);
    }
  };

  const loadOfficeQr = useCallback(async () => {
    setIsSyncingSecret(true);
    try {
      const res = await fetch('/api/qr-secret');
      const data = await res.json();
      if (data.success && data.secret) {
        setOfficeQrSecret(data.secret);
        await generateQrCode(data.secret);
        localStorage.setItem('secureattend_office_qr_secret', data.secret);
      } else {
        const local = localStorage.getItem('secureattend_office_qr_secret') || generateRandomSecret();
        setOfficeQrSecret(local);
        await generateQrCode(local);
      }
    } catch (err) {
      const local = localStorage.getItem('secureattend_office_qr_secret') || generateRandomSecret();
      setOfficeQrSecret(local);
      await generateQrCode(local);
    } finally {
      setIsSyncingSecret(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOfficeQr();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOfficeQr]);

  const webcamRef = useRef<Webcam>(null);

  // Load employees, face profiles, and logs
  const loadData = async () => {
    let supabaseEmployees: any[] = [];
    let supabaseFaceEnrollments: any[] = [];
    let supabaseAttendance: any[] = [];

    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        // 1. Fetch Employees
        const { data: emps, error: empErr } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });
        if (!empErr && emps) {
          supabaseEmployees = emps;
        }

        // 2. Fetch Face Enrollments
        const { data: enrolls, error: enrollErr } = await supabase
          .from('face_enrollments')
          .select('employee_id');
        if (!enrollErr && enrolls) {
          supabaseFaceEnrollments = enrolls;
        }

        // 3. Fetch Attendance History
        const { data: atts, error: attErr } = await supabase
          .from('attendance')
          .select(`
            id,
            employee_id,
            check_in_time,
            method,
            status,
            employees:employee_id (
              full_name
            )
          `)
          .order('check_in_time', { ascending: false });
        
        if (!attErr && atts) {
          supabaseAttendance = atts.map((item: any) => ({
            id: item.id,
            employee_id: item.employee_id,
            employee_name: item.employees?.full_name || 'បុគ្គលិកមិនស្គាល់',
            check_in_time: item.check_in_time,
            method: item.method,
            status: item.status
          }));
        }
      } catch (e) {
        console.warn("Supabase tables might be missing or unconfigured. App will merge with localStorage.", e);
      }
    }

    // Load Fallback local cache data
    const localEmpsRaw = localStorage.getItem('secureattend_employees');
    let localEmployees = localEmpsRaw ? JSON.parse(localEmpsRaw) : [];

    if (localEmployees.length === 0 && supabaseEmployees.length === 0) {
      // Setup Initial Seed templates
      localEmployees = [
        { id: 'emp-uuid-sok-chanra', employee_code: 'EMP001', full_name: 'សុខ ចាន់ដារ៉ា', department: 'IT', telegram_id: '65432109', active: true, base_salary_per_hour: 15, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
        { id: 'emp-uuid-keo-pich', employee_code: 'EMP002', full_name: 'កែវ ពេជ្រ', department: 'HR', telegram_id: '45678901', active: true, base_salary_per_hour: 18, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'emp-uuid-chhim-sopheak', employee_code: 'EMP003', full_name: 'ឈឹម សុភ័ក្ត្រ', department: 'Finance', telegram_id: '12345678', active: true, base_salary_per_hour: 20, created_at: new Date(Date.now() - 86400000).toISOString() }
      ];
      localStorage.setItem('secureattend_employees', JSON.stringify(localEmployees));
    }

    // Merge standard lists
    const mergedEmployees = [...supabaseEmployees];
    for (const le of localEmployees) {
      if (!mergedEmployees.some(se => se.id === le.id || se.full_name === le.full_name)) {
        mergedEmployees.push(le);
      }
    }
    setEmployees(mergedEmployees);

    // Merge Face Enrollment Identifiers
    const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
    const localEnrollments = localEnrollmentsRaw ? JSON.parse(localEnrollmentsRaw) : [];

    const enrolledIds = new Set<string>();
    supabaseFaceEnrollments.forEach(item => enrolledIds.add(item.employee_id));
    localEnrollments.forEach((item: any) => enrolledIds.add(item.employeeId));
    setEnrolledEmployeeIds(enrolledIds);

    // Merge Attendance Records
    const localAttRaw = localStorage.getItem('secureattend_attendance');
    const localAttendance = localAttRaw ? JSON.parse(localAttRaw) : [];

    if (localAttendance.length === 0 && supabaseAttendance.length === 0) {
      // Pre-seed some dummy attendance entries
      const preSeeded = [
        { id: 'att-seed-1', employee_id: 'emp-uuid-sok-chanra', employee_name: 'សុខ ចាន់ដារ៉ា', check_in_time: new Date(Date.now() - 3600000 * 2).toISOString(), method: 'face', status: 'present' },
        { id: 'att-seed-2', employee_id: 'emp-uuid-keo-pich', employee_name: 'កែវ ពេជ្រ', check_in_time: new Date(Date.now() - 3600000 * 5).toISOString(), method: 'gps', status: 'present' },
        { id: 'att-seed-3', employee_id: 'emp-uuid-chhim-sopheak', employee_name: 'ឈឹម សុភ័ក្ត្រ', check_in_time: new Date(Date.now() - 3600000 * 12).toISOString(), method: 'qr', status: 'present' }
      ];
      localStorage.setItem('secureattend_attendance', JSON.stringify(preSeeded));
      setAttendanceRecords(preSeeded);
    } else {
      const mergedAttendance = [...supabaseAttendance];
      for (const la of localAttendance) {
        if (!mergedAttendance.some(sa => sa.id === la.id)) {
          mergedAttendance.push(la);
        }
      }
      mergedAttendance.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
      setAttendanceRecords(mergedAttendance);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Hydrate faceapi package dynamically inside client
  useEffect(() => {
    if (isEnrollModalOpen && !faceapi) {
      import('@vladmandic/face-api').then((api) => {
        setFaceapi(api);
      });
    }
  }, [isEnrollModalOpen, faceapi]);

  // Load weights & manifests
  useEffect(() => {
    if (!faceapi || modelsLoaded || loadingModels) return;

    const loadModels = async () => {
      try {
        setLoadingModels(true);
        setEnrollStatus('scanning');
        setEnrollMessage('កំពុងទាញយកម៉ូដែល AI ទម្រង់មុខ (Loading AI face models)...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
        setEnrollStatus('idle');
        setEnrollMessage('');
      } catch (err: any) {
        console.error("Error loading faceapi models:", err);
        setEnrollStatus('error');
        setEnrollMessage('មិនអាចផ្ដួចផ្ដើមម៉ូដែល AI បានទេ៖ ' + err.message);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [faceapi, modelsLoaded, loadingModels]);

  // Office configuration loaded dynamically in lazy state initializers above

  // Submit new employee credentials (CRUD Create)
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const code = newEmpCode.trim().toUpperCase() || 'EMP' + Math.floor(100 + Math.random() * 900);

    if (employees.some(emp => emp.employee_code?.toUpperCase() === code)) {
      alert(`លេខកូដបុគ្គលិក "${code}" មានរួចហើយ! (Employee Code "${code}" is already taken!)`);
      return;
    }

    const newEmp = {
      id: 'emp-' + Math.random().toString(36).substring(2, 13),
      employee_code: code,
      full_name: newEmpName.trim(),
      department: newEmpDepartment.trim() || 'General',
      telegram_id: newEmpTelegram.trim() || null,
      active: newEmpActive,
      base_salary_per_hour: parseFloat(newEmpSalary) || 15,
      created_at: new Date().toISOString()
    };

    // 1. Try DB Write
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
        let tenantId = tenants?.[0]?.id;
        
        if (!tenantId) {
          const { data: newTenant, error: tenantErr } = await supabase
            .from('tenants')
            .insert({ name: 'Default tenant workspace (SecureAttend)' })
            .select('id')
            .single();
          if (!tenantErr && newTenant) {
            tenantId = newTenant.id;
          }
        }

        if (tenantId) {
          const { error } = await supabase.from('employees').insert({
            id: newEmp.id,
            tenant_id: tenantId,
            employee_code: newEmp.employee_code,
            full_name: newEmp.full_name,
            department: newEmp.department,
            telegram_id: newEmp.telegram_id,
            active: newEmp.active,
            base_salary_per_hour: newEmp.base_salary_per_hour
          });
          if (error) console.warn("Supabase insert failed:", error.message);
        }
      } catch (err) {
        console.warn("Database connection failed, bypassing to local storage:", err);
      }
    }

    // 2. Local fallback list write
    const localEmpsRaw = localStorage.getItem('secureattend_employees');
    const localEmployees = localEmpsRaw ? JSON.parse(localEmpsRaw) : [];
    localEmployees.push(newEmp);
    localStorage.setItem('secureattend_employees', JSON.stringify(localEmployees));

    // Reset fields
    setNewEmpCode('');
    setNewEmpName('');
    setNewEmpDepartment('');
    setNewEmpTelegram('');
    setNewEmpActive(true);
    setNewEmpSalary('15');
    setShowAddForm(false);
    loadData();
  };

  // Start Editing Employee (CRUD Read to Update States)
  const startEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setEditEmpCode(emp.employee_code || '');
    setEditEmpName(emp.full_name || '');
    setEditEmpDepartment(emp.department || '');
    setEditEmpTelegram(emp.telegram_id || '');
    setEditEmpSalary(emp.base_salary_per_hour?.toString() || '15');
    setEditEmpActive(emp.active !== false);
  };

  // Save Employee Changes (CRUD Update)
  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const code = editEmpCode.trim().toUpperCase();
    const updatedEmp = {
      ...editingEmployee,
      employee_code: code,
      full_name: editEmpName.trim(),
      department: editEmpDepartment.trim() || 'General',
      telegram_id: editEmpTelegram.trim() || null,
      active: editEmpActive,
      base_salary_per_hour: parseFloat(editEmpSalary) || 15
    };

    // 1. Update localStorage cache
    const localEmpsRaw = localStorage.getItem('secureattend_employees');
    if (localEmpsRaw) {
      const localEmployees = JSON.parse(localEmpsRaw);
      const index = localEmployees.findIndex((e: any) => e.id === editingEmployee.id);
      if (index !== -1) {
        localEmployees[index] = updatedEmp;
      } else {
        localEmployees.push(updatedEmp);
      }
      localStorage.setItem('secureattend_employees', JSON.stringify(localEmployees));
    }

    // 2. Update Supabase Database
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const { error } = await supabase
          .from('employees')
          .update({
            employee_code: updatedEmp.employee_code,
            full_name: updatedEmp.full_name,
            department: updatedEmp.department,
            telegram_id: updatedEmp.telegram_id,
            active: updatedEmp.active,
            base_salary_per_hour: updatedEmp.base_salary_per_hour
          })
          .eq('id', editingEmployee.id);
        if (error) console.warn("Supabase edit write failed:", error.message);
      } catch (err) {
        console.warn("Supabase edit connections failed:", err);
      }
    }

    setEditingEmployee(null);
    loadData();
  };

  // Delete Employee (CRUD Delete)
  const handleDeleteEmployee = async (empId: string) => {
    if (!confirm('⚠️ តើអ្នកប្រាកដជាចង់លុបបុគ្គលិកនេះចេញពីប្រព័ន្ធមែនទេ? (Are you sure you want to delete this employee?)')) {
      return;
    }

    // 1. Delete from localStorage
    const localEmpsRaw = localStorage.getItem('secureattend_employees');
    if (localEmpsRaw) {
      const localEmployees = JSON.parse(localEmpsRaw);
      const filtered = localEmployees.filter((e: any) => e.id !== empId);
      localStorage.setItem('secureattend_employees', JSON.stringify(filtered));
    }

    // 2. Delete face enrollments from localStorage cache
    const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
    if (localEnrollmentsRaw) {
      const localEnrollments = JSON.parse(localEnrollmentsRaw);
      const filteredEnrolls = localEnrollments.filter((e: any) => e.employeeId !== empId);
      localStorage.setItem('secureattend_face_enrollments', JSON.stringify(filteredEnrolls));
    }

    // 3. Delete from Supabase Relational Database
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        // Delete child face enrollments first to safe reference constraints
        await supabase.from('face_enrollments').delete().eq('employee_id', empId);
        // Delete employee
        const { error } = await supabase.from('employees').delete().eq('id', empId);
        if (error) console.warn("Supabase delete raw failed:", error.message);
      } catch (err) {
        console.warn("Supabase delete connection error:", err);
      }
    }

    loadData();
  };

  // Toggle active status in employees list quick option
  const toggleActiveStatus = async (empId: string) => {
    const localEmpsRaw = localStorage.getItem('secureattend_employees');
    if (localEmpsRaw) {
      const localEmployees = JSON.parse(localEmpsRaw);
      const updated = localEmployees.map((e: any) => {
        if (e.id === empId) {
          return { ...e, active: !e.active };
        }
        return e;
      });
      localStorage.setItem('secureattend_employees', JSON.stringify(updated));
    }

    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          const { error } = await supabase
            .from('employees')
            .update({ active: !emp.active })
            .eq('id', empId);
          if (error) console.warn("Supabase active status write failed:", error.message);
        }
      } catch (dbErr) {
        console.warn("DB update failed:", dbErr);
      }
    }

    loadData();
  };

  // Save Geofence Location setup
  const handleSaveLocation = () => {
    if (!officeLat || !officeLng || !geofenceRadius) {
      alert('សូមបំពេញព័ត៌មានអោយបានគ្រប់គ្រាន់!');
      return;
    }
    localStorage.setItem('secureattend_office_lat', officeLat);
    localStorage.setItem('secureattend_office_lng', officeLng);
    localStorage.setItem('secureattend_office_radius', geofenceRadius);
    setSaveLocationSuccess(true);
    setTimeout(() => setSaveLocationSuccess(false), 3000);
  };

  // Google Maps URL Parsing helper
  const handleParseMapsLink = () => {
    if (!googleMapsInput.trim()) return;
    
    // Check direct coordinate pair
    const coordsRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    let match = googleMapsInput.match(coordsRegex);
    if (match) {
      setOfficeLat(match[1]);
      setOfficeLng(match[2]);
      setGoogleMapsInput('');
      alert('✅ បានស្រង់ចេញកូអរដោនេដោយជោគជ័យពីអត្ថបទ!');
      return;
    }

    // Check queries in Google Maps URLs
    const queryRegex = /q=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    match = googleMapsInput.match(queryRegex);
    if (match) {
      setOfficeLat(match[1]);
      setOfficeLng(match[2]);
      setGoogleMapsInput('');
      alert('✅ បានស្រង់ចេញកូអរដោនេដោយជោគជ័យពីតំណភ្ជាប់!');
      return;
    }

    // Check geographic at-pins in Google Maps URLs
    const atRegex = /@(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    match = googleMapsInput.match(atRegex);
    if (match) {
      setOfficeLat(match[1]);
      setOfficeLng(match[2]);
      setGoogleMapsInput('');
      alert('✅ បានស្រង់ចេញកូអរដោនេដោយជោគជ័យពី Google Maps URL!');
      return;
    }

    alert('❌ មិនអាចស្រង់ចេញកូអរដោនេបានទេ។ សូមស្វែងរកកូអរដោនេ ឬចម្លងតំណភ្ជាប់ឲ្យបានត្រឹមត្រូវ។');
  };

  // Get current GPS coordinates from user device
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('ឧបករណ៍របស់អ្នកមិនគាំទ្រ GPS ទេ។');
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(pos.coords.latitude.toFixed(6));
        setOfficeLng(pos.coords.longitude.toFixed(6));
        setIsGpsLoading(false);
        alert('✅ បានទទួលទីតាំងបច្ចុប្បន្នរបស់កុំព្យូទ័រ/ទូរស័ព្ទជោគជ័យ!');
      },
      (err) => {
        setIsGpsLoading(false);
        alert('❌ មិនអាចទាញយកទីតាំងបានទេ៖ ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const enrollFaceRepresentation = async () => {
    if (!faceapi || !webcamRef.current || !selectedEmployeeForEnroll) return;

    setEnrolling(true);
    setEnrollStatus('scanning');
    setEnrollMessage('កំពុងស្កែន និងវិភាគទម្រង់មុខ (Scanning and mapping facial keypoints)...');

    try {
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) {
        setEnrollStatus('error');
        setEnrollMessage('បរាជ័យក្នុងការចាប់ទិន្នន័យកាមេរ៉ា (Webcam feed capture failed).');
        setEnrolling(false);
        return;
      }

      const img = new Image();
      img.src = screenshot;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const detection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setEnrollStatus('error');
        setEnrollMessage('រកមិនឃើញទម្រង់មុខទេ! សូមឈរចំពីមុខកាមេរ៉ាក្នុងពន្លឺច្បាស់លាស់។ (No face detected)');
        setEnrolling(false);
        return;
      }

      const descriptorArray = Array.from(detection.descriptor);

      const supabase = getSupabase() as any;
      if (supabase) {
        try {
          await supabase.from('face_enrollments').upsert({
            employee_id: selectedEmployeeForEnroll.id,
            descriptor: descriptorArray
          });
        } catch (dbErr) {
          console.warn("Could not save vector descriptor in Supabase Cloud:", dbErr);
        }
      }

      const localEnrollmentsRaw = localStorage.getItem('secureattend_face_enrollments');
      const localEnrollments = localEnrollmentsRaw ? JSON.parse(localEnrollmentsRaw) : [];
      const filteredEnrollments = localEnrollments.filter((item: any) => item.employeeId !== selectedEmployeeForEnroll.id);
      filteredEnrollments.push({
        employeeId: selectedEmployeeForEnroll.id,
        employeeName: selectedEmployeeForEnroll.full_name,
        descriptor: descriptorArray,
        enrolled_at: new Date().toISOString()
      });
      localStorage.setItem('secureattend_face_enrollments', JSON.stringify(filteredEnrollments));

      setEnrolledEmployeeIds(prev => {
        const next = new Set(prev);
        next.add(selectedEmployeeForEnroll.id);
        return next;
      });

      setEnrollStatus('success');
      setEnrollMessage(`ចុះឈ្មោះទម្រង់មុខជោគជ័យសម្រាប់ ${selectedEmployeeForEnroll.full_name}! 🟢`);
      
      setTimeout(() => {
        setIsEnrollModalOpen(false);
        setSelectedEmployeeForEnroll(null);
        setEnrollStatus('idle');
        setEnrollMessage('');
      }, 2200);

    } catch (err: any) {
      console.error(err);
      setEnrollStatus('error');
      setEnrollMessage('កំហុសនៃការចុះឈ្មោះ៖ ' + (err.message || 'បញ្ហាប្រព័ន្ធ'));
    } finally {
      setEnrolling(false);
    }
  };

  // If not logged in, render password credentials view
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 transition-colors duration-300 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center"
        >
          <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-2xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">សាលារៀនសុវណ្ណភូមិ</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-6 font-medium">SecureAttend Admin Sign-In 🔒</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-left space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">លេខសម្ងាត់រដ្ឋបាល (Password)</label>
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="🔑 បញ្ចូលលេខសម្ងាត់..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-500/10 py-2.5 px-4 rounded-xl text-left border border-rose-100 dark:border-rose-500/20">
                {loginError}
              </p>
            )}

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-600/15 active:scale-95 transition-all text-sm cursor-pointer"
            >
              ចូលផ្ទាំងគ្រប់គ្រង (Admin Login)
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-450">
            <span className="font-semibold">លំនាំដើម៖ <code className="bg-slate-150 dark:bg-slate-900 px-1.5 py-0.5 rounded font-bold">admin123</code></span>
            <ThemeToggle />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#4A3AFF] text-white flex flex-col shrink-0">
        <div className="p-6 pb-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">SecureAttend</h1>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 flex flex-col gap-1.5">
          <button 
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'employees' ? 'bg-white/10 font-bold' : 'hover:bg-white/5 opacity-80 hover:opacity-100 text-sm'}`}
          >
            <Users className="w-4 h-4 shrink-0" />
            បុគ្គលិក (Employees)
          </button>
          
          <button 
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'qr' ? 'bg-white/10 font-bold' : 'hover:bg-white/5 opacity-80 hover:opacity-100 text-sm'}`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            កូដ QR ការិយាល័យ (QR)
          </button>

          <button 
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'telegram' ? 'bg-white/10 font-bold' : 'hover:bg-white/5 opacity-80 hover:opacity-100 text-sm'}`}
          >
            <Send className="w-4 h-4 shrink-0" />
            តេឡេក្រាម (Telegram)
          </button>

          <button 
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'system' ? 'bg-white/10 font-bold' : 'hover:bg-white/5 opacity-80 hover:opacity-100 text-sm'}`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            ទីតាំងប្រព័ន្ធ (System)
          </button>
        </nav>
        
        <div className="p-4 mt-auto border-t border-white/10 space-y-2">
          <Link href="/check-in" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-sm opacity-80 hover:opacity-100">
            <SmartphoneNfc className="w-4 h-4 shrink-0" /> ម៉ាស៊ីនឆែកវត្តមាន (Kiosk-In)
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-300 transition-all w-full text-left text-sm opacity-80 hover:opacity-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" /> ចាកចេញ (Logout)
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-805 px-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">សាលារៀនសុវណ្ណភូមិ (សាខាទួលពង្រ)</h1>
            <button 
              onClick={loadData}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="រំលឹកទិន្នន័យឡើងវិញ"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">អ្នកគ្រប់គ្រង (Admin)</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-100 dark:border-indigo-500/30">
                AD
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
            
            {/* EMPLOYEES TABS (CRUD READ, CREATE, UPDATE, DELETE & FACE SIGN-IN ENROLLMENT) */}
            {activeTab === 'employees' && (
              <div className="flex flex-col gap-6">
                
                {/* Employee edit modal or quick panel inline editing */}
                <AnimatePresence>
                  {editingEmployee && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-indigo-50/55 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-6"
                    >
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-indigo-600" />
                        កែសម្រួលព័ត៌មានបុគ្គលិក៖ {editingEmployee.full_name}
                      </h3>
                      
                      <form onSubmit={handleSaveEditEmployee} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-xs font-bold text-slate-500">អត្តលេខបុគ្គលិក *</label>
                          <input 
                            type="text" 
                            required
                            value={editEmpCode}
                            onChange={(e) => setEditEmpCode(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 uppercase font-semibold"
                          />
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-xs font-bold text-slate-500">ឈ្មោះបុគ្គលិក *</label>
                          <input 
                            type="text" 
                            required
                            value={editEmpName}
                            onChange={(e) => setEditEmpName(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-xs font-bold text-slate-500">ដេប៉ាតឺម៉ង់ (Department)</label>
                          <input 
                            type="text" 
                            value={editEmpDepartment}
                            onChange={(e) => setEditEmpDepartment(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-xs font-bold text-slate-500">Telegram Chat ID / ID</label>
                          <input 
                            type="text" 
                            value={editEmpTelegram}
                            onChange={(e) => setEditEmpTelegram(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-xs font-bold text-slate-500">ប្រាក់ខែ/ម៉ោង ($/hr)</label>
                          <input 
                            type="number" 
                            value={editEmpSalary}
                            required
                            onChange={(e) => setEditEmpSalary(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-mono focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                          >
                            រក្សាទុក (Save)
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setEditingEmployee(null)}
                            className="bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs py-2.5 px-4 rounded-xl transition-all"
                          >
                            បោះបង់
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Header Action panel */}
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-850 dark:text-slate-100">បញ្ជីគ្រប់គ្រងបុគ្គលិកសាលា</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ចុះឈ្មោះ កែសម្រួល បន្ថែម ឬលុបគណនីបុគ្គលិកចេញពីប្រព័ន្ធ</p>
                  </div>
                  <button 
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-3 rounded-xl font-extrabold transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.02] cursor-pointer"
                  >
                    {showAddForm ? '✕ បិទបែបផែនបន្ថែម' : '+ បន្ថែមបុគ្គលិកថ្មី (Create)'}
                  </button>
                </div>

                {/* Collapsible New Employee Form (CRUD Create) */}
                {showAddForm && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    onSubmit={handleAddEmployee}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end"
                  >
                    <div className="w-full flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-bold text-slate-500">អត្តលេខបុគ្គលិក (ID) *</label>
                      <input 
                        type="text" 
                        required
                        value={newEmpCode}
                        onChange={(e) => setNewEmpCode(e.target.value)}
                        placeholder="ឧ. EMP101"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm focus:outline-none uppercase font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-full flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-bold text-slate-500">ឈ្មោះបុគ្គលិក (Full Name) *</label>
                      <input 
                        type="text" 
                        required
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        placeholder="ឧ. សុខ ចាន់រ៉ា"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm focus:outline-none font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-full flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-bold text-slate-500">ផ្នែក/ដេប៉ាតឺម៉ង់ (Department)</label>
                      <input 
                        type="text" 
                        value={newEmpDepartment}
                        onChange={(e) => setNewEmpDepartment(e.target.value)}
                        placeholder="ឧ. IT, HR, គណនេយ្យ"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm focus:outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-full flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-bold text-slate-500">Telegram Chat ID / ID</label>
                      <input 
                        type="text" 
                        value={newEmpTelegram}
                        onChange={(e) => setNewEmpTelegram(e.target.value)}
                        placeholder="ឧ. 176281092"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm focus:outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="w-full flex flex-col gap-1.5 text-left">
                      <label className="text-xs font-bold text-slate-500">ប្រាក់ខែ/ម៉ោង ($/hr)</label>
                      <input 
                        type="number" 
                        required
                        value={newEmpSalary}
                        onChange={(e) => setNewEmpSalary(e.target.value)}
                        placeholder="15"
                        min="1"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-mono focus:outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-[44px] px-4 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      ចុះឈ្មោះរួចរាល់ (Enroll)
                    </button>
                  </motion.form>
                )}

                {/* Employees database list table (CRUD Read & Update / Delete Option UI) */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  {isLoading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                      <p className="font-semibold text-xs">កំពុងដំណើរការទាញយកទិន្នន័យបុគ្គលិក...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-350">
                        <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-xs font-extrabold uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-4">បុគ្គលិក (Employee ID & Name)</th>
                            <th className="px-6 py-4">ផ្នែក (Department)</th>
                            <th className="px-6 py-4">Telegram ID / Chat ID</th>
                            <th className="px-6 py-4 text-center">ប្រាក់ខែ/ម៉ោង</th>
                            <th className="px-6 py-4 text-center">ស្កែនរូបទម្រង់មុខ (Face-ID)</th>
                            <th className="px-6 py-4 text-center">ស្ថានភាព (Status)</th>
                            <th className="px-6 py-4 text-right">សកម្មភាពគ្របដណ្ដប់</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {employees.map((emp, index) => {
                            const isEnrolled = enrolledEmployeeIds.has(emp.id);
                            return (
                              <tr key={emp.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                <td className="px-6 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                                    {index + 1}
                                  </div>
                                  <div className="flex flex-col text-left">
                                    <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                      {emp.employee_code || "N/A"}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                      {emp.full_name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                  {emp.department || <span className="text-slate-300 text-xs italic">General</span>}
                                </td>
                                <td className="px-6 py-4 font-mono font-medium">
                                  {emp.telegram_id ? (
                                    <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-xs">
                                      {emp.telegram_id}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600 text-xs italic">គ្មានភ្ជាប់ (None)</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-center text-sm">
                                  ${parseFloat(emp.base_salary_per_hour || 15).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {isEnrolled ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-550/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                      <Check className="w-3 h-3" />
                                      បានចុះស្កែនមុខ
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-550/10 text-rose-700 dark:text-rose-450 border border-rose-100 dark:border-rose-500/20 animate-pulse">
                                      <AlertCircle className="w-3 h-3" />
                                      ខ្វះទិន្នន័យស្កែន
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button 
                                    onClick={() => toggleActiveStatus(emp.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                      emp.active !== false 
                                        ? 'bg-indigo-50 dark:bg-indigo-505/10 text-indigo-700 dark:text-indigo-400 border-indigo-100'
                                        : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${emp.active !== false ? 'bg-indigo-550 animate-pulse' : 'bg-slate-400'}`}></span>
                                    {emp.active !== false ? 'សកម្ម' : 'អសកម្ម'}
                                  </button>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2 text-xs">
                                    <button 
                                      onClick={() => {
                                        setSelectedEmployeeForEnroll(emp);
                                        setIsEnrollModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-[#4A3AFF] dark:text-[#6A5AFF] font-bold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Camera className="w-3.5 h-3.5" />
                                      ស្កែនមុខ
                                    </button>

                                    <button 
                                      onClick={() => startEditEmployee(emp)}
                                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 text-amber-700 font-bold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      កែ
                                    </button>

                                    <button 
                                      onClick={() => handleDeleteEmployee(emp.id)}
                                      className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      លុប
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OFFICE QR CODE OPTION */}
            {activeTab === 'qr' && (
              <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 p-8 rounded-3xl shadow-sm flex flex-col items-center">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-extrabold text-slate-850 dark:text-slate-100">កូដ QR របស់ការិយាល័យ (Office QR Code) ⏱️</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    បង្កើត និងគ្រប់គ្រង QR Code សំរាប់បិទនៅការិយាល័យដើម្បីអោយបុគ្គលិកស្កែនចុះវត្តមាន។
                  </p>
                </div>

                <div className="relative p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center w-full max-w-sm mb-6 shadow-inner animate-fade-in">
                  {officeQrDataUrl ? (
                    <img 
                      src={officeQrDataUrl} 
                      alt="Office QR Code" 
                      className="w-64 h-64 border-4 border-white dark:border-slate-850 rounded-xl shadow"
                    />
                  ) : (
                    <div className="w-64 h-64 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                      <span className="text-xs">កំពុងបង្កើតកូដ QR ចុងក្រោយ...</span>
                    </div>
                  )}

                  <div className="mt-4 text-center w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ទិន្នន័យសម្ងាត់សកម្ម (ACTIVE TOKEN):</span>
                    <span className="font-mono text-xs font-bold bg-white dark:bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 select-all break-all block text-indigo-600 dark:text-indigo-400">
                      {officeQrSecret || 'លំនាំដើម...'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <button 
                    onClick={handleRegenerateQr}
                    disabled={isSyncingSecret}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold px-4 py-3 rounded-xl transition-all text-xs cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSecret ? 'animate-spin' : ''}`} />
                    បង្កើតថ្មី (Regenerate)
                  </button>

                  <button 
                    onClick={() => {
                      if (!officeQrDataUrl) return;
                      const link = document.createElement('a');
                      link.href = officeQrDataUrl;
                      link.download = `office-qr-code-${officeQrSecret}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-3 rounded-xl transition-all text-xs cursor-pointer shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    ទាញយក PNG
                  </button>

                  <button 
                    onClick={() => {
                      window.print();
                    }}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-extrabold px-4 py-3 rounded-xl transition-all text-xs cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    បោះពុម្ព (Print)
                  </button>
                </div>
                
                <div className="mt-6 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15 w-full text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
                  💡 <strong>ចំណាំ៖</strong> រាល់ពេលចុច &ldquo;បង្កើតថ្មី&rdquo; កូដចាស់នឹងលែងមានសុពលភាព។ បុគ្គលិកត្រូវតែស្កែនកូដថ្មីចុងក្រោយបំផុត ដើម្បីចុះវត្តមានបានត្រឹមត្រូវ។
                </div>
              </div>
            )}

            {/* TELEGRAM MANAGEMENT OPTION */}
            {activeTab === 'telegram' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm text-left">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center font-bold">
                      TG
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-850 dark:text-slate-100">តេឡេក្រាមជំនួយការ (Telegram Bot Webhook Context)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ការកំណត់សម្រាប់ការផ្ញើសារដំណឹង ចុះវត្តមានផ្ទាល់ ឬការបញ្ជា Bot ផ្សេងៗ</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 font-sans text-sm">
                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Info className="w-4 h-4 text-sky-500" />
                      របៀបទទួលបានសារជូនដំណឹងពេល ចុះវត្តមាន (Check-in/out)៖
                    </p>
                    <ol className="list-decimal pl-5 space-y-2 text-slate-600 dark:text-slate-350 text-xs">
                      <li>ស្វែងរក Bot របស់អ្នកលើតេឡេក្រាមរួចចុច <strong>/start</strong>។</li>
                      <li>ឬប្រើបញ្ជា <code>/link &lt;អត្តលេខបុគ្គលិក&gt;</code> (ឧ. <code>/link EMP001</code>) ដើម្បីភ្ជាប់គណនី Telegram code របស់អ្នកជាមួយនិងបុគ្គលិកម្នាក់ៗ។</li>
                      <li>ពេលបើកកម្មវិធី Mini App នៅក្នុងតេឡេក្រាម ប្រព័ន្ធឆ្លាតវៃនឹងព្យាយាមភ្ជាប់គណនីដោយស្វ័យប្រវត្តិតែម្ដង។</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="border border-slate-200 dark:border-slate-750 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-slate-400">ស្ថានភាព BOT Token</p>
                      <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-550 animate-pulse"></span>
                        បានកំណត់រួចរាល់ (Configured)
                      </p>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-750 p-4 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-slate-400">ក្រុមការិយាល័យធំ (Admin Group Telegram)</p>
                      <p className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        សកម្ម (Admin Chat Group Live)
                      </p>
                    </div>
                  </div>

                  {/* Webhook Initializer Testing */}
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-750">
                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">បំពេញការ Setup Webhook របស់ Telegram ជាស្វ័យប្រវត្តិ</h4>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/bot');
                          const data = await res.json();
                          alert('ផ្ញើរសំណើទៅ Telegram Setup ជោគជ័យ៖\n' + JSON.stringify(data, null, 2));
                        } catch (err: any) {
                          alert('❌ បរាជ័យក្នុងការកំណត់៖ ' + err.message);
                        }
                      }}
                      className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      តភ្ជាប់ និងប្រកាសផ្លូវផ្លូវការ Telegram Webhook (Initialize Webhook)
                    </button>
                    <p className="text-[10px] text-slate-400 mt-2">វានឹងប្រើប្រាស់ URL ប្រព័ន្ធរបស់អ្នកដើម្បីបង្កើត webhook ស្របច្បាប់ជូន API Telegram ផ្ទាល់។</p>
                  </div>
                </div>
              </div>
            )}

            {/* SYSTEM CONFIGURATION OPTION (GEOFENCING LOCATION, COORDS, RADIUS SETTINGS) */}
            {activeTab === 'system' && (
              <div className="max-w-2xl mx-auto space-y-6">
                
                {/* Geofence Form Layout */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm text-left">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-bold">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-850 dark:text-slate-100">ទីតាំងប្រព័ន្ធការពារ Geofence (School Geofencing)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">កំណត់និយាមការ (Latitude, Longitude) របស់សាលារៀន និងកំណត់កាំរង្វង់ពិនិត្យ</p>
                    </div>
                  </div>

                  <div className="space-y-6 font-sans">
                    
                    {/* Google Maps parsing option */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">ស្រង់កូអរដោនេពី Google Maps Link (ឬកូពី coords)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={googleMapsInput}
                          onChange={(e) => setGoogleMapsInput(e.target.value)}
                          placeholder="បញ្ចូល Google Maps Link ឬ Coords (ឧ. 11.5305121, 104.8620153)..."
                          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none text-slate-800 dark:text-slate-100"
                        />
                        <button 
                          onClick={handleParseMapsLink}
                          type="button"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          ស្រង់យកព័ត៌មាន (Extract)
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">គាំទ្រកូឌីង coordinates ដែលមានសញ្ញាក្បៀស ឬតំណភ្ជាប់ URL Maps directpin directly (@lat,lng)។</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Latitude */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">រយៈទទឹងមធ្យម (Latitude)</label>
                        <input 
                          type="number" 
                          step="0.000001"
                          required
                          value={officeLat}
                          onChange={(e) => setOfficeLat(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                        />
                      </div>

                      {/* Longitude */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">រយៈបណ្ដោយមធ្យម (Longitude)</label>
                        <input 
                          type="number" 
                          step="0.000001"
                          required
                          value={officeLng}
                          onChange={(e) => setOfficeLng(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-855 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-400 uppercase tracking-widest block">កាំរង្វង់សុវត្ថិភាពGeofence (Radius) : {geofenceRadius} ម៉ែត្រ</label>
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-mono">{geofenceRadius}m</span>
                      </div>
                      <input 
                        type="range" 
                        min="50" 
                        max="2000" 
                        step="5"
                        value={geofenceRadius}
                        onChange={(e) => setGeofenceRadius(e.target.value)}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>50m (តឹងរ៉ឹងបំផុត)</span>
                        <span>1000m (មធ្យម)</span>
                        <span>2000m (ទូលាយ)</span>
                      </div>
                    </div>

                    {/* Geolocation Live browser fetch */}
                    <div className="pt-2">
                      <button 
                        onClick={handleGetCurrentGps}
                        disabled={isGpsLoading}
                        type="button"
                        className="w-full border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isGpsLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <MapPin className="w-4 h-4 text-rose-500 animate-pulse" />
                        )}
                        ទាញយកទីតាំងបច្ចុប្បន្នរបស់កុំព្យូទ័រ/ទូរស័ព្ទ (Get Current GPS Location)
                      </button>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <p className="text-[10px] text-slate-400">វត្តមានទូរស័ព្ទនឹងត្រូវឆ្លងកាត់ការផ្ទៀងផ្ទាត់ Geofence នេះ។</p>
                      
                      <button 
                        onClick={handleSaveLocation}
                        type="button"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-600/10 active:scale-95 transition-all cursor-pointer"
                      >
                        រក្សាទុកការកំណត់ទីតាំង (Save Settings)
                      </button>
                    </div>

                    <AnimatePresence>
                      {saveLocationSuccess && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-450 p-4 rounded-xl text-center text-xs font-bold"
                        >
                          🎉 រក្សាទុកការកំណត់ Geofencing ជោគជ័យ! រាល់ម៉ាស៊ីនឆែកវត្តមាននឹងគណនាទៅតាមកូអរដោនេចុងក្រោយនេះ។
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </main>
      </div>

      {/* Face Registration Camera Modal */}
      <AnimatePresence>
        {isEnrollModalOpen && selectedEmployeeForEnroll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-850 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-850 dark:text-slate-100 font-sans">
                    ចុះឈ្មោះស្កែនមុខ AI សម្រាប់៖
                  </h3>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 font-sans">
                    {selectedEmployeeForEnroll.full_name}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsEnrollModalOpen(false);
                    setSelectedEmployeeForEnroll(null);
                    setEnrollStatus('idle');
                    setEnrollMessage('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all font-sans cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Dynamic Camera or Loader window */}
              <div className="p-6 flex flex-col items-center justify-center relative flex-1 min-h-[300px]">
                {loadingModels ? (
                  <div className="flex flex-col items-center justify-center text-center p-12">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                    <p className="font-bold text-slate-800 dark:text-slate-200 font-sans animate-pulse">
                      {enrollMessage || 'កំពុងទាញយកម៉ូដែល AI...'}
                    </p>
                    <p className="text-xs text-slate-450 mt-2 font-mono">
                      ssd_mobilenetv1 + face_landmarks_68 + face_recognition (First load may take ~30s)
                    </p>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    {/* Active Camera Frame */}
                    <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-inner relative mb-6">
                      
                      {enrollStatus === 'success' ? (
                        <div className="absolute inset-0 z-10 bg-emerald-500/90 backdrop-blur-sm flex flex-col items-center justify-center text-white text-center p-6">
                          <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
                          <p className="text-lg font-extrabold font-sans">ចុះឈ្មោះទម្រង់មុខជោគជ័យ!</p>
                          <p className="text-xs opacity-90 mt-1 font-sans">ទម្រង់មុខត្រូវបានរក្សាទុកជាលេខកូដសុវត្ថិភាព 128-d vector</p>
                        </div>
                      ) : null}

                      {enrollStatus === 'error' ? (
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-rose-600 text-white text-center text-xs p-3 font-semibold flex items-center justify-center gap-2">
                          <XCircle className="w-4 h-4" />
                          <span className="font-sans">{enrollMessage}</span>
                        </div>
                      ) : null}

                      {enrollStatus === 'scanning' ? (
                        <div className="absolute inset-0 z-10 bg-indigo-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-300 text-center p-6">
                          <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-400" />
                          <p className="font-bold font-sans animate-pulse">{enrollMessage}</p>
                        </div>
                      ) : null}

                      <Webcam
                        ref={webcamRef}
                        mirrored
                        audio={false}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Face scanner target circle overlay */}
                      <div className="absolute inset-0 border-[6px] border-indigo-500/35 rounded-2xl pointer-events-none flex items-center justify-center">
                        <div className="w-[80%] h-[80%] rounded-full border-2 border-dashed border-indigo-400 animate-pulse"></div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4 w-full justify-center font-sans">
                      <button 
                        onClick={enrollFaceRepresentation}
                        disabled={enrolling || !modelsLoaded}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3.5 rounded-full shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        ថតរូប និងកក់ត្រាទម្រង់មុខលោហៈធាតុ AI (Scan & Enroll Face)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
