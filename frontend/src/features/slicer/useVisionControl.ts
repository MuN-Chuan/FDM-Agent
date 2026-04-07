import { useState, useCallback } from 'react';
import { useClientAgent } from './useClientAgent';

interface VisionControlResult {
  success: boolean;
  action?: string;
  x?: number;
  y?: number;
  description?: string;
  error?: string;
}

export function useVisionControl() {
  const { bridge, lastMessage, agentStatus: connectionState } = useClientAgent();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<VisionControlResult | null>(null);

  const sendCommand = useCallback(async (
    cmd: string,
    params?: Record<string, unknown>
  ): Promise<VisionControlResult> => {
    return new Promise((resolve) => {
      const sent = bridge.send(cmd, params);
      if (!sent) {
        resolve({ success: false, error: 'Failed to send command' });
        return;
      }
      resolve({ success: true });
    });
  }, [bridge]);

  const runVisionControl = useCallback(async (
    task: string,
    windowTitle: string = 'Bambu Studio'
  ): Promise<VisionControlResult> => {
    if (connectionState !== 'connected') {
      return { success: false, error: 'Agent not connected' };
    }

    setIsRunning(true);
    try {
      const result = await sendCommand('desktop_vision_run', {
        task,
        target_app: 'bambu_studio',
        window_title: windowTitle,
      });
      setLastResult(result);
      return result;
    } catch (error) {
      const errorResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsRunning(false);
    }
  }, [sendCommand, connectionState]);

  const homePrinter = useCallback(async (): Promise<VisionControlResult> => {
    return runVisionControl('home_printer');
  }, [runVisionControl]);

  const moveAxis = useCallback(async (
    axis: string, 
    distance: number
  ): Promise<VisionControlResult> => {
    return runVisionControl(`move_${axis}_${distance}mm`);
  }, [runVisionControl]);

  return {
    runVisionControl,
    homePrinter,
    moveAxis,
    isRunning,
    lastResult,
    lastMessage,
    isConnected: connectionState === 'connected',
  };
}
