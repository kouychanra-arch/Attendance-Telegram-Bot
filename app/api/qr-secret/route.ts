import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSupabase } from '@/lib/supabase';

const SECRET_FILE = '/tmp/active-qr-secret.json';

export async function GET() {
  try {
    let activeSecret = 'DEFAULT_OFFICE_SECRET_123';
    
    // Attempt local file read
    if (fs.existsSync(SECRET_FILE)) {
      const content = fs.readFileSync(SECRET_FILE, 'utf-8');
      const data = JSON.parse(content);
      activeSecret = data.secret || activeSecret;
    } else {
      // Set default if not exists
      try {
        fs.writeFileSync(SECRET_FILE, JSON.stringify({ secret: activeSecret, updatedAt: new Date().toISOString() }));
      } catch (writeErr) {
        console.error('Error writing default secret:', writeErr);
      }
    }
    
    return NextResponse.json({ success: true, secret: activeSecret });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Secret required' }, { status: 400 });
    }

    // Persist in temp file
    try {
      fs.writeFileSync(SECRET_FILE, JSON.stringify({ secret, updatedAt: new Date().toISOString() }));
    } catch (writeErr) {
      console.error('Error writing secret file:', writeErr);
    }

    // Optional Supabase persist fallback
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        await supabase.from('office_qr_settings').insert({ secret }).select();
      } catch (e) {
        console.warn("Supabase qr_settings table might not exist, relying on server file:", e);
      }
    }

    return NextResponse.json({ success: true, secret });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
