/**
 * Simple Mu-law <-> PCM conversion and resampling utilities.
 * Twilio uses Mu-law 8kHz.
 * Gemini typically expects PCM 16kHz or 24kHz.
 */

// Mu-law to Linear 16-bit PCM lookup table (simplified)
// In a real app, importing 'g711' package is better, but this avoids heavy deps.
// Use 'alaw-mulaw' or 'g711' npm package if this proves insufficient.

export const AudioUtils = {
    /**
     * Convert Mu-law (8-bit) to PCM (16-bit)
     */
    mulawToPcm16: (mulawBuffer: Buffer): Buffer => {
        const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);
        for (let i = 0; i < mulawBuffer.length; i++) {
            const sample = muLawToPcm(mulawBuffer[i]);
            pcmBuffer.writeInt16LE(sample, i * 2);
        }
        return pcmBuffer;
    },

    /**
     * Convert PCM (16-bit) to Mu-law (8-bit)
     */
    pcm16ToMulaw: (pcmBuffer: Buffer): Buffer => {
        const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);
        for (let i = 0; i < mulawBuffer.length; i++) {
            const sample = pcmBuffer.readInt16LE(i * 2);
            mulawBuffer[i] = pcmToMuLaw(sample);
        }
        return mulawBuffer;
    },

    /**
     * Simple Resample from 8kHz to 24kHz (Upsample x3)
     * Just repeating samples is "nearest neighbor", linear interpolation is better.
     * For voice, linear works OK.
     */
    resample8kTo24k: (pcm8k: Buffer): Buffer => {
        // Input: 16-bit PCM at 8kHz
        // Output: 16-bit PCM at 24kHz
        // Ratio: 3 output samples per 1 input sample
        const sampleCount = pcm8k.length / 2;
        const outputBuffer = Buffer.alloc(sampleCount * 3 * 2);

        for (let i = 0; i < sampleCount; i++) {
            const val = pcm8k.readInt16LE(i * 2);
            // Simple repetition (Zero-order hold) - sounds robotic but robust
            // Linear interpolation would be: 
            //   val, (val*2 + next)/3, (val + next*2)/3
            // Let's stick to repetition for MVP simplicity and speed
            outputBuffer.writeInt16LE(val, i * 6);
            outputBuffer.writeInt16LE(val, i * 6 + 2);
            outputBuffer.writeInt16LE(val, i * 6 + 4);
        }
        return outputBuffer;
    },

    /**
     * Simple Resample from 24kHz to 8kHz (Downsample /3)
     * Picking every 3rd sample.
     */
    resample24kTo8k: (pcm24k: Buffer): Buffer => {
        const sampleCount = pcm24k.length / 2; // Total 16-bit samples
        const outputCount = Math.floor(sampleCount / 3);
        const outputBuffer = Buffer.alloc(outputCount * 2);

        for (let i = 0; i < outputCount; i++) {
            // Pick sample at index i*3
            // In strict DSP we should low-pass filter first to avoid aliasing.
            // For voice MVP, just decimation is audible but acceptable.
            const val = pcm24k.readInt16LE(i * 3 * 2);
            outputBuffer.writeInt16LE(val, i * 2);
        }
        return outputBuffer;
    }
};

// --- Low-level Mu-Law Algo (G.711) ---

const BIAS = 0x84;
const CLIP = 32635;

function pcmToMuLaw(pcm: number): number {
    let sign = (pcm >> 8) & 0x80;
    if (sign !== 0) pcm = -pcm;
    if (pcm > CLIP) pcm = CLIP;
    pcm += BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) { }
    let mantissa = (pcm >> (exponent + 3)) & 0x0F;
    let muLaw = ~(sign | (exponent << 4) | mantissa);
    return muLaw & 0xFF; // Return byte
}

const MU_LAW_DECODE_TABLE = new Int16Array(256);
(function initMuLawTable() {
    for (let i = 0; i < 256; i++) {
        let muLaw = ~i;
        let sign = muLaw & 0x80;
        let exponent = (muLaw >> 4) & 0x07;
        let mantissa = muLaw & 0x0F;
        let sample = (2 * mantissa + 33) << (12 - exponent); // This is simplified
        // The standard formula:
        // sample = ((mantissa << 3) + 0x84) << exponent;
        // sample -= 0x84;
        // Actually, let's use the standard expansion
        // (mantissa + 0.5) * 2^(exp+3) - bias? No.
        // G.711 standard table is better.
        // Let's use a known robust approximation for the table generation.
        // Re-implementing simplified version:
        let position = ((mantissa << 1) + 1 + 32) << exponent; // 32 is bias 0x84? No.
        // Let's rely on the bit manipulation:
        // Exponent is 0..7
        // Mantissa is 0..15

        let value = ((mantissa << 3) + 132); // 132 = 0x84
        value <<= exponent;
        value -= 132;

        if (sign !== 0) value = -value;
        MU_LAW_DECODE_TABLE[i] = value;
    }
})();

function muLawToPcm(muLaw: number): number {
    return MU_LAW_DECODE_TABLE[muLaw & 0xFF];
}
