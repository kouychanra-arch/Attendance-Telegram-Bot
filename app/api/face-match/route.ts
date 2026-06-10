import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    // Strip the data:image/jpeg;base64, prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
      You are an AI face matcher for an employee attendance system.
      We received this webcam image. Does it contain a clear, identifiable human face?
      Respond in JSON format:
      {
        "hasFace": boolean,
        "confidence": number,
        "message": "reasoning"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
           role: 'user',
           parts: [
             { text: prompt },
             { inlineData: { data: base64Data, mimeType: 'image/jpeg' }}
           ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    // In a real system, we'd query Supabase with a vector representation,
    // For preview purposes, we simulate the "match" if the AI detects a valid face.
    if (resultJson.hasFace && resultJson.confidence > 0.7) {
      // Mock Success for demonstration
      return NextResponse.json({
        success: true,
        employeeId: 'mock-uuid-1234',
        employeeName: 'បុគ្គលិក គំរូ (Demo)',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'មិនអាចស្គាល់មុខបានច្បាស់ទេ។ សូមមើលចំកាមេរ៉ា។ (No clear face detected)',
      });
    }
  } catch (error: any) {
    console.error('Face match error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
