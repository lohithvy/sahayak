// ============================================================
// SAHAYAK - Speech Service Abstraction
// Clean interface for STT/TTS with Bhashini/AI4Bharat compatibility
// ============================================================

export class SpeechService {
  static recognition = null;
  static isListening = false;

  /**
   * Start speech recognition (Web Speech API fallback)
   * Architecture allows swapping to Bhashini/AI4Bharat
   */
  static startListening(language = 'en', onResult, onError, onEnd) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser.');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    // Map language codes to BCP 47
    const langMap = {
      en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN',
      ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN',
      or: 'or-IN', as: 'as-IN', ur: 'ur-IN', ne: 'ne-IN',
    };
    this.recognition.lang = langMap[language] || 'en-IN';

    this.recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResult?.(transcript, isFinal);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      onError?.(event.error === 'no-speech'
        ? 'No speech detected. Please try again.'
        : 'We could not understand the audio. Try again or type your request.');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd?.();
    };

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      onError?.('Failed to start speech recognition.');
      return false;
    }
  }

  static stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Text to Speech (Web Speech API fallback)
   * Architecture allows swapping to Bhashini/AI4Bharat TTS
   */
  static speak(text, language = 'en', onEnd) {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const langMap = {
      en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN',
      ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN',
    };
    utterance.lang = langMap[language] || 'en-IN';
    utterance.rate = 0.9;

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  }

  static stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
