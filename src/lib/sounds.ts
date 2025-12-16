/**
 * Retro gaming sound utilities using Web Audio API
 */

export const playRetroSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Victory jingle sequence (C5-E5-G5-C6)
    const notes = [
      { frequency: 523.25, duration: 0.1 },  // C5
      { frequency: 659.25, duration: 0.1 },  // E5
      { frequency: 783.99, duration: 0.1 },  // G5
      { frequency: 1046.50, duration: 0.2 }, // C6 (longer)
    ];
    
    let startTime = audioContext.currentTime;
    
    notes.forEach(({ frequency, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'square'; // Square wave = 8-bit sound
      oscillator.frequency.setValueAtTime(frequency, startTime);
      
      // Envelope: fast attack, smooth decay
      gainNode.gain.setValueAtTime(0.25, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
      
      startTime += duration;
    });
  } catch (error) {
    // Audio not supported - fail silently
    console.log('Audio playback not supported');
  }
};
