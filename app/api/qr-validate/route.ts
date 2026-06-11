import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSupabase } from '@/lib/supabase';

const SECRET_FILE = '/tmp/active-qr-secret.json';

export async function POST(req: NextRequest) {
  try {
    const { secret, employeeId } = await req.json();

    if (!secret || !employeeId) {
      return NextResponse.json({ success: false, error: 'សំណើគ្មានទិន្នន័យគ្រប់គ្រាន់ទេ (Missing required parameters)' }, { status: 400 });
    }

    let activeSecret = 'DEFAULT_OFFICE_SECRET_123';

    // 1. Try reading the active server secret from file
    if (fs.existsSync(SECRET_FILE)) {
      try {
        const content = fs.readFileSync(SECRET_FILE, 'utf-8');
        const data = JSON.parse(content);
        activeSecret = data.secret || activeSecret;
      } catch (fileErr) {
        console.error('Error reading secret file:', fileErr);
      }
    }

    // 2. Query from Supabase if available
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('office_qr_settings')
          .select('secret')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!error && data && data.length > 0) {
          activeSecret = data[0].secret;
        }
      } catch (dbErr) {
        // Safe to ignore database errors
      }
    }

    // 3. Validate
    if (secret === activeSecret) {
      return NextResponse.json({ success: true, message: 'ផ្ទៀងផ្ទាត់ QR Code ជោគជ័យ' });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'QR Code មិនត្រូវគ្នា ឬហួសសុពលភាពហើយ! សូមស្កែនកូដថ្មីចុងក្រោយបំផុត។ (QR Code is invalid or has expired)' 
    });

  } catch (err: any) {
    console.error('QR Validation server error:', err);
    return NextResponse.json({ success: false, error: 'មានកំហុសប្រព័ន្ធម៉ាស៊ីនបម្រើ (Server validation error)' }, { status: 500 });
  }
}
