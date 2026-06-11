import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import { getSupabase } from '@/lib/supabase';

let bot: Telegraf | null = null;

function getBotInstance() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // /start command - Welcomes and provides a button to open the Mini App
    bot.start((ctx) => {
      const webAppUrl = process.env.APP_URL || '';
      return ctx.reply(
        'សួស្តី! សូមស្វាគមន៍មកកាន់ SecureAttend (សាលារៀនសុវណ្ណភូមិ - ទួលពង្រ) 🏫\n\n' +
        '👉 សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើកកម្មវិធី Mini App សម្រួលការចុះវត្តមាន និងការគ្រប់គ្រង\n' +
        '👉 ប្រើបញ្ជា `/link <អត្តលេខបុគ្គលិក>` ដើម្បីភ្ជាប់ Telegram id របស់អ្នកសម្រាប់ការទទួលបានសារជូនដំណឹងពេល ចុះវត្តមាន (Check-in/out)\n\n' +
        'ឧទាហរណ៍៖ `/link EMP001`',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              webAppUrl ? [
                {
                  text: 'បើកកម្មវិធី Mini App 📱',
                  web_app: { url: webAppUrl }
                }
              ] : []
            ].filter((arr) => arr.length > 0)
          }
        }
      );
    });

    // /link <EmployeeID> command - binds current Telegram user ID to the selected employee_code/ID
    bot.command('link', async (ctx) => {
      try {
        const text = ctx.message.text || '';
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          return ctx.reply(
            '⚠️ សូមប្រើបញ្ជាឱ្យបានត្រឹមត្រូវ៖\n`/link <អត្តលេខបុគ្គលិក>`\n\n' +
            'ឧទាហរណ៍៖ `/link EMP001`',
            { parse_mode: 'Markdown' }
          );
        }

        const employeeIdOrCode = parts[1].trim();
        const telegramId = ctx.from.id.toString();
        const username = ctx.from.username ? `@${ctx.from.username}` : '';
        const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

        const supabase = getSupabase() as any;
        if (!supabase) {
          return ctx.reply('❌ មានបញ្ហាតភ្ជាប់មូលដ្ឋានទិន្នន័យ (Database connection failed)។');
        }

        // 1. Check if employee exists by employee_code
        let { data: employees, error: fetchErr } = await supabase
          .from('employees')
          .select('*')
          .ilike('employee_code', employeeIdOrCode);

        if (fetchErr) {
          return ctx.reply(`❌ កំហុសក្នុងការស្វែងរកបុគ្គលិក៖ ${fetchErr.message}`);
        }

        // 2. If not found, try matching by id (UUID)
        if (!employees || employees.length === 0) {
          const { data: empById, error: fetchIdErr } = await supabase
            .from('employees')
            .select('*')
            .eq('id', employeeIdOrCode);

          if (!fetchIdErr && empById && empById.length > 0) {
            employees = empById;
          }
        }

        if (!employees || employees.length === 0) {
          return ctx.reply(`❌ រកមិនឃើញគណនីបុគ្គលិកណាដែលមានលេខសម្គាល់ "${employeeIdOrCode}" ទេ។ សូមពិនិត្យម្តងទៀត!`);
        }

        const emp = employees[0];

        // 3. Update the telegram_id of the matching employee
        const { error: updateErr } = await supabase
          .from('employees')
          .update({ telegram_id: telegramId })
          .eq('id', emp.id);

        if (updateErr) {
          return ctx.reply(`❌ មិនអាចរក្សាទុកការភ្ជាប់គណនីបានទេ៖ ${updateErr.message}`);
        }

        return ctx.reply(
          `✅ **ការភ្ជាប់គណនី Telegram ទទួលបានជោគជ័យ!**\n\n` +
          `👤 **ឈ្មោះបុគ្គលិក**៖ \`${emp.full_name}\`\n` +
          `🆔 **អត្តលេខបុគ្គលិក**៖ \`${emp.employee_code || 'N/A'}\`\n` +
          `📱 **Telegram ID**៖ \`${telegramId}\` ${username ? `(${username})` : ''}\n` +
          `✉️ *រាល់ពេល ចុះវត្តមាន (Check-In / Out) នឹងមានសារផ្ញើផ្ទាល់មកកាន់គណនី Telegram នេះ។*`,
          { parse_mode: 'Markdown' }
        );

      } catch (err: any) {
        console.error('Bot /link command error:', err);
        return ctx.reply(`❌ មានបញ្ហាប្រព័ន្ធក្នុងការភ្ជាប់៖ ${err.message}`);
      }
    });
  }
  return bot;
}

// POST endpoint for handles updates forwarded by Telegram
export async function POST(req: NextRequest) {
  const activeBot = getBotInstance();
  if (!activeBot) {
    return NextResponse.json({ error: 'Telegram Bot is not initialized or configured' }, { status: 500 });
  }

  try {
    const update = await req.json();
    await activeBot.handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram Bot handleUpdate error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}

// GET endpoint to set up or verify the webhook registration automatically
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.APP_URL;

  if (!token) {
    return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN variable not found in secrets' }, { status: 500 });
  }

  if (!appUrl) {
    return NextResponse.json({ success: false, error: 'APP_URL variable not configured' }, { status: 500 });
  }

  try {
    const webhookUrl = `${appUrl}/api/bot`;
    const setupUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
    
    const res = await fetch(setupUrl);
    const result = await res.json();
    
    return NextResponse.json({
      success: true,
      info: 'SecureAttend Telegram Webhook Auto-Initializer',
      webhookUrl,
      telegramResponse: result
    });
  } catch (err: any) {
    console.error('Error registering Telegram Webhook:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
