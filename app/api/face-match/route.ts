import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

function getEuclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) * (a[i] - b[i]);
  }
  return Math.sqrt(sum);
}

export async function POST(req: NextRequest) {
  try {
    const { descriptor, localEnrollments } = await req.json();

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ 
        success: false, 
        error: 'សំណើគ្មានទម្រង់មុខត្រឹមត្រូវទេ (Invalid 128-dimensional descriptor format)' 
      }, { status: 400 });
    }

    let matchedEmployee: { id: string; full_name: string } | null = null;
    let minDistance = Infinity;

    // 1. Try to query enrolled employees from Supabase database
    const supabase = getSupabase() as any;
    if (supabase) {
      try {
        const { data: enrollments, error } = await supabase
          .from('face_enrollments')
          .select(`
            employee_id,
            descriptor,
            employees:employee_id (
              full_name
            )
          `);

        if (!error && enrollments && enrollments.length > 0) {
          for (const item of enrollments) {
            let desc: number[] | null = null;
            if (Array.isArray(item.descriptor)) {
              desc = item.descriptor;
            } else if (typeof item.descriptor === 'string') {
              desc = JSON.parse(item.descriptor);
            }
            
            if (desc && desc.length === 128) {
              const dist = getEuclideanDistance(descriptor, desc);
              if (dist < minDistance) {
                minDistance = dist;
                const empInfo = item.employees as any;
                matchedEmployee = {
                  id: item.employee_id,
                  full_name: empInfo?.full_name || 'បុគ្គលិកមិនស្គាល់ឈ្មោះ',
                };
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn("Supabase fetch failed, sliding to local comparison fallback:", dbErr);
      }
    }

    // 2. Fallbacks/Local Sync: match against offline local enrollments for preview test sandbox
    if (localEnrollments && Array.isArray(localEnrollments)) {
      for (const item of localEnrollments) {
        let desc: number[] | null = null;
        if (Array.isArray(item.descriptor)) {
          desc = item.descriptor;
        } else if (typeof item.descriptor === 'string') {
          desc = JSON.parse(item.descriptor);
        }

        if (desc && desc.length === 128) {
          const dist = getEuclideanDistance(descriptor, desc);
          if (dist < minDistance) {
            minDistance = dist;
            matchedEmployee = {
              id: item.employeeId,
              full_name: item.employeeName || 'បុគ្គលិកមិនស្គាល់ឈ្មោះ',
            };
          }
        }
      }
    }

    const THRESHOLD = 0.5;

    // 3. Evaluate match using strict threshold of < 0.5
    if (matchedEmployee && minDistance < THRESHOLD) {
      return NextResponse.json({
        success: true,
        employeeId: matchedEmployee.id,
        employeeName: matchedEmployee.full_name,
        distance: minDistance
      });
    }

    return NextResponse.json({
      success: false,
      error: `ស្កែនមុខមិនស៊ីគ្នាទេ! ចម្ងាយទម្រង់មុខខុសគ្នា៖ ${minDistance === Infinity ? 'N/A' : minDistance.toFixed(3)} (ត្រូវការពិន្ទុ < ${THRESHOLD} ដើម្បីផ្ទៀងផ្ទាត់)`
    });

  } catch (error: any) {
    console.error('Face match server error:', error);
    return NextResponse.json({ success: false, error: 'លម្អៀងម៉ាស៊ីនមេ ឬទម្រង់មុខមិនត្រឹមត្រូវ' }, { status: 500 });
  }
}
