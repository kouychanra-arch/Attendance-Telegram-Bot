import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  
  // Basic Bot commands
  bot.start((ctx) => ctx.reply('សួស្តី! សូមស្វាគមន៍មកកាន់ SecureAttend Bot។ សូមប្រើ /checkin ដើម្បីកត់ត្រាវត្តមាន។'));
  
  bot.command('checkin', (ctx) => {
    // In production, verify ctx.from.id matches a Telegram ID in the Supabase employees table
    ctx.reply('✅ ការ Check-in របស់អ្នកត្រូវបានកត់ត្រាដោយជោគជ័យ។ ម៉ោង: ' + new Date().toLocaleTimeString('km-KH'));
  });

  bot.command('status', (ctx) => {
    ctx.reply('📊 ស្ថានភាព: អ្នកកំពុងស្ថិតក្នុងបញ្ជីវត្តមានថ្ងៃនេះ។');
  });
}

export async function POST(req: NextRequest) {
  if (!bot) {
    return NextResponse.json({ error: 'Telegram Bot token not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
