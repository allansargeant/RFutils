/**
 * AudioWorklet ring-buffer player for RFutils audio cueing.
 *
 * Receives mono Float32 PCM chunks from the main thread (decoded from the
 * PCM16 the server relays over /ws/audio) and plays them out at the context
 * sample rate. A short prime buffer smooths jitter; on underrun it outputs
 * silence and re-primes. Overflow drops the oldest samples to bound latency.
 *
 * `sampleRate` is a global in the AudioWorkletGlobalScope.
 */
class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = Math.round(sampleRate * 2); // 2 s ring
    this.buffer = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;
    this.primeSamples = Math.round(sampleRate * 0.06); // ~60 ms of jitter buffer
    this.priming = true;

    this.port.onmessage = (e) => {
      const chunk = e.data;
      if (!(chunk instanceof Float32Array)) return;
      for (let i = 0; i < chunk.length; i++) {
        this.buffer[this.writeIndex] = chunk[i];
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
        if (this.available < this.capacity) {
          this.available++;
        } else {
          this.readIndex = (this.readIndex + 1) % this.capacity; // overwrite oldest
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const frames = output[0].length;

    if (this.priming) {
      if (this.available < this.primeSamples) return true; // stay silent while filling
      this.priming = false;
    }

    for (let i = 0; i < frames; i++) {
      let s = 0;
      if (this.available > 0) {
        s = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
      } else {
        this.priming = true; // underran — re-prime before draining again
      }
      for (let c = 0; c < output.length; c++) output[c][i] = s;
    }
    return true;
  }
}

registerProcessor('pcm-player', PcmPlayer);
