import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { employeeId, employeeName, method, timestamp, type = 'check-in' } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId is required for notification' }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminGroupId = process.env.TELEGRAM_ADMIN_GROUP_ID;

    if (!token) {
      console.warn("TELEGRAM_BOT_TOKEN is not configured. Telegram notifications skipped.");
      return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    // 1. Fetch fresher DB record for employee to check if they have a telegram_id
    let telegramId: string | null = null;
    let employeeCode = 'N/A';
    let department = 'General';
    let finalEmployeeName = employeeName || 'បុគ្គលិក';

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await (supabase
          .from('employees')
          .select('telegram_id, employee_code, department, full_name')
          .eq('id', employeeId)
          .single() as any);

        if (!error && data) {
          telegramId = data.telegram_id;
          employeeCode = data.employee_code || employeeCode;
          department = data.department || department;
          finalEmployeeName = data.full_name || finalEmployeeName;
        }
      } catch (dbErr) {
        console.warn("Could not query employee telegram_id from Supabase:", dbErr);
      }
    }

    // Format dates & times nicely using Asia/Phnom_Penh or locale Khmer format
    const checkInDate = timestamp ? new Date(timestamp) : new Date();
    const displayTime = checkInDate.toLocaleTimeString('km-KH', { hour12: true });
    const displayDate = checkInDate.toLocaleDateString('km-KH');

    const checkInMethodsKhmer: Record<string, string> = {
      face: '📸 ស្កែនទម្រង់មុខ (AI Face Match)',
      qr: '📱 ស្កែនកូដ QR សាលារៀន (Office QR Scan)',
      nfc: '💳 ប៉ះកាតការងារ (NFC)',
      gps: '📍 ផែនទី Geofence (GPS)'
    };

    const methodKhmer = checkInMethodsKhmer[method] || method;
    const eventTypeKhmer = type === 'check-out' ? '🔴 ចេញពីធ្វើការ (Check-Out)' : '🟢 ចូលធ្វើការ (Check-In)';

    // 2. Draft complete message
    const messageText = 
      `🔔 **របាយការណ៍វត្តមានរបស់បុគ្គលិក**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⏱️ **ប្រភេទវត្តមាន**៖ ${eventTypeKhmer}\n` +
      `👤 **បុគ្គលិក**៖ \`${finalEmployeeName}\`\n` +
      `🆔 **អត្តលេខបុគ្គលិក**៖ \`${employeeCode}\`\n` +
      `🏢 **ផ្នែកការងារ**៖ \`${department}\`\n` +
      `🕒 **ម៉ោងកត់ត្រា**៖ \`${displayTime}\`\n` +
      `📅 **កាលបរិច្ឆេទ**៖ \`${displayDate}\`\n` +
      `🛠️ **វិធីសាស្ត្រស្កែន**៖ ${methodKhmer}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    // 3. Send to Admin Group if configured
    let adminSent = false;
    if (adminGroupId) {
      try {
        const adminRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminGroupId,
            text: messageText,
            parse_mode: 'Markdown'
          })
        });
        const adminData = await adminRes.json();
        adminSent = adminData.ok;
      } catch (adminErr) {
        console.error("Failed to send message to Telegram Admin Group:", adminErr);
      }
    } else {
      console.warn("TELEGRAM_ADMIN_GROUP_ID is not configured. Admin notifications skipped.");
    }

    // 4. Send to Personal DM if linked (requires numeric chat ID)
    let dmSent = false;
    if (telegramId && /^\d+$/.test(telegramId)) {
      try {
        const dmRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramId,
            text: messageText,
            parse_mode: 'Markdown'
          })
        });
        const dmData = await dmRes.json();
        dmSent = dmData.ok;
      } catch (dmErr) {
        console.error(`Failed to send DM to employee telegram_id ${telegramId}:`, dmErr);
      }
    } else {
      console.log(`Employee Telegram ID "${telegramId}" is either not set or not numeric representation. Private DM skipped.`);
    }

    return NextResponse.json({
      success: true,
      adminSent,
      dmSent,
      employeeId,
      telegramId
    });

  } catch (err: any) {
    console.error("Error in notify endpoint:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
