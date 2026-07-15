import { createLogger } from "@/lib/logger";

const logger = createLogger("sounds");
/**
 * Retro gaming sound utilities using Web Audio API
 */

const createAudioContext = () => {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

const playNotes = (
  notes: { frequency: number; duration: number }[],
  waveType: OscillatorType = 'square',
  volume: number = 0.25
) => {
  try {
    const audioContext = createAudioContext();
    let startTime = audioContext.currentTime;

    notes.forEach(({ frequency, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration;
    });
  } catch (_error) {
    logger.debug('Audio playback not supported');
  }
};

/**
 * Victory jingle - ascending sequence (C5-E5-G5-C6)
 */
export const playRetroSuccessSound = () => {
  const notes = [
    { frequency: 523.25, duration: 0.1 },  // C5
    { frequency: 659.25, duration: 0.1 },  // E5
    { frequency: 783.99, duration: 0.1 },  // G5
    { frequency: 1046.50, duration: 0.2 }, // C6 (longer)
  ];
  playNotes(notes, 'square', 0.25);
};

/**
 * Error sound - descending sequence (G4-E4-C4)
 */
export const playRetroErrorSound = () => {
  const notes = [
    { frequency: 392.00, duration: 0.15 },  // G4
    { frequency: 329.63, duration: 0.15 },  // E4
    { frequency: 261.63, duration: 0.3 },   // C4 (longer, lower)
  ];
  playNotes(notes, 'square', 0.25);
};
