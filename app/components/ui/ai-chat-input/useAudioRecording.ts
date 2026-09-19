import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecordingOptions {
  value: string;
  onValueChange: (val: string) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export function useAudioRecording({ value, onValueChange, onStart, onStop }: UseAudioRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(5).fill(0));
  const valueRef = useRef(value);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const demoTextIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (demoIntervalRef.current) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (demoTextIntervalRef.current) {
      window.clearInterval(demoTextIntervalRef.current);
      demoTextIntervalRef.current = null;
    }
    setIsRecording(false);
    setAudioData(new Array(5).fill(0));
    onStop?.();
  }, [onStop]);

  const startRecording = useCallback(async () => {
    onStart?.();

    let stream: MediaStream | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      console.warn('Microphone access denied or unavailable. Falling back to simulated voice mode for demo.');
    }

    setIsRecording(true);

    function simulateText() {
      const fakeText = 'Build a modern responsive dashboard with full PocketBase authentication and real-time data';
      const words = fakeText.split(' ');
      let i = 0;
      let currentBase = valueRef.current;
      demoTextIntervalRef.current = window.setInterval(() => {
        if (i < words.length) {
          currentBase = (currentBase ? currentBase + ' ' : '') + words[i];
          onValueChange(currentBase);
          i++;
        } else {
          stopRecording();
        }
      }, 300);
    }

    if (stream && typeof window !== 'undefined') {
      streamRef.current = stream;

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVisualizer = () => {
            analyser.getByteFrequencyData(dataArray);
            const bands = new Array(5).fill(0);
            const step = Math.floor(dataArray.length / 5);
            for (let i = 0; i < 5; i++) {
              let sum = 0;
              for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j];
              }
              bands[i] = sum / step / 255;
            }
            setAudioData(bands);
            rafRef.current = requestAnimationFrame(updateVisualizer);
          };

          updateVisualizer();
        }
      } catch (e) {
        console.warn('Web Audio API error:', e);
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;

          let baseline = valueRef.current;

          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }

            if (finalTranscript) {
              baseline += (baseline ? ' ' : '') + finalTranscript;
            }

            onValueChange((baseline + (interimTranscript ? ' ' + interimTranscript : '')).trim());
          };

          recognition.onerror = (e: any) => {
            console.error('Speech recognition error', e);
            stopRecording();
          };

          recognition.onend = () => {
            stopRecording();
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (err) {
          console.warn('Speech recognition init error:', err);
          simulateText();
        }
      } else {
        simulateText();
      }
    } else {
      demoIntervalRef.current = window.setInterval(() => {
        setAudioData(Array.from({ length: 5 }, () => Math.random() * 0.8 + 0.1));
      }, 100);
      simulateText();
    }
  }, [onStart, onValueChange, stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    audioData,
    startRecording,
    stopRecording,
  };
}
