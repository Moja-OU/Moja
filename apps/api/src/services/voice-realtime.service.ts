import WebSocket from 'ws';
import { SessionService } from './session.service';
import { PrismaClient } from '@prisma/client';
import { AudioUtils } from '../utils/audio';

const prisma = new PrismaClient();

// Helper for file logging
function logDebug(message: string) {
    const fs = require('fs');
    fs.appendFileSync('debug_realtime.log', `[${new Date().toISOString()}] ${message}\n`);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-latest';
const HOST = 'generativelanguage.googleapis.com';
const START_WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = `You are Moja, a helpful and friendly AI concierge.
Your output must be concise and conversational.
Speak naturally and enthusiastically.
Ask the user how you can help them today.`;

export class VoiceRealtimeService {
    private ws: WebSocket;
    private geminiWs: WebSocket | null = null;
    private streamSid: string | null = null;
    private callSid: string | null = null;
    private userId: string | null = null;
    private dbSessionId: string | null = null;

    constructor(ws: WebSocket) {
        this.ws = ws;
        logDebug('VoiceRealtimeService (Gemini) instantiated');
    }

    public handleConnection() {
        logDebug('🔌 Twilio Stream Connected');

        this.ws.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message);

                if (data.event === 'start') {
                    logDebug(`📞 Stream START event received: ${JSON.stringify(data.start)}`);
                    this.streamSid = data.start.streamSid;
                    this.callSid = data.start.callSid;
                    const customParams = data.start.customParameters;
                    this.userId = customParams?.userId;

                    if (this.userId) {
                        await this.initializeSession(this.userId, this.callSid!);
                        this.connectToGemini();
                    } else {
                        logDebug('❌ Missing userId in customParameters');
                    }
                } else if (data.event === 'media') {
                    // Audio from Twilio (Mu-law 8kHz)
                    if (this.geminiWs && this.geminiWs.readyState === WebSocket.OPEN) {
                        const payload = data.media.payload; // Base64
                        // Transcode: Base64 -> Buffer(Mulaw) -> PCM16(8k) -> Resample(24k) -> Base64
                        const mulawBuffer = Buffer.from(payload, 'base64');
                        const pcm8k = AudioUtils.mulawToPcm16(mulawBuffer);
                        const pcm24k = AudioUtils.resample8kTo24k(pcm8k);
                        const base64Pcm24k = pcm24k.toString('base64');

                        const msg = {
                            realtime_input: {
                                media_chunks: [
                                    {
                                        mime_type: "audio/pcm", // Implies 16-bit little-endian
                                        data: base64Pcm24k
                                    }
                                ]
                            }
                        };
                        this.geminiWs.send(JSON.stringify(msg));
                    }
                } else if (data.event === 'stop') {
                    logDebug('🛑 Stream STOP event received');
                    this.cleanup();
                }
            } catch (error) {
                logDebug(`Error parsing Twilio message: ${error}`);
            }
        });

        this.ws.on('close', () => {
            logDebug('🔌 Twilio Client Disconnected');
            this.cleanup();
        });

        this.ws.on('error', (e) => {
            logDebug(`❌ Twilio WebSocket Error: ${e}`);
        });
    }

    private async initializeSession(userId: string, callSid: string) {
        try {
            logDebug(`Initializing session for user ${userId}`);
            const session = await SessionService.startSession(userId, 'VOICE', callSid);
            this.dbSessionId = session.id;
        } catch (e) {
            logDebug(`❌ Error initializing session: ${e}`);
        }
    }

    private connectToGemini() {
        logDebug(`🤖 Connecting to Gemini at ${START_WS_URL.replace(GEMINI_API_KEY || '', '***')}...`);

        try {
            this.geminiWs = new WebSocket(START_WS_URL);
        } catch (e) {
            logDebug(`❌ Failed to create Gemini WebSocket: ${e}`);
            return;
        }

        this.geminiWs.on('open', () => {
            logDebug('✅ Connected to Gemini Realtime');
            this.sendSetupMessage();
        });

        this.geminiWs.on('message', (data: any) => {
            try {
                let msg;
                if (Buffer.isBuffer(data)) {
                    msg = JSON.parse(data.toString('utf8'));
                } else {
                    msg = JSON.parse(data);
                }

                this.handleGeminiMessage(msg);
            } catch (e) {
                logDebug(`Error parsing Gemini message: ${e}`);
            }
        });

        this.geminiWs.on('error', (error) => {
            logDebug(`❌ Gemini WebSocket Error: ${error}`);
        });

        this.geminiWs.on('close', (code, reason) => {
            logDebug(`❌ Gemini WebSocket Closed. Code: ${code}, Reason: ${reason}`);
        });
    }

    private sendSetupMessage() {
        if (!this.geminiWs) return;

        const setupMsg = {
            setup: {
                model: `models/${GEMINI_MODEL}`,
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } }
                    }
                },
                system_instruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }]
                }
            }
        };

        logDebug(`Sending Setup Message: ${JSON.stringify(setupMsg)}`);
        this.geminiWs.send(JSON.stringify(setupMsg));

        // Kickstart conversation
        setTimeout(() => {
            this.sendInitialGreeting();
        }, 500);
    }

    private sendInitialGreeting() {
        if (!this.geminiWs) return;
        const greetingMsg = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: "Hello, I am on the phone. respond with a short greeting" }]
                    }
                ],
                turn_complete: true
            }
        };
        logDebug('Sending initial greeting trigger');
        this.geminiWs.send(JSON.stringify(greetingMsg));
    }

    private handleGeminiMessage(msg: any) {
        if (msg.serverContent) {
            const content = msg.serverContent;

            if (content.modelTurn && content.modelTurn.parts) {
                for (const part of content.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
                        // PCM 24k (usually) -> Transcode to Mulaw 8k for Twilio
                        const base64Audio = part.inlineData.data;
                        const pcm24k = Buffer.from(base64Audio, 'base64');
                        const pcm8k = AudioUtils.resample24kTo8k(pcm24k);
                        const mulaw = AudioUtils.pcm16ToMulaw(pcm8k);
                        const payload = mulaw.toString('base64');

                        const twilioMsg = {
                            event: 'media',
                            streamSid: this.streamSid,
                            media: {
                                payload: payload
                            }
                        };
                        this.ws.send(JSON.stringify(twilioMsg));
                    }

                    if (part.text) {
                        logDebug(`Gemini Text: ${part.text}`);
                    }
                }
            }

            if (content.turnComplete) {
                logDebug('Gemini Turn Complete');
            }
        }

        if (msg.toolCall) {
            logDebug(`Gemini Tool Call: ${JSON.stringify(msg.toolCall)}`);
        }
    }

    private cleanup() {
        logDebug('Cleaning up...');
        if (this.geminiWs) {
            this.geminiWs.close();
            this.geminiWs = null;
        }
    }
}
